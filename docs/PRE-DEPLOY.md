# PRE_DEPLOY package — Studio preparation

Status: `PENDING_ANONYMOUS_APPROVAL`

This package is for the current exact local revision. It is not a deployment receipt and contains no signing or transaction authorization.

## Identity

- Category: `PROJECT` (non-economic).
- Project: `Package Release Provenance Consistency Register`.
- Exact reviewed source revision: `801c72969755a840244d56f597de355f44138e42`.
- Exact reviewed source tree: `2f7c6915d5dc269b8317ec1bd9cdd97d88edfbc3`.
- The external reviewer package additionally binds this document set to the
  exact package commit; the source revision/tree above are the literal
  contract/frontend content identity used for review.
- Implementation lineage ancestor: `2b176faa812e3977f9563933daa5d903c8e42527`.
- Contract source: `contracts/package_release_provenance_consistency_register.py`.
- Contract source SHA-256: `5C5DA9E3E45F99B81E5AAF0647D5804761D157452B2036EA1DDF16F11783D34A`.
- Current Stage 1 SHA-256: `E363CABF50950C6638F089A7E1FF7518F0B0F9B2410706E37D428A613E719ED7`.
- Current Stage 2 SHA-256: `020FAA53EFB62EFF1D8A525C9B0CB928E258E468A79DA5CD3A721D630504EC52`.
- Historical research-approved Stage 1 SHA-256: `74F726D417B7079A3B53DE64FA53E96353DB563800DBF685A7981C76194CC115` (lineage; identity-renamed current file matches after reversing approved substitutions).
- Historical research-approved Stage 2 SHA-256: `233F460F6003382FAF459DDCF763C2936C596ECD8183462AC602DFB010AEA21B` (lineage; identity-renamed current file matches after reversing approved substitutions).

## Contract classification and planned deployment

- Classification: `INTENTIONALLY FROZEN`.
- User frozen-decision confirmation: received directly in this Task on 2026-09-01 — the contract has no upgrade path; a post-deployment defect requires deploying a new contract.
- Constructor arguments: none (`[]`).
- Linked contracts: none.
- Intended network: Studionet.
- Chain ID: `61999`.
- GenLayer RPC: `https://studio.genlayer.com/api`.
- Explorer: `https://explorer-studio.genlayer.com`.
- Selected Studio deployer account: `0x34b92E6553eaCA11A00A9d86d75d8a7881779D78`.
- Selected account role: deployer and owner of cases created during the primary Studio journey; no upgrade authority is claimed.
- Observed Studio balance at selection: `10.001 GEN`.
- Contract address for this exact source: `NOT YET CREATED`.
- Deployment transaction for this exact source: `NOT YET CREATED`.

The selected account and intended role were recorded without sending a transaction. If the account changes, identity/signing-dependent evidence must be revalidated before deployment.

## Exact-source package

- Header: `# v0.1.0` followed by the pinned `py-genlayer` dependency manifest.
- Pinned artifact: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.
- Runner archive checked: `E:\Genlayer-Tools\GenVM\v0.3.0-rc7`.
- Runner archive SHA-256: `E218A1854214681560351051F76FE2B878545CF3409455EF372D57014A88CA67`.
- Schema/lint result: `genvm-lint check contracts/package_release_provenance_consistency_register.py --json` passed; contract discovered with 8 methods, 4 views, 4 writes, and zero constructor parameters.
- Local contract tests: `gltest -q -p no:cacheprovider` — `15 passed`.
- Static checks: `ruff check contracts tests` — pass.
- Frontend tests/build: `npm test` — 22 passed across 4 files; `npm run build` — pass.
- Studio source loading: exact repaired contract file was loaded and parity-checked in GenLayer Studio on 2026-09-01.
- Superseded diagnostic deployment (not release evidence): address `0x11f6622863D71929c0bf30D6d984528f588486E5`, deployment transaction `0xe254a1c4129c2b99f67957bafc4b09d815d27d72ebbbc1d4cc998b019b2409f2`, and baseline `create_case` transaction `0x4a2975de652660689ef0a4b352e59236b723dbe34f9b57faf821f1ca365bc5a4` both finalized with successful consensus/execution. Authoritative `get_case`/`get_page` showed the stored `DRAFT` case, but `get_count` remained `0` instead of `1`; this deployment is rejected and will not be used by the frontend or release.
- Live repair: the persisted `case_count` constructor initialization changed from plain `0` to typed `u8(0)`, with a regression asserting both `get_count=1` and the case-page readback after creation. Fresh PRE_DEPLOY approval and a new frozen deployment are required.
- Second superseded diagnostic deployment (not release evidence): repaired-source address `0xB0886861d5b5e67dce4540ce6D3451e29Dc2A17f`, deployment transaction `0x3223ca0790de393405518f22aed50f1c093920b75cd20a5420841e962f2f1406`, and E5 `create_case` transaction `0x200fcbbb4df7489a80782bbcfcb7c8458cd31e15176c5747bdcce120b1e58746` finalized with consensus but leader `ERROR` because `ERR_DUPLICATE_PROVENANCE`. The bounded diagnosis found `release_url` was missing from the duplicate identity key; this deployment is also rejected and will not be used by the frontend or release.
- Live repair 2: the duplicate identity key now includes the canonical `release_url`; a regression proves distinct release tags can coexist while the exact full provenance remains duplicate-rejected. Fresh PRE_DEPLOY approval and a new frozen deployment are required.
- Release-tag correction: create accepts a bounded canonical GitHub release-tag URL; assessment enforces the specified `version`/`v+version` match and exposes `VERSION_TAG_MISMATCH`. This preserves the advertised outcome path without changing the public API.
- Wallet picker verification: the functional picker shows only available supported wallets, makes zero account requests on open/cancel/Escape/reload, requests only the explicitly selected provider, keeps rejection inline, and invalidates on disconnect/account/network change. Browser inspection confirmed the public no-provider state; live injected-wallet option rendering remains pending Studio/Vercel evidence.
- Claude frontend redesign: Codex reviewed and integrated the bounded redesign plus public-language and form-accessibility corrections. The repair revision adds final-state readback, consensus-result gating, balance preflight, registry identity validation, in-flight write locking, and regression coverage; frontend regression/build and contract/runtime verification were rerun at the exact package revision above.

Known warnings and deviations: the linter reports a newer runner is available;
the pinned compatible runner and archive digest are retained. gltest also
reports that gltest.config.yaml is absent and therefore uses its default
localnet configuration; this is an offline direct-harness limitation, not
Studionet evidence, and the production gate remains Studio lifecycle proof.
Neither warning is suppressed.

## Trust and state inventory

### Complete storage, ABI and nondeterminism inventory

- Storage: `cases: TreeMap[str, ReleaseCase]` is keyed by `case_id`;
  `duplicate_keys: TreeMap[str, str]` is keyed by
  `ecosystem|package_name|version|repository_owner/repository_name|release_url|expected_commit_id`;
  `case_count: u8` is bounded by `MAX_CASES=128`. `ReleaseCase` stores
  `owner: Address`, the string fields `ecosystem`, `package_name`,
  `version`, `registry_url`, `repository_owner`, `repository_name`,
  `release_url`, `expected_commit_id`, `source_subdirectory`, `state`,
  `outcome`, `observed_repository`, `observed_tag`,
  `observed_commit_id`, `evidence_digest`, and `retry_count: u8`.
  Bounds are `MAX_TEXT=64`, `MAX_URL=512`, `MAX_SUBDIRECTORY=128`,
  `MAX_RESPONSE=131072`, `PAGE_SIZE=20`, and `MAX_RETRIES=2`.
- Writes: `create_case(case_id, ecosystem, package_name, version, registry_url,
  repository_owner, repository_name, release_url, expected_commit_id,
  source_subdirectory)` creates `DRAFT`, stores the sender as `owner`,
  lowercases repository identity, and rejects duplicate provenance.
  `freeze_case(case_id)` is owner-only and transitions `DRAFT -> FROZEN`.
  `assess_case(case_id)` accepts `FROZEN` or `RETRYING`, stores the stable
  projection/digest and observed fields, then transitions to `RESOLVED` or
  `UNRESOLVED`. `retry_unresolved(case_id)` allows at most two retries.
  Errors include the invalid-input, duplicate, ownership, state and retry
  codes implemented in the contract.
- Views: `get_case(case_id)` returns the complete JSON case projection plus
  `case_id`; `get_result(case_id)` returns state/outcome, observed
  repository/tag/commit, source path, digest and retry count; `get_count()`
  returns `u8`; `get_page(offset, limit)` returns
  `{offset, limit, items}` with complete case projections and requires
  `1 <= limit <= PAGE_SIZE`. Addresses render through `Address.as_hex`;
  repository identities are canonical lowercase `owner/name`; commit IDs
  are lowercase 40-hex strings.
- Nondeterminism: `assess_case` calls
  `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`. Both callbacks make
  bounded `gl.nondet.web.get` calls to the canonical npm registry URL,
  GitHub tag/ref API, optional annotated-tag API and recursive Git tree API.
  Only HTTP 200 JSON objects within `MAX_RESPONSE` are accepted. The stable
  projection contains ecosystem, package/version, repository, release tag,
  commit, source subdirectory and outcome. The validator recomputes it and
  requires byte-equal canonical JSON; disagreement is not accepted. Transport
  errors, malformed JSON, wrong package identity/version, unsupported links,
  missing paths, invalid refs and non-commit targets resolve to
  `UNRESOLVED`. No raw response, unconstrained prose, provider detail, RPC
  detail or backend verdict is persisted.

- Stored record: `ReleaseCase` with owner, canonical package/repository identity, expected commit, source subdirectory, bounded state/outcome, observed provenance, evidence digest and retry count.
- Writes: `create_case`, `freeze_case`, `assess_case`, `retry_unresolved`.
- Views: `get_case`, `get_result`, `get_count`, `get_page`.
- Nondeterministic boundary: leader and validator independently retrieve bounded npm/GitHub structured evidence and compare the canonical projection; transport/malformed/ambiguous evidence resolves to `UNRESOLVED`.
- No raw upstream response or unconstrained prose is persisted.
- No payment, value transfer, linked contract, upgrade path or backend verdict exists.
- The disagreement regression injects the runtime rejection boundary in the
  direct harness and verifies no terminal success; production GenVM transaction
  rollback is the authoritative state-safety control for an uncaught consensus
  disagreement, so the case cannot be accepted from that transaction.
- Write preflight requires the selected account to remain active on Studionet
  and requires at least 0.001 GEN (`1000000000000000` wei) spendable balance
  before consequential writes. Transaction polling keeps the same write
  reconciled through transient status failures with bounded retry/backoff.

## Smallest sufficient Studio matrix

The following rows are the planned live proof matrix. Each row must receive actual transaction/lifecycle/consensus/readback evidence after PRE_DEPLOY approval; no row is yet passed.

| ID | Risk/criterion | Account/role | Method | Expected proof |
|---|---|---|---|---|
| S1 | Valid registration creates an owner-bound draft | selected deployer / registrant | `create_case` with exact non-secret npm/GitHub arguments | `FINALIZED`, execution success, count + `get_case` show `DRAFT` and exact canonical fields |
| S2 | Unauthorized freeze is rejected without mutation | second Studio account / unauthorized caller | `freeze_case(S1)` | finalized expected rejection, consensus/finality recorded, `get_case` remains `DRAFT` |
| S3 | Owner freeze is authorized | selected deployer / owner | `freeze_case(S1)` | `FINALIZED`, execution success, `get_result` shows `FROZEN` |
| S4 | Exact release provenance reaches substantive match | selected deployer / permissionless assessor | `assess_case(S1)` | `FINALIZED`, leader execution success, consensus agreement, `PROVENANCE_MATCH` readback with digest/observed commit |
| S5 | Upstream unavailability is fail-closed and retry is bounded | selected deployer / registrant | fresh valid case with unavailable registry fixture, then `assess_case`, `retry_unresolved` | `UNRESOLVED` readback, one retry transition, no false substantive denial; no third retry |
| S6 | Version tag mismatch is classified | selected deployer / permissionless assessor | fresh case with same package/version but release URL tag `9.9.9`, then `assess_case` | `FINALIZED`, semantic success, `VERSION_TAG_MISMATCH` readback |
| S7 | Repository mismatch is classified | selected deployer / permissionless assessor | fresh case with registry repository `other/tool`, then `assess_case` | `FINALIZED`, semantic success, `REPOSITORY_MISMATCH` readback |
| S8 | Commit mismatch is classified | selected deployer / permissionless assessor | fresh case with valid registry/repository/tag but wrong expected commit, then `assess_case` | `FINALIZED`, semantic success, `COMMIT_MISMATCH` readback |
| S9 | Missing source link is classified | selected deployer / permissionless assessor | fresh case with malformed/missing registry repository link, then `assess_case` | `FINALIZED`, semantic success, `SOURCE_LINK_MISSING` readback |
| S10 | Duplicate provenance and malformed boundaries are rejected | selected deployer / registrant | duplicate `create_case` and invalid-argument controls | expected rejections with unchanged count/readback; deterministic boundary cases remain covered locally |

Every attempted row, including failure, must be retained in the final secret-free evidence ledger. A transaction is not a pass from a button click, submission hash, `FINALIZED` alone, or UI label; it requires execution result, consensus/finality and authoritative readback.

## Blocking items before Studio signing

1. Anonymous `PRE_DEPLOY` verdict is not yet present. No signature, deployment transaction or contract write may be sent until the exact package receives the checkpoint approval required by governance.
2. Anonymous approval of the exact detailed E2E plan is required before any Studio write transaction.
3. The in-app browser is available for Studio operation; visual evidence and live transaction evidence remain outstanding by design.

## Recovery boundary

This is an intentionally frozen prototype. If the Studionet or Studio state is reset, the deployed address/state cannot be recovered; redeployment requires the exact recorded source commit/hash and constructor manifest, followed by a fresh Studio matrix. No upgrade authority or post-deployment code replacement is advertised.
