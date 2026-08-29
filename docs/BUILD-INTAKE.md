# Build intake — Package Release Provenance Consistency Register

## Baseline identity

- Category: `PROJECT`; non-economic.
- Product baseline: `STAGE-1.md` and `STAGE-2.md` in this Task folder.
- Current Stage 1 SHA-256: `E363CABF50950C6638F089A7E1FF7518F0B0F9B2410706E37D428A613E719ED7`.
- Current Stage 2 SHA-256: `020FAA53EFB62EFF1D8A525C9B0CB928E258E468A79DA5CD3A721D630504EC52`.
- Prior research approval found for the same product under the historical slug `public-package-release-provenance-consistency-register`: Stage 1 `74F726D417B7079A3B53DE64FA53E96353DB563800DBF685A7981C76194CC115`; Stage 2 `233F460F6003382FAF459DDCF763C2936C596ECD8183462AC602DFB010AEA21B`.
- Handoff status: product intent appears consistent, but the current files are not byte-identical to the approval-bound revisions. This remains an approval-provenance blocker until the exact revision is reconciled or independently re-approved.

## Current runtime check

- Checked 2026-08-30: Python `3.13.6`, Node `22.22.2`, npm `12.0.2`, `genvm-lint 0.11.0`.
- Existing runner bundle: `E:\Genlayer-Tools\GenVM\v0.3.0-rc7`, SHA-256 `E218A1854214681560351051F76FE2B878545CF3409455EF372D57014A88CA67`.
- Initial probe failed with `E101` because `py-genlayer:11rhn002yfajawsz7fai6mykznbxkxs6l91iskj5cm82c92qhy3v` was absent from the bundle.
- Minimal correction: use the documented/cached artifact `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.
- Corrected probe: `genvm-lint check .probe/probe_contract.py --json` passed AST lint and semantic validation, contract `ProbeContract`, 2 methods, 1 view, 1 write, zero constructor parameters.
- Informational warning: runner `1zr6nqk597d97kg0dyxg0shhrykx5v02zjgnyrajapy4wlqvfvwh` is newer; it does not override the passing pinned compatibility check.

## Stage 1/2 implementation adaptation

- Original choice: leave runtime spellings and dependency artifact to the later build probe.
- Verified problem: the first candidate artifact was not present in the installed GenVM runner archive; semantic validation could not load the SDK.
- Replacement: pin the artifact present in the official/current checked archive and documented contract examples, then re-run the probe.
- Preserved outcomes: one contract, one registry adapter, bounded provenance projection, same actors/state transitions/outcomes, no backend verdict or economic flow.
- Affected tests/evidence: add a source-header/dependency check and retain the exact lint/schema/semantic probe output; revalidate the dependency before PRE_DEPLOY.
- Residual risk: dependency/header and runner compatibility remain version-sensitive until the exact final contract passes the current Studio schema path.

## Applied Task Build Experience

- Git initialization before implementation: applied by initializing this repository before source work.
- Narrow GenVM test doubles: applicable to runtime-managed storage and address/calldata boundaries; production-shaped runtime values and negative unsupported-convenience tests are required.
- Evidence views reproduce the frozen decision boundary: applied to the frontend result decoder and contract `get_result` projection.
- Separate evidence unavailability from substantive denial: applied to the HTTP status taxonomy and `UNRESOLVED` path for `429`, `5xx`, malformed and ambiguous sources.
- Contract JSON/transaction receipts are untrusted: applied to lossless boundary parsing, one shared transaction classifier, and readback-before-success handling.
- EIP-6963 selected-provider routing: applicable to the required wallet chooser and provider-isolation regression matrix.
- Exact release identifiers from authoritative output: applied to generated hashes/addresses/transaction IDs in evidence records, never manual expansion.
- Specification result schema matches contract protocol: applied by keeping the result projection field-for-field identical across contract, frontend types, tests and evidence.
- GenVM runner pinning and text-runner prologue: applied to the pinned archive record, `# v0.1.0` header, and pre-PRE_DEPLOY schema probe.
- GenLayer finality from the GenLayer transaction object: applied to the shared frontend transaction reconciliation design; use `FINALIZED` plus semantic execution success and authoritative readback.
- Current SDK user errors: `gl.UserError` was rejected by the installed runtime; the contract now raises `gl.vm.UserError`, with a direct-mode regression for validation/rejection paths.
- Frontend implementation: static React/Vite app with project-local `genlayer-js==1.1.8`, EIP-6963 provider discovery, selected-provider writes, bounded transaction reconciliation, and contract readback.
- Frontend verification: `npm test` passed 2 files / 5 tests; `npm run build` passed; local HTTP smoke returned `200` for `/` and `/case/case-1` with SPA fallback. In-app browser visual inspection was attempted but unavailable because browser bootstrap failed before session creation (`failed to write kernel assets`); no visual acceptance is claimed.

## Official documentation checked

- Web access: https://docs.genlayer.com/developers/intelligent-contracts/features/web-access
- First Intelligent Contract: https://docs.genlayer.com/developers/intelligent-contracts/first-intelligent-contract
- Equivalence Principle: https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle
- Non-determinism: https://docs.genlayer.com/developers/intelligent-contracts/features/non-determinism
- GenVM linter: https://docs.genlayer.com/api-references/genlayer-linter
- GenLayerJS transactions: https://docs.genlayer.com/api-references/genlayer-js/transactions
- GenLayer transaction status: https://docs.genlayer.com/api-references/genlayer-node/gen/gen_getTransactionStatus
