# Local verification record

Recorded: 2026-09-01

This is local build evidence only. It is not a PRE_DEPLOY approval, deployment receipt, live transaction record, or release approval.

## Exact identity

- Exact reviewed source revision: `801c72969755a840244d56f597de355f44138e42`.
- Exact reviewed source tree: `2f7c6915d5dc269b8317ec1bd9cdd97d88edfbc3`.
- The external reviewer package binds the verification record to the exact
  package commit; these literal values identify the reviewed source content.
- Implementation lineage ancestor: `2b176faa812e3977f9563933daa5d903c8e42527`.
- Contract source: `contracts/package_release_provenance_consistency_register.py`.
- Contract source SHA-256: `5C5DA9E3E45F99B81E5AAF0647D5804761D157452B2036EA1DDF16F11783D34A`.
- Current Stage 1 SHA-256: `E363CABF50950C6638F089A7E1FF7518F0B0F9B2410706E37D428A613E719ED7`.
- Current Stage 2 SHA-256: `020FAA53EFB62EFF1D8A525C9B0CB928E258E468A79DA5CD3A721D630504EC52`.
- Historical approval-bound Stage 1 SHA-256: `74F726D417B7079A3B53DE64FA53E96353DB563800DBF685A7981C76194CC115`.
- Historical approval-bound Stage 2 SHA-256: `233F460F6003382FAF459DDCF763C2936C596ECD8183462AC602DFB010AEA21B`.

The current Stage files are identity-renamed copies of the historically approved package. Reversing only the approved identity substitutions produced exact content matches for both Stage files (`Stage1Matches=true`, `Stage2Matches=true`); the raw current hashes are recorded because the filenames/display identity changed.

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
15 passed in 0.15s
```

From `frontend`:

```text
npm test
Test Files  4 passed (4)
Tests       22 passed (22)

npm run build
466 modules transformed.
built successfully
```

The frontend build reports a non-blocking Vite chunk-size warning for the
GenLayerJS bundle. gltest reports that gltest.config.yaml is absent and uses
its default localnet configuration; this is recorded as offline harness
evidence only, not Studionet evidence. Local HTTP smoke returned `200` for
`/` and `/case/case-1`, including SPA fallback. In-app Browser inspected
the no-provider picker state and confirmed that opening it does not expose
internal implementation text; live injected-wallet rendering remains
outstanding.

## Release boundary

No Studio deployment, wallet signing, live transaction, GitHub push, Vercel deployment, user Vercel E2E, or anonymous review checkpoint has been performed in this local build turn. The exact contract source was loaded into Studio read-only on 2026-09-01.
