import json
import sys
from pathlib import Path

import pytest
from genlayer import Address, gl
from gltest.direct import wasi_mock
from gltest.direct.loader import deploy_contract
from gltest.direct.sdk_loader import setup_sdk_paths
from gltest.direct.vm import VMContext
from package_release_provenance_consistency_register import (
    OUTCOME_COMMIT_MISMATCH,
    OUTCOME_PROVENANCE_MATCH,
    OUTCOME_REPOSITORY_MISMATCH,
    OUTCOME_SOURCE_LINK_MISSING,
    OUTCOME_UNRESOLVED,
    OUTCOME_VERSION_TAG_MISMATCH,
    STATE_ASSESSING,
    STATE_DRAFT,
    STATE_FROZEN,
    STATE_RESOLVED,
    STATE_UNRESOLVED,
)

DEPLOYER = Address("0x1111111111111111111111111111111111111111")
OWNER = Address("0x2222222222222222222222222222222222222222")
OTHER = Address("0x3333333333333333333333333333333333333333")
COMMIT = "a" * 40
OTHER_COMMIT = "b" * 40
PACKAGE = "release-proof"
VERSION = "1.2.3"
REGISTRY_URL = f"https://registry.npmjs.org/{PACKAGE}/{VERSION}"
RELEASE_URL = f"https://github.com/acme/tool/releases/tag/{VERSION}"


def set_sender(sender: Address) -> None:
    from genlayer.py.types import u256

    message = gl.MessageType(
        contract_address=DEPLOYER,
        sender_address=sender,
        origin_address=sender,
        value=u256(0),
        chain_id=u256(61999),
    )
    gl.message = message
    if hasattr(gl, "_cached_gl") and hasattr(gl._cached_gl, "message"):
        gl._cached_gl.message = message
    vm = wasi_mock.get_vm()
    vm.sender = sender
    vm.origin = sender


@pytest.fixture(autouse=True)
def reset_vm():
    vm = VMContext()
    vm.sender = DEPLOYER
    vm.origin = DEPLOYER
    wasi_mock.set_vm(vm)
    with vm.activate():
        set_sender(DEPLOYER)
        yield vm


def new_contract():
    path = Path(__file__).parents[1] / "contracts" / "package_release_provenance_consistency_register.py"
    setup_sdk_paths(path)
    registry = sys.modules.get("genlayer.gl.genvm_contracts")
    if registry is not None:
        registry.__dict__["__known_contract__"] = None
    return deploy_contract(path, wasi_mock.get_vm())


def create_args(case_id="case-1", expected=COMMIT, subdirectory="src", release_url=RELEASE_URL):
    return (case_id, "npm", PACKAGE, VERSION, REGISTRY_URL, "acme", "tool", release_url, expected, subdirectory)


def response(status=200, data=None):
    body = json.dumps(data).encode("utf-8") if data is not None else b""
    return type("Response", (), {"status_code": status, "body": body})()


def web_fixture(monkeypatch, *, registry_name=PACKAGE, registry_repo="https://github.com/acme/tool.git", commit=COMMIT, status=200, include_subdirectory=True, raises=False):
    def get(url):
        if raises:
            raise TimeoutError("upstream timeout")
        if url == REGISTRY_URL:
            return response(status, {"name": registry_name, "version": VERSION, "repository": {"url": registry_repo}})
        if "/git/ref/tags/" in url:
            return response(status, {"object": {"type": "commit", "sha": commit}})
        if "/git/trees/" in url:
            tree = [{"path": "src", "type": "tree"}] if include_subdirectory else []
            return response(status, {"tree": tree})
        return response(404, {})

    monkeypatch.setattr(gl.nondet.web, "get", get)


def run_both_callbacks_once(monkeypatch):
    def run(leader_fn, validator_fn):
        leader = leader_fn()
        assert validator_fn(gl.vm.Return(leader)) is True
        return leader

    monkeypatch.setattr(gl.vm, "run_nondet_unsafe", run)


def test_create_freeze_and_match_projection(monkeypatch):
    contract = new_contract()
    set_sender(OWNER)
    contract.create_case(*create_args())
    with pytest.raises(Exception, match="ERR_NOT_OWNER"):
        set_sender(OTHER)
        contract.freeze_case("case-1")
    set_sender(OWNER)
    contract.freeze_case("case-1")
    assert json.loads(contract.get_case("case-1"))["state"] == STATE_FROZEN

    web_fixture(monkeypatch)
    run_both_callbacks_once(monkeypatch)
    contract.assess_case("case-1")
    result = json.loads(contract.get_result("case-1"))
    assert result["state"] == STATE_RESOLVED
    assert result["outcome"] == OUTCOME_PROVENANCE_MATCH
    assert result["observed_commit_id"] == COMMIT


def test_v_prefixed_release_tag_matches(monkeypatch):
    contract = new_contract()
    set_sender(OWNER)
    contract.create_case(*create_args(case_id="case-v", release_url=f"https://github.com/acme/tool/releases/tag/v{VERSION}"))
    contract.freeze_case("case-v")
    web_fixture(monkeypatch)
    run_both_callbacks_once(monkeypatch)
    contract.assess_case("case-v")
    result = json.loads(contract.get_result("case-v"))
    assert result["outcome"] == OUTCOME_PROVENANCE_MATCH


def test_registry_package_identity_mismatch_fails_closed(monkeypatch):
    contract = new_contract()
    set_sender(OWNER)
    contract.create_case(*create_args())
    contract.freeze_case("case-1")
    web_fixture(monkeypatch, registry_name="different-package")
    run_both_callbacks_once(monkeypatch)
    contract.assess_case("case-1")
    result = json.loads(contract.get_result("case-1"))
    assert result["outcome"] == OUTCOME_UNRESOLVED
    assert result["state"] == STATE_UNRESOLVED


def test_nonmatching_release_tag_is_assessed(monkeypatch):
    contract = new_contract()
    set_sender(OWNER)
    contract.create_case(*create_args(case_id="case-tag", release_url="https://github.com/acme/tool/releases/tag/9.9.9"))
    contract.freeze_case("case-tag")
    web_fixture(monkeypatch)
    run_both_callbacks_once(monkeypatch)
    contract.assess_case("case-tag")
    result = json.loads(contract.get_result("case-tag"))
    assert result["outcome"] == OUTCOME_VERSION_TAG_MISMATCH


@pytest.mark.parametrize(
    ("fixture", "outcome"),
    [
        ({"registry_repo": "https://github.com/other/tool.git"}, OUTCOME_REPOSITORY_MISMATCH),
        ({"commit": OTHER_COMMIT}, OUTCOME_COMMIT_MISMATCH),
        ({"registry_repo": "https://example.com/source"}, OUTCOME_SOURCE_LINK_MISSING),
        ({"status": 429}, OUTCOME_UNRESOLVED),
        ({"include_subdirectory": False}, OUTCOME_UNRESOLVED),
        ({"raises": True}, OUTCOME_UNRESOLVED),
    ],
)
def test_outcomes_fail_closed_and_never_accept_prefixes(monkeypatch, fixture, outcome):
    contract = new_contract()
    set_sender(OWNER)
    contract.create_case(*create_args())
    contract.freeze_case("case-1")
    web_fixture(monkeypatch, **fixture)
    run_both_callbacks_once(monkeypatch)
    contract.assess_case("case-1")
    result = json.loads(contract.get_result("case-1"))
    assert result["outcome"] == outcome
    assert result["state"] == (STATE_UNRESOLVED if outcome == OUTCOME_UNRESOLVED else STATE_RESOLVED)


def test_retry_is_bounded_and_duplicate_provenance_is_rejected(monkeypatch):
    contract = new_contract()
    set_sender(OWNER)
    contract.create_case(*create_args())
    with pytest.raises(Exception, match="ERR_DUPLICATE_PROVENANCE"):
        contract.create_case(*create_args(case_id="case-2"))
    contract.freeze_case("case-1")
    web_fixture(monkeypatch, status=503)
    run_both_callbacks_once(monkeypatch)
    contract.assess_case("case-1")
    contract.retry_unresolved("case-1")
    contract.assess_case("case-1")
    contract.retry_unresolved("case-1")
    contract.assess_case("case-1")
    with pytest.raises(Exception, match="ERR_RETRY_NOT_ALLOWED"):
        contract.retry_unresolved("case-1")


def test_validator_disagreement_is_detected(monkeypatch):
    contract = new_contract()
    set_sender(OWNER)
    contract.create_case(*create_args())
    contract.freeze_case("case-1")

    def run(leader_fn, validator_fn):
        leader = leader_fn()
        projection = json.loads(leader)
        projection["commit_id"] = OTHER_COMMIT
        conflicting = json.dumps(projection, sort_keys=True, separators=(",", ":"))
        if validator_fn(gl.vm.Return(conflicting)) is False:
            raise RuntimeError("ERR_VALIDATOR_DISAGREEMENT")
        return leader

    monkeypatch.setattr(gl.vm, "run_nondet_unsafe", run)
    web_fixture(monkeypatch)
    with pytest.raises(Exception, match="ERR_VALIDATOR_DISAGREEMENT"):
        contract.assess_case("case-1")
    result = json.loads(contract.get_result("case-1"))
    assert result["outcome"] != OUTCOME_PROVENANCE_MATCH
    assert result["state"] == STATE_ASSESSING


def test_production_shaped_views_are_json_serializable():
    contract = new_contract()
    set_sender(OWNER)
    contract.create_case(
        "case-production-shaped",
        "npm",
        "@scope/release-proof",
        "1.2.3-beta.4+build.9",
        "https://registry.npmjs.org/@scope%2frelease-proof/1.2.3-beta.4+build.9",
        "acme",
        "tool",
        "https://github.com/acme/tool/releases/tag/1.2.3-beta.4+build.9",
        COMMIT,
        "packages/core",
    )
    case = json.loads(contract.get_case("case-production-shaped"))
    result = json.loads(contract.get_result("case-production-shaped"))
    page = json.loads(contract.get_page(0, 20))
    assert case["case_id"] == "case-production-shaped"
    assert case["package_name"] == "@scope/release-proof"
    assert case["expected_commit_id"] == COMMIT
    assert result["state"] == STATE_DRAFT
    assert page["offset"] == 0 and page["limit"] == 20
    assert page["items"][0]["case_id"] == "case-production-shaped"


def test_create_validation_rejects_short_commit_and_path_traversal():
    contract = new_contract()
    set_sender(OWNER)
    with pytest.raises(Exception, match="ERR_INVALID_COMMIT"):
        contract.create_case(*create_args(expected="a" * 39))
    with pytest.raises(Exception, match="ERR_INVALID_SOURCE_SUBDIRECTORY"):
        contract.create_case(*create_args(case_id="case-2", subdirectory="src/../private"))
