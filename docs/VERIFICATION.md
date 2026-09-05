# Reviewer verification — Package Release Provenance Consistency Register

Status: `EXACT_FINAL_REVISION_E2E_COMPLETE`

This is the reviewer-facing live evidence ledger for the exact frozen source.
It is written for a GenLayer judge who has no Task history. It records the
verified source, deployment, live proof, and final web journey. It does not
claim Explorer submission or final release approval.

## Exact source and deployment

- Application source revision: `6a37d93707db6e78346f0d551ebc852a702f6822`.
- Application source tree: `f60aaff13492bda7ae38dac2a24aefcb6d84fe23`.
- Contract source: `contracts/package_release_provenance_consistency_register.py`.
- Contract SHA-256: `5C5DA9E3E45F99B81E5AAF0647D5804761D157452B2036EA1DDF16F11783D34A`.
- Previous application revision: `f531d13c6d22525bd6beefcece53fe16e537c42b`.
- Network: Studionet (`61999`).
- Contract classification: `INTENTIONALLY FROZEN`; there is no upgrade path.
- Deployer/owner: `0x34b92E6553eaCA11A00A9d86d75d8a7881779D78`.
- Unauthorized caller used for E2: `0xeF5D2119416A2f5afa35dCFA209766EFC1BE5902`.
- Contract address: `0x9BF50C40e34BA42E28120aAAa84148fD25040F73`.
- Deployment transaction: `0xc04350aa86ac9dad970f200e4df172268f63305044a823be3c7b8434a07ab6f2`.
- Deployment status: `FINALIZED`; consensus: `MAJORITY_AGREE`; leader execution: `SUCCESS`.
- Explorer: `https://explorer-studio.genlayer.com/address/0x9BF50C40e34BA42E28120aAAa84148fD25040F73`.
- Vercel production deployment ID: `GMfrmVk2eRkXZ2NzsT2qRVKmsPct`.
- Live application: `https://package-release-provenance-consiste.vercel.app/`.
- Vercel build: remote `tsc -b && vite build` completed successfully for the deployed revision.

The deployment above is the only release deployment. Earlier deployments at
`0x11f6622863D71929c0bf30D6d984528f588486E5` and
`0xB0886861d5b5e67dce4540ce6D3451e29Dc2A17f` are diagnostics and are excluded.

## Fixture inputs

The baseline tuple used by E1 is:

```text
ecosystem=npm
package_name=is-number
version=7.0.0
registry_url=https://registry.npmjs.org/is-number/7.0.0
repository_owner=jonschlinkert
repository_name=is-number
release_url=https://github.com/jonschlinkert/is-number/releases/tag/7.0.0
expected_commit_id=98e8ff1da1a89f93d1397a24d7413ed15421c139
source_subdirectory=""
```

The case-specific changes were:

- E5: baseline tuple with release URL tag `9.9.9`.
- E6: baseline registry fixture, frozen repository `other/tool`, release URL `other/tool` tag `7.0.0`.
- E7: baseline repository/tag, expected commit `0000000000000000000000000000000000000000`.
- E8: `test-package@0.0.1`, registry URL `https://registry.npmjs.org/test-package/0.0.1`, frozen repository `acme/tool`, release URL tag `0.0.1`, expected commit all-zero.
- E9: `is-number@99.99.99`, registry URL `https://registry.npmjs.org/is-number/99.99.99`, release URL tag `99.99.99`, expected commit all-zero.
- E10: exact E1 tuple under a new case ID.
- E11: baseline tuple with `registry_url=not-a-url`; commit/subdirectory invalid variants remain covered by automated tests.
- E12: `is-arrayish@0.3.2`, registry URL `https://registry.npmjs.org/is-arrayish/0.3.2`, repository `qix-/node-is-arrayish`, release URL tag `0.3.2`, expected commit `8ef97ff99d606e911aeaf003b86318b882b4fba1`.
- E13: `isobject@3.0.1`, registry URL `https://registry.npmjs.org/isobject/3.0.1`, repository `jonschlinkert/isobject`, release URL tag `3.0.1`, expected commit `7ad1fc405d19f144a21e2bfe947fa82801baa7aa`.
- E14: `is-extendable@1.0.1`, registry URL `https://registry.npmjs.org/is-extendable/1.0.1`, repository `jonschlinkert/is-extendable`, release URL tag `1.0.1`, expected commit `230717f6be5be812c16916ec8a745d6252dfa7a5`.

## Consolidated live proof matrix

E1–E11 were sent through the Codex in-app Studio browser. E12 was sent through
the prior production Vercel release and E13 through the exact final production
Vercel release in Chrome profile 2. Unless noted otherwise, the owner account
signed the transaction. Every transaction listed below reached `FINALIZED` and
`MAJORITY_AGREE`; the leader result and authoritative readback are recorded
explicitly.

| ID | Purpose and action | Transaction hash(es) | Leader result | Authoritative result/readback | Verdict |
|---|---|---|---|---|---|
| E1 | Owner `create_case` with the baseline tuple | `0xca1669c5a669fee1f872731cd5539cea4a3564a3f1219a0814f977877545fb79` | `SUCCESS` | `get_count=1`; exact case stored as `DRAFT` with owner and all fixture fields | PASS |
| E2 | Unauthorized account `freeze_case(E1)` | `0xd94042885fe2458e6f635c757f3d63538bf0aa35b91c041cd38b67caf8f736db` | `ERROR` | E1 remains `DRAFT`; no mutation | PASS — expected rejection |
| E3 | Owner `freeze_case(E1)` | `0xf8ed1ff60ef42c412d53bf5c7a06f085e11670a46b2c5eaaf2b1726e89ded498` | `SUCCESS` | E1 becomes `FROZEN` | PASS |
| E4 | Owner `assess_case(E1)` | `0x54f62527a7472006ba22b563b29c2ca65fa3b432aab0fda0a548e28c23d5cbb5` | `SUCCESS` | `RESOLVED / PROVENANCE_MATCH`; observed repo `jonschlinkert/is-number`, tag `7.0.0`, exact commit `98e8ff1d…c139`, digest `4bccafc…c1b1` | PASS |
| E5 | Fresh case, release tag mismatch | create `0x1129ea01f151d715796fe3488f69c968b6669fda60987a2b45d0c155568c302d`; freeze `0x7d39d45889eab7c6de9b7075d033182cd35478592f567b3121e121eaaef8caa7`; assess `0x1a22857d557d85147a9a27db13c1e9b4d4cc8ec5e1756dbd24bb8e6faefd855f` | `SUCCESS` for all | `RESOLVED / VERSION_TAG_MISMATCH`; observed repo `jonschlinkert/is-number`, tag `9.9.9`, digest `7c081b…7cbc` | PASS |
| E6 | Fresh case, repository mismatch | create `0x990183f4d1d6e0820fd53107212f76848d64901dda2447f826a21c29f4586ed0`; freeze `0x3b8f95c33ee584c1595a854af526dfe30208589fc63bdf8b0d13376f7824144f`; assess `0x193344879a72849c3dbe5dd1718abaa3c9fbd6a8d761ad90a56945554f736981` | `SUCCESS` for all | `RESOLVED / REPOSITORY_MISMATCH`; observed repo `jonschlinkert/is-number`, tag `7.0.0`, digest `eb276c…08dcd` | PASS |
| E7 | Fresh case, commit mismatch | create `0x7478b41e6d760e172e90d18a113eaa49bd2f4ab4cb74f51aab714404953fc70b`; freeze `0x2b3d5ebfe0d0cc253cbf16f313a18bfe445e87612f4b565b8da9bf859f89af4d`; assess `0x827026a1d6e9ae128b8fc4b761e7532602c017710097e3ba581842ae160fe41a` | `SUCCESS` for all | `RESOLVED / COMMIT_MISMATCH`; observed exact commit `98e8ff1d…c139`, digest `9eb81b…d8670` | PASS |
| E8 | Fresh case, missing source link | create `0xf8d780b22823b66773edd33dee042fe6e30d36029a837037b6971b685025bc4d`; freeze `0x2b190b451823c98b4c78ecfcd054bf11004144a62e628f08a42ea0c45cbc1937`; assess `0x3ae80c7bbc0a8c26c355358b07cd4228aedcd6db048ae56417dc16c2f075e246` | `SUCCESS` for all | `RESOLVED / SOURCE_LINK_MISSING`; observed tag `0.0.1`, digest `cb43ca…db8cc` | PASS |
| E9 | Unavailable version, unresolved state, bounded retry | create `0xdd663436da1ee3c92da64cd9d9afaeef48619fb785f8b6a1c157a13e2dc2c31e`; freeze `0x56ef65f7c7fb2a9fb7f6060f48e17deaef4119d76ff487030dd6ae90a76d3e49`; assess-1 `0x78d95d81eb21cf266a65471dbbec0bfb9c950cf1ebb59e12ca6ac9a418032c2a`; retry-1 `0x7d341ba9b4af5de903df42a01eed0fded38c5b4ad7d3a8eff638027572430af5`; assess-2 `0x3ced8c390154a2d4f3eb6d4b73bff7286b97ec971d82da5505d01ead658222df`; retry-2 `0xd54422949a91fc0dfe64b5d6f01f0972a92fb683a1d638bae18e3b7437531b6b`; assess-3 `0xbea1cccf98db1365a7651252f43b14f72af3a269041e479f133a3a10e0dbabdf`; retry-limit `0x36cd1cfca1392efff6b993197fce2d83e1b1e9b6db556460ceb3591ff6342982` | `SUCCESS` through assess-3; retry-limit `ERROR` | Final state `UNRESOLVED`, `retry_count=2`; retry-limit leaves state unchanged | PASS |
| E10 | Exact E1 tuple duplicate under a new case ID | `0xe96ecfb2d0407d693e89269dc5d16867aa4c67cd3fbb51354111e3035c2bca76` | `ERROR`; live result `ERR_DUPLICATE_PROVENANCE` | `get_count` remains `6`; new E10 case is rejected | PASS — expected rejection |
| E11 | Invalid URL control (`registry_url=not-a-url`) | `0xab3162375c56153d749431542dd088c134bc705f46415240459d04233979b198` | `ERROR`; live result `ERR_INVALID_REGISTRY_URL` | `get_count` remains `6`; new case rejected; E1 remains `RESOLVED` | PASS — expected rejection |
| E12 | Exact Vercel journey: reload disconnected, explicit OKX selection, owner `create_case`, retained receipt, copy action, Explorer link, finality and post-write readback | `0x72b0f0758e3c803f32ffbe7a48d33865f7efa7e25621ac1831ca98b850374ea9` | `SUCCESS` | `FINALIZED`; `MAJORITY_AGREE`; leader `execution_result=SUCCESS`; `get_count=9`; UI `Created and verified`; exact case `vercel-e2e-repair2-20260905` stored as `DRAFT` with the full E12 tuple | PASS |
| E13 | Exact final Vercel journey: public Docs/How it works, reload disconnected, explicit OKX selection, owner `create_case`, phase indicator, retained receipt, copy action, Explorer link, finality and post-write readback | `0x3948fef3afbd6830bfcecf6a8e48898e5c13058d208d83da9e3c5de3e9145743` | `SUCCESS` | `FINALIZED`; `MAJORITY_AGREE`; leader `execution_result=SUCCESS`; `get_count=10`; UI `Created and verified`; exact case `vercel-e2e-final-f531d13-20260905` stored as `DRAFT` with the full E13 tuple | PASS |
| E14 | Repair release journey: clean reload count loading/finalized state, explicit OKX selection, owner `create_case`, phase indicator, retained receipt/copy/Explorer link, finality, readback, reload/disconnect and reconnect | `0x38626e771e096d895054c2e6336a14f8589618e7f2afff32ef9d8a26fa782fbd` | `SUCCESS` | `FINALIZED`; `MAJORITY_AGREE`; leader `execution_result=SUCCESS`; `get_count=10` before the write and `11` after finalized readback; UI `Created and verified`; exact case `vercel-e2e-repair-f001-20260905` stored as `DRAFT` with package `is-extendable@1.0.1`, repository `jonschlinkert/is-extendable`, and expected commit `230717f6be5be812c16916ec8a745d6252dfa7a5` | PASS |

## Test and release boundary

- Local contract tests: `15 passed`.
- Frontend tests: `31 passed` across 4 files.
- Frontend production build: passed; only the documented non-blocking Vite chunk-size warning remains.
- `genvm-lint` and `ruff`: passed.
- E14 was executed against the exact final deployed application revision and corroborated by direct receipt status plus latest-final application readback.
- Final Vercel E2E also verified the public Docs/How it works journey, finalized count loading/unavailable behavior, reload-to-disconnected behavior, explicit OKX reconnection, `WAITING_FOR_WALLET`/`WAITING_FOR_FINALITY`/`SUCCESS` phase semantics, retained hash/copy behavior, Explorer-link integrity, and public transaction-progress copy.
- GitHub target and push are complete; Explorer pre-submission and final release approval remain pending their governed final review gates.
