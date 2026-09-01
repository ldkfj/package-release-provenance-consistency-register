# v0.1.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
import typing
from dataclasses import dataclass

from genlayer import *

MAX_CASES = 128
PAGE_SIZE = 20
MAX_TEXT = 64
MAX_URL = 512
MAX_SUBDIRECTORY = 128
MAX_RESPONSE = 131072
MAX_RETRIES = 2

STATE_DRAFT = "DRAFT"
STATE_FROZEN = "FROZEN"
STATE_ASSESSING = "ASSESSING"
STATE_RESOLVED = "RESOLVED"
STATE_UNRESOLVED = "UNRESOLVED"
STATE_RETRYING = "RETRYING"

OUTCOME_NONE = ""
OUTCOME_PROVENANCE_MATCH = "PROVENANCE_MATCH"
OUTCOME_REPOSITORY_MISMATCH = "REPOSITORY_MISMATCH"
OUTCOME_VERSION_TAG_MISMATCH = "VERSION_TAG_MISMATCH"
OUTCOME_COMMIT_MISMATCH = "COMMIT_MISMATCH"
OUTCOME_SOURCE_LINK_MISSING = "SOURCE_LINK_MISSING"
OUTCOME_UNRESOLVED = "UNRESOLVED"

NPM_REGISTRY_PREFIX = "https://registry.npmjs.org/"
GITHUB_REPO_PREFIX = "https://github.com/"
GITHUB_API_PREFIX = "https://api.github.com/repos/"


@allow_storage
@dataclass
class ReleaseCase:
    owner: Address
    ecosystem: str
    package_name: str
    version: str
    registry_url: str
    repository_owner: str
    repository_name: str
    release_url: str
    expected_commit_id: str
    source_subdirectory: str
    state: str
    outcome: str
    observed_repository: str
    observed_tag: str
    observed_commit_id: str
    evidence_digest: str
    retry_count: u8


def _fail(message: str) -> typing.NoReturn:
    raise gl.vm.UserError(message)


def _bounded_text(value: str, maximum: int) -> bool:
    return isinstance(value, str) and 0 < len(value) <= maximum


def _is_lower_hex_commit(value: str) -> bool:
    if len(value) != 40 or value.lower() != value:
        return False
    for char in value:
        if char not in "0123456789abcdef":
            return False
    return True


def _valid_npm_package(value: str) -> bool:
    if not _bounded_text(value, 64) or value != value.strip():
        return False
    if value.startswith("@"):
        parts = value[1:].split("/")
        return len(parts) == 2 and all(_valid_npm_part(part) for part in parts)
    return _valid_npm_part(value)


def _valid_npm_part(value: str) -> bool:
    if not value or value.startswith((".", "_")):
        return False
    for char in value:
        if not (char.isalnum() or char in "._-"):
            return False
    return True


def _valid_version(value: str) -> bool:
    if not _bounded_text(value, MAX_TEXT) or value != value.strip():
        return False
    for char in value:
        if not (char.isalnum() or char in ".+-"):
            return False
    return True


def _normalize_subdirectory(value: str) -> str:
    if not isinstance(value, str) or len(value) > MAX_SUBDIRECTORY:
        _fail("ERR_INVALID_SOURCE_SUBDIRECTORY")
    normalized = value.strip("/")
    if normalized == "." or ".." in normalized.split("/"):
        _fail("ERR_INVALID_SOURCE_SUBDIRECTORY")
    return normalized


def _repo_identity(owner: str, name: str) -> str:
    if not _valid_npm_part(owner.lower()) or not _valid_npm_part(name.lower()):
        _fail("ERR_INVALID_REPOSITORY")
    return owner.lower() + "/" + name.lower()


def _canonical_registry_url(package_name: str, version: str) -> str:
    encoded_name = package_name.replace("/", "%2f")
    return NPM_REGISTRY_PREFIX + encoded_name + "/" + version


def _valid_release_url(owner: str, name: str, value: str) -> bool:
    prefix = GITHUB_REPO_PREFIX + owner + "/" + name + "/releases/tag/"
    if not isinstance(value, str) or len(value) > MAX_URL or not value.startswith(prefix):
        return False
    tag = value[len(prefix):]
    return _valid_version(tag) and "/" not in tag and "?" not in tag and "#" not in tag


def _parse_repo_url(value: typing.Any) -> str:
    if not isinstance(value, str):
        return ""
    url = value.strip()
    url = url.removeprefix("git+").removesuffix(".git")
    if not url.startswith(GITHUB_REPO_PREFIX):
        return ""
    path = url[len(GITHUB_REPO_PREFIX):].split("?", 1)[0].split("#", 1)[0].strip("/")
    parts = path.split("/")
    if len(parts) != 2:
        return ""
    owner = parts[0].lower()
    name = parts[1].lower()
    return owner + "/" + name if _valid_npm_part(owner) and _valid_npm_part(name) else ""


def _response_status(response: typing.Any) -> int:
    status = getattr(response, "status_code", None)
    if status is None:
        status = getattr(response, "status", None)
    return status if isinstance(status, int) and not isinstance(status, bool) else 0


def _fetch_json(url: str) -> typing.Any:
    try:
        response = gl.nondet.web.get(url)
    except Exception:  # noqa: BLE001 — every transport exception is unresolved evidence.
        return {"ok": False, "reason": OUTCOME_UNRESOLVED}
    status = _response_status(response)
    body = getattr(response, "body", b"")
    if not isinstance(body, bytes) or len(body) > MAX_RESPONSE:
        return {"ok": False, "reason": OUTCOME_UNRESOLVED}
    if status in (429,) or status >= 500 or status == 0:
        return {"ok": False, "reason": OUTCOME_UNRESOLVED}
    if status != 200:
        return {"ok": False, "reason": OUTCOME_UNRESOLVED}
    try:
        value = json.loads(body.decode("utf-8"))
    except ValueError:
        return {"ok": False, "reason": OUTCOME_UNRESOLVED}
    return value if isinstance(value, dict) else {"ok": False, "reason": OUTCOME_UNRESOLVED}


def _tag_from_release_url(release_url: str) -> str:
    marker = "/releases/tag/"
    if marker not in release_url:
        return ""
    tag = release_url.split(marker, 1)[1]
    return tag.split("/", 1)[0]


def _tree_contains(tree: typing.Any, subdirectory: str) -> bool:
    if not subdirectory:
        return True
    entries = tree.get("tree") if isinstance(tree, dict) else None
    if not isinstance(entries, list):
        return False
    for entry in entries:
        if isinstance(entry, dict) and entry.get("path") == subdirectory and entry.get("type") == "tree":
            return True
    return False


def _stable_projection(
    ecosystem: str,
    package_name: str,
    version: str,
    registry_url: str,
    repository_owner: str,
    repository_name: str,
    release_url: str,
    expected_commit_id: str,
    source_subdirectory: str,
) -> dict[str, typing.Any]:
    registry = _fetch_json(registry_url)
    registry_version = registry.get("version") if isinstance(registry, dict) else None
    repository_value = registry.get("repository") if isinstance(registry, dict) else None
    if isinstance(repository_value, dict):
        repository_value = repository_value.get("url")
    observed_repository = _parse_repo_url(repository_value)
    base = {
        "ecosystem": ecosystem,
        "package_name": package_name,
        "version": version,
        "repository_owner": repository_owner,
        "repository_name": repository_name,
        "release_tag": _tag_from_release_url(release_url),
        "commit_id": "",
        "source_subdirectory": source_subdirectory,
    }
    if not isinstance(registry, dict) or registry.get("ok") is False:
        base["outcome"] = OUTCOME_UNRESOLVED
        return base
    if not observed_repository:
        base["outcome"] = OUTCOME_SOURCE_LINK_MISSING
        return base
    if registry_version != version:
        base["outcome"] = OUTCOME_VERSION_TAG_MISMATCH
        base["observed_repository"] = observed_repository
        return base
    frozen_repository = repository_owner + "/" + repository_name
    if observed_repository != frozen_repository:
        base["outcome"] = OUTCOME_REPOSITORY_MISMATCH
        base["observed_repository"] = observed_repository
        return base

    tag = base["release_tag"]
    if tag not in (version, "v" + version):
        base["outcome"] = OUTCOME_VERSION_TAG_MISMATCH
        base["observed_repository"] = observed_repository
        return base
    ref = _fetch_json(GITHUB_API_PREFIX + frozen_repository + "/git/ref/tags/" + tag)
    if not isinstance(ref, dict) or ref.get("ok") is False:
        base["outcome"] = OUTCOME_UNRESOLVED
        base["observed_repository"] = observed_repository
        return base
    target = ref.get("object")
    if not isinstance(target, dict):
        base["outcome"] = OUTCOME_UNRESOLVED
        base["observed_repository"] = observed_repository
        return base
    observed_commit = target.get("sha") if target.get("type") == "commit" else ""
    if target.get("type") == "tag":
        annotated = _fetch_json(GITHUB_API_PREFIX + frozen_repository + "/git/tags/" + str(target.get("sha", "")))
        annotated_target = annotated.get("object") if isinstance(annotated, dict) else None
        observed_commit = annotated_target.get("sha") if isinstance(annotated_target, dict) and annotated_target.get("type") == "commit" else ""
    if not _is_lower_hex_commit(observed_commit):
        base["outcome"] = OUTCOME_UNRESOLVED
        base["observed_repository"] = observed_repository
        return base
    tree = _fetch_json(GITHUB_API_PREFIX + frozen_repository + "/git/trees/" + observed_commit + "?recursive=1")
    if not _tree_contains(tree, source_subdirectory):
        base["outcome"] = OUTCOME_UNRESOLVED
        base["observed_repository"] = observed_repository
        base["commit_id"] = observed_commit
        return base
    base["observed_repository"] = observed_repository
    base["commit_id"] = observed_commit
    if observed_commit != expected_commit_id:
        base["outcome"] = OUTCOME_COMMIT_MISMATCH
    else:
        base["outcome"] = OUTCOME_PROVENANCE_MATCH
    return base


def _encode_projection(projection: dict[str, typing.Any]) -> str:
    return json.dumps(projection, sort_keys=True, separators=(",", ":"))


def _view(case_id: str, case: ReleaseCase) -> dict[str, typing.Any]:
    return {
        "case_id": case_id,
        "owner": case.owner.as_hex,
        "ecosystem": case.ecosystem,
        "package_name": case.package_name,
        "version": case.version,
        "registry_url": case.registry_url,
        "repository_owner": case.repository_owner,
        "repository_name": case.repository_name,
        "release_url": case.release_url,
        "expected_commit_id": case.expected_commit_id,
        "source_subdirectory": case.source_subdirectory,
        "state": case.state,
        "outcome": case.outcome,
        "observed_repository": case.observed_repository,
        "observed_tag": case.observed_tag,
        "observed_commit_id": case.observed_commit_id,
        "evidence_digest": case.evidence_digest,
        "retry_count": case.retry_count,
    }


class PackageReleaseProvenanceConsistencyRegister(gl.Contract):
    cases: TreeMap[str, ReleaseCase]
    duplicate_keys: TreeMap[str, str]
    case_count: u8

    def __init__(self):
        self.case_count = 0

    def _sender(self) -> Address:
        return gl.message.sender_address

    @gl.public.write
    def create_case(
        self,
        case_id: str,
        ecosystem: str,
        package_name: str,
        version: str,
        registry_url: str,
        repository_owner: str,
        repository_name: str,
        release_url: str,
        expected_commit_id: str,
        source_subdirectory: str,
    ) -> typing.Any:
        if self.case_count >= MAX_CASES or not _bounded_text(case_id, MAX_TEXT):
            _fail("ERR_CASE_LIMIT_OR_ID")
        if case_id in self.cases:
            _fail("ERR_DUPLICATE_CASE")
        if ecosystem != "npm" or not _valid_npm_package(package_name) or not _valid_version(version):
            _fail("ERR_INVALID_PACKAGE")
        if registry_url != _canonical_registry_url(package_name, version) or len(registry_url) > MAX_URL:
            _fail("ERR_INVALID_REGISTRY_URL")
        owner = repository_owner.lower()
        name = repository_name.lower()
        frozen_repository = _repo_identity(owner, name)
        if not _valid_release_url(owner, name, release_url):
            _fail("ERR_INVALID_RELEASE_URL")
        if not _is_lower_hex_commit(expected_commit_id):
            _fail("ERR_INVALID_COMMIT")
        normalized_subdirectory = _normalize_subdirectory(source_subdirectory)
        duplicate_key = ecosystem + "|" + package_name + "|" + version + "|" + frozen_repository + "|" + expected_commit_id
        if duplicate_key in self.duplicate_keys:
            _fail("ERR_DUPLICATE_PROVENANCE")
        self.cases[case_id] = gl.storage.inmem_allocate(
            ReleaseCase,
            self._sender(),
            ecosystem,
            package_name,
            version,
            registry_url,
            owner,
            name,
            release_url,
            expected_commit_id,
            normalized_subdirectory,
            STATE_DRAFT,
            OUTCOME_NONE,
            "",
            "",
            "",
            "",
            0,
        )
        self.duplicate_keys[duplicate_key] = case_id
        self.case_count += 1

    @gl.public.write
    def freeze_case(self, case_id: str) -> typing.Any:
        case = self.cases[case_id]
        if case.owner != self._sender():
            _fail("ERR_NOT_OWNER")
        if case.state != STATE_DRAFT:
            _fail("ERR_INVALID_STATE")
        case.state = STATE_FROZEN

    @gl.public.write
    def assess_case(self, case_id: str) -> typing.Any:
        case = self.cases[case_id]
        if case.state not in (STATE_FROZEN, STATE_RETRYING):
            _fail("ERR_INVALID_STATE")
        case.state = STATE_ASSESSING
        ecosystem = case.ecosystem
        package_name = case.package_name
        version = case.version
        registry_url = case.registry_url
        repository_owner = case.repository_owner
        repository_name = case.repository_name
        release_url = case.release_url
        expected_commit_id = case.expected_commit_id
        source_subdirectory = case.source_subdirectory

        def leader_fn() -> str:
            return _encode_projection(_stable_projection(
                ecosystem,
                package_name,
                version,
                registry_url,
                repository_owner,
                repository_name,
                release_url,
                expected_commit_id,
                source_subdirectory,
            ))

        def validator_fn(leader_result: gl.vm.Result) -> bool:
            if not isinstance(leader_result, gl.vm.Return) or not isinstance(leader_result.calldata, str):
                return False
            own = _encode_projection(_stable_projection(
                ecosystem,
                package_name,
                version,
                registry_url,
                repository_owner,
                repository_name,
                release_url,
                expected_commit_id,
                source_subdirectory,
            ))
            return own == leader_result.calldata

        agreed = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        projection = json.loads(agreed)
        case.outcome = projection.get("outcome", OUTCOME_UNRESOLVED)
        case.observed_repository = projection.get("observed_repository", "")
        case.observed_tag = projection.get("release_tag", "")
        case.observed_commit_id = projection.get("commit_id", "")
        digest = Keccak256(agreed.encode("utf-8")).digest().hex()
        case.evidence_digest = digest
        case.state = STATE_UNRESOLVED if case.outcome == OUTCOME_UNRESOLVED else STATE_RESOLVED

    @gl.public.write
    def retry_unresolved(self, case_id: str) -> typing.Any:
        case = self.cases[case_id]
        if case.state != STATE_UNRESOLVED or case.retry_count >= MAX_RETRIES:
            _fail("ERR_RETRY_NOT_ALLOWED")
        case.retry_count += 1
        case.state = STATE_RETRYING

    @gl.public.view
    def get_case(self, case_id: str) -> str:
        return _encode_projection(_view(case_id, self.cases[case_id]))

    @gl.public.view
    def get_result(self, case_id: str) -> str:
        case = self.cases[case_id]
        return _encode_projection({
            "case_id": case_id,
            "state": case.state,
            "outcome": case.outcome,
            "observed_repository": case.observed_repository,
            "observed_tag": case.observed_tag,
            "observed_commit_id": case.observed_commit_id,
            "source_subdirectory": case.source_subdirectory,
            "evidence_digest": case.evidence_digest,
            "retry_count": case.retry_count,
        })

    @gl.public.view
    def get_count(self) -> u8:
        return self.case_count

    @gl.public.view
    def get_page(self, offset: u8, limit: u8) -> str:
        if limit == 0 or limit > PAGE_SIZE:
            _fail("ERR_INVALID_PAGE")
        rows = []
        for index, (case_id, case) in enumerate(self.cases.items()):
            if index >= offset and len(rows) < limit:
                rows.append(_view(case_id, case))
            if len(rows) == limit:
                break
        return _encode_projection({"offset": offset, "limit": limit, "items": rows})
