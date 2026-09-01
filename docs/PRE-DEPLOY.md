# PRE_DEPLOY package — Studio preparation

Status: `BLOCKED_PENDING_ANONYMOUS_APPROVAL`

This package is for the current exact local revision. It is not a deployment receipt and contains no signing or transaction authorization.

## Identity

- Category: `PROJECT` (non-economic).
- Project: `Package Release Provenance Consistency Register`.
- Exact Git commit: `44e7ff40e081c82593a31d62b2def3ec6510911f`.
- Exact Git tree: `c1e78bb437fc6b6804f2b02cb1bd9c20347b2d7d`.
- Contract source: `contracts/package_release_provenance_consistency_register.py`.
- Contract source SHA-256: `628FD6922D9F41BE4254BB5AA25D83671521179622F8236555240BC5212D3106`.
- Current Stage 1 SHA-256: `E363CABF50950C6638F089A7E1FF7518F0B0F9B2410706E37D428A613E719ED7`.
- Current Stage 2 SHA-256: `020FAA53EFB62EFF1D8A525C9B0CB928E258E468A79DA5CD3A721D630504EC52`.
- Historical research-approved Stage 1 SHA-256: `74F726D417B7079A3B53DE64FA53E96353DB563800DBF685A7981C76194CC115`.
- Historical research-approved Stage 2 SHA-256: `233F460F6003382FAF459DDCF763C2936C596ECD8183462AC602DFB010AEA21B`.

## Contract classification and planned deployment

- Classification: `INTENTIONALLY FROZEN`.
- Constructor arguments: none (`[]`).
- Linked contracts: none.
- Intended network: Studionet.
- Chain ID: `61999`.
- GenLayer RPC: `https://studio.genlayer.com/api`.
- Explorer: `https://explorer-studio.genlayer.com`.
- Selected Studio deployer account: `0x34b92E6553eaCA11A00A9d86d75d8a7881779D78`.
- Selected account role: deployer and owner of cases created during the primary Studio journey; no upgrade authority is claimed.
- Observed Studio balance at selection: `10.001 GEN`.
- Contract address: `NOT YET CREATED`.
- Deployment transaction: `NOT YET CREATED`.

The selected account and intended role were recorded without sending a transaction. If the account changes, identity/signing-dependent evidence must be revalidated before deployment.

## Exact-source package

- Header: `# v0.1.0` followed by the pinned `py-genlayer` dependency manifest.
- Pinned artifact: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.
- Runner archive checked: `E:\Genlayer-Tools\GenVM\v0.3.0-rc7`.
- Runner archive SHA-256: `E218A1854214681560351051F76FE2B878545CF3409455EF372D57014A88CA67`.
- Schema/lint result: `genvm-lint check contracts/package_release_provenance_consistency_register.py --json` passed; contract discovered with 8 methods, 4 views, 4 writes, and zero constructor parameters.
- Local contract tests: `gltest -q -p no:cacheprovider` — `9 passed`.
- Static checks: `ruff check contracts tests` — pass.
- Frontend tests/build: `npm test` — 5 passed; `npm run build` — pass.
- Studio source loading: exact contract file loaded into GenLayer Studio on 2026-09-01; no deployment or write transaction sent.

Known version-sensitive warning: the linter reports a newer runner is available. The pinned compatible runner and archive digest are retained; the warning is documented, not suppressed.

## Trust and state inventory

- Stored record: `ReleaseCase` with owner, canonical package/repository identity, expected commit, source subdirectory, bounded state/outcome, observed provenance, evidence digest and retry count.
- Writes: `create_case`, `freeze_case`, `assess_case`, `retry_unresolved`.
- Views: `get_case`, `get_result`, `get_count`, `get_page`.
- Nondeterministic boundary: leader and validator independently retrieve bounded npm/GitHub structured evidence and compare the canonical projection; transport/malformed/ambiguous evidence resolves to `UNRESOLVED`.
- No raw upstream response or unconstrained prose is persisted.
- No payment, value transfer, linked contract, upgrade path or backend verdict exists.

## Smallest sufficient Studio matrix

The following rows are the planned live proof matrix. Each row must receive actual transaction/lifecycle/consensus/readback evidence after PRE_DEPLOY approval; no row is yet passed.

| ID | Risk/criterion | Account/role | Method | Expected proof |
|---|---|---|---|---|
| S1 | Valid registration creates an owner-bound draft | selected deployer / registrant | `create_case` with exact non-secret npm/GitHub arguments | `FINALIZED`, execution success, count + `get_case` show `DRAFT` and exact canonical fields |
| S2 | Unauthorized freeze is rejected without mutation | second Studio account / unauthorized caller | `freeze_case(S1)` | finalized expected rejection, consensus/finality recorded, `get_case` remains `DRAFT` |
| S3 | Owner freeze is authorized | selected deployer / owner | `freeze_case(S1)` | `FINALIZED`, execution success, `get_result` shows `FROZEN` |
| S4 | Exact release provenance reaches substantive match | selected deployer / permissionless assessor | `assess_case(S1)` | `FINALIZED`, leader execution success, consensus agreement, `PROVENANCE_MATCH` readback with digest/observed commit |
| S5 | Upstream unavailability is fail-closed and retry is bounded | selected deployer / registrant | fresh valid case with unavailable registry fixture, then `assess_case`, `retry_unresolved` | `UNRESOLVED` readback, one retry transition, no false substantive denial; no third retry |
| S6 | Duplicate provenance and malformed boundaries are rejected | selected deployer / registrant | duplicate `create_case` and invalid-argument controls | expected rejections with unchanged count/readback; deterministic boundary cases remain covered locally |

Every attempted row, including failure, must be retained in the final secret-free evidence ledger. A transaction is not a pass from a button click, submission hash, `FINALIZED` alone, or UI label; it requires execution result, consensus/finality and authoritative readback.

## Blocking items before Studio signing

1. Current Stage 1/2 files do not match the historical research-approved exact hashes. The current revision must be reconciled to those bytes or independently re-approved as the current specification baseline.
2. Anonymous `PRE_DEPLOY` verdict is not yet present. No signature, deployment transaction or contract write may be sent until the exact package receives the checkpoint approval required by governance.
3. The in-app browser is available now for Studio operation; visual evidence and live transaction evidence remain outstanding by design.

## Recovery boundary

This is an intentionally frozen prototype. If the Studionet or Studio state is reset, the deployed address/state cannot be recovered; redeployment requires the exact recorded source commit/hash and constructor manifest, followed by a fresh Studio matrix. No upgrade authority or post-deployment code replacement is advertised.
