# Local verification record

Recorded: 2026-08-30

This is local build evidence only. It is not a PRE_DEPLOY approval, deployment receipt, live transaction record, or release approval.

## Exact identity

- Git commit containing the implementation and prior build-intake record: `b9094282bcf4a995a1563303838d98787e71b27e`.
- Git tree at that commit: `9662c8de077982d32ce4eb35432c493e6cec4e88`.
- Contract source: `contracts/package_release_provenance_consistency_register.py`.
- Contract source SHA-256: `628FD6922D9F41BE4254BB5AA25D83671521179622F8236555240BC5212D3106`.
- Current Stage 1 SHA-256: `E363CABF50950C6638F089A7E1FF7518F0B0F9B2410706E37D428A613E719ED7`.
- Current Stage 2 SHA-256: `020FAA53EFB62EFF1D8A525C9B0CB928E258E468A79DA5CD3A721D630504EC52`.
- Historical approval-bound Stage 1 SHA-256: `74F726D417B7079A3B53DE64FA53E96353DB563800DBF685A7981C76194CC115`.
- Historical approval-bound Stage 2 SHA-256: `233F460F6003382FAF459DDCF763C2936C596ECD8183462AC602DFB010AEA21B`.

The current Stage files do not match the historical approval-bound hashes. The implementation therefore remains blocked from PRE_DEPLOY until the exact revision is reconciled or independently re-approved.

## Runtime and dependency evidence

- Python: `3.13.6`.
- Node: `22.22.2`.
- npm: `12.0.2`.
- `genvm-lint`: `0.11.0`.
- GenLayer Python SDK: `0.16.3`.
- GenLayerJS: `1.1.8`.
- Pinned contract runner: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.
- Checked runner archive: `E:\Genlayer-Tools\GenVM\v0.3.0-rc7`, SHA-256 `E218A1854214681560351051F76FE2B878545CF3409455EF372D57014A88CA67`.

## Verification results

From the repository root:

```text
genvm-lint check contracts/package_release_provenance_consistency_register.py --json
{"ok":true,"lint":{"ok":true,"passed":3},"validate":{"ok":true,"contract":"PackageReleaseProvenanceConsistencyRegister","methods":8,"view_methods":4,"write_methods":4,"ctor_params":0}

ruff check contracts tests
All checks passed!

PYTHONIOENCODING=utf-8 gltest -q -p no:cacheprovider
9 passed in 0.09s
```

From `frontend`:

```text
npm test
Test Files  2 passed (2)
Tests       5 passed (5)

npm run build
465 modules transformed.
built successfully
```

The frontend build reports a non-blocking Vite chunk-size warning for the GenLayerJS bundle. Local HTTP smoke returned `200` for `/` and `/case/case-1`, including SPA fallback. In-app browser bootstrap failed before a session was created (`failed to write kernel assets`), so no visual browser acceptance is claimed.

## Release boundary

No Studio deployment, wallet signing, live transaction, GitHub push, Vercel deployment, user Vercel E2E, or anonymous review checkpoint has been performed in this local build turn.
