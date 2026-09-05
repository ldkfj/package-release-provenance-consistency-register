# Package Release Provenance Consistency Register

A non-economic GenLayer application that checks whether an npm release points to the declared GitHub repository, release tag, commit, and source subdirectory, then records the result on Studionet.

## Verified links

- [Open the live application](https://package-release-provenance-consiste.vercel.app/)
- [Source repository](https://github.com/ldkfj/package-release-provenance-consistency-register)
- [Studionet contract in Explorer](https://explorer-studio.genlayer.com/address/0x9BF50C40e34BA42E28120aAAa84148fD25040F73)
- [Production deployment](https://vercel.com/gam9/package-release-provenance-consistency-register/GMfrmVk2eRkXZ2NzsT2qRVKmsPct)
- [Exact application revision](https://github.com/ldkfj/package-release-provenance-consistency-register/commit/6a37d93707db6e78346f0d551ebc852a702f6822)

## The trust problem

An npm package can declare a GitHub repository while the published package metadata, release tag, tagged commit, or source link no longer agrees with that declaration. A publisher, browser, or reviewer should not be able to choose only the convenient evidence. The register makes the complete comparison explicit and auditable.

## Why GenLayer is essential

The important decision is not a local form validation: validators must independently retrieve public npm and GitHub evidence, normalize the same bounded comparison, and reach consensus before the result becomes on-chain state. The contract stores the frozen inputs, consensus outcome, observed repository/tag/commit, retry state, and evidence digest. A single frontend or publisher cannot author the verdict by itself.

## How it works

1. Select a wallet in the connection picker. The application supports MetaMask, OKX Wallet, and Rabby; the user must choose a detected wallet explicitly. Reloading starts disconnected.
2. Register a draft with the npm package/version, canonical registry URL, GitHub repository, release URL, expected commit, and optional source subdirectory.
3. Freeze the inputs. The owner can no longer change the draft.
4. Assess consistency. GenLayer validators retrieve the bounded public sources and compare the normalized projection.
5. Inspect the case by its case ID. The interface displays the authoritative state and outcome, the observed values, the evidence digest, and a bounded retry path for an unresolved assessment.

The possible outcomes are `PROVENANCE_MATCH`, `REPOSITORY_MISMATCH`, `VERSION_TAG_MISMATCH`, `COMMIT_MISMATCH`, `SOURCE_LINK_MISSING`, and `UNRESOLVED`.

## Architecture

- **Intelligent Contract:** validates and canonicalizes inputs, prevents duplicate provenance records, owns the state machine, runs the nondeterministic source comparison, stores the result, and exposes read methods.
- **Frontend:** a React/Vite application using GenLayerJS for wallet selection, contract calls, transaction progress, receipts, and authoritative readback. It is a static client with no backend or relayer.
- **External evidence:** the contract retrieves public npm registry metadata and GitHub repository, tag, and tree data during assessment. Those sources are evidence, not frontend state.
- **On-chain source of truth:** the deployed contract is authoritative for case state, outcome, observations, retry count, and evidence digest after finality and successful readback.

## Intelligent Contract

Actors are the case owner who registers and freezes a case, GenLayer validators who independently evaluate the public evidence, and public readers who inspect stored results. The state machine is:

```text
DRAFT -> FROZEN -> ASSESSING -> RESOLVED
                         |          |
                         |          +--> UNRESOLVED -> RETRYING -> ASSESSING
                         +--------------------------------------
```

The key methods are `create_case`, `freeze_case`, `assess_case`, `retry_unresolved`, `get_case`, `get_result`, `get_count`, and `get_page`. The validator equivalence check compares the exact stable projection produced from the same normalized inputs and fetched evidence. This is a non-economic application: it has no token, payout, balance, or withdrawable value model.

## Transaction lifecycle and recovery

For every write, the user selects a wallet and confirms the signature. The frontend exposes the meaningful progress phases: waiting for wallet confirmation, submitted, waiting for finality, verifying execution, verifying readback, and success. A successful path requires `FINALIZED` status, semantic execution `SUCCESS`, and refreshed contract readback before it is shown as complete.

Rejected signatures, failed execution, duplicate provenance, invalid inputs, disconnects, account/network changes, and unresolved assessments are shown as recoverable user-facing states. The receipt hash and Explorer link remain available while the app verifies the result. A safe `Check again` action performs readback without creating a duplicate transaction. The contract is intentionally frozen and has no upgrade path; a contract defect requires a new deployment.

## Run locally

Prerequisites are Python 3.13 with `<3.14`, Node.js/npm, the GenLayer command-line tools, and a funded supported wallet only when exercising live writes.

```powershell
Copy-Item frontend/.env.example frontend/.env.local
# Set VITE_CONTRACT_ADDRESS in frontend/.env.local to the deployed address.

genvm-lint check contracts/package_release_provenance_consistency_register.py --json
$env:PYTHONIOENCODING='utf-8'; gltest -q -p no:cacheprovider
ruff check contracts tests

Set-Location frontend
npm ci
npm test
npm run build
npm run dev
```

The frontend configuration uses `VITE_CONTRACT_ADDRESS` and `VITE_STUDIONET_EXPLORER_URL`. Never place credentials or private wallet data in `.env.local`.

## Tests and verification

The current source has 15 contract tests, 31 frontend tests across four test files, a successful TypeScript/Vite production build, and passing `genvm-lint` and `ruff` checks. The consolidated live evidence ledger records the exact application revision, contract source hash, deployment transaction, source/deployment parity, and E1–E14 proof matrix in [docs/VERIFICATION.md](docs/VERIFICATION.md).

The final Vercel journey verified reload-to-disconnected behavior, explicit OKX selection, the public Docs/How it works content, transaction phases, retained receipt hash and Explorer link, finality, execution success, and exact post-write readback for `is-extendable@1.0.1`. The finalized count displayed `10` after a clean reload and `11` after the confirmed write.

## Deployment and source parity

- Network: Studionet, chain ID `61999`.
- Contract: `0x9BF50C40e34BA42E28120aAAa84148fD25040F73`.
- Deployment transaction: `0xc04350aa86ac9dad970f200e4df172268f63305044a823be3c7b8434a07ab6f2`.
- Contract source SHA-256: `5C5DA9E3E45F99B81E5AAF0647D5804761D157452B2036EA1DDF16F11783D34A`.
- Application source revision: `6a37d93707db6e78346f0d551ebc852a702f6822`.
- Application source tree: `f60aaff13492bda7ae38dac2a24aefcb6d84fe23`.
- Vercel deployment: `GMfrmVk2eRkXZ2NzsT2qRVKmsPct`.

The deployed contract is intentionally frozen. There is no upgrade path, so a contract correction means deploying a new contract and updating the application configuration and public evidence together. The current application and contract are bound to the links above.

## Security and trust boundaries

- Contract input validation restricts the ecosystem, package/version format, canonical npm URL, GitHub repository identity, release URL, lowercase commit hash, and source-subdirectory format.
- The contract accepts only its bounded npm and GitHub source families; arbitrary URLs are rejected before assessment.
- The frontend is not the authority for a verdict. It reports the finalized transaction and then reads the deployed contract.
- Wallet actions require an explicit user choice and signature. No wallet is auto-selected and no account request is made merely because the picker opened.
- Only public source metadata is used. The application does not request private repository credentials or store secrets.

## Known limitations

- The current adapter covers public npm registry metadata and public GitHub repository/tag/tree evidence only.
- A provenance match does not certify reproducible build bytes, package malware safety, licensing, maintainer identity, or the correctness of the source code itself.
- A source-subdirectory check proves presence in the observed Git tree; it is not a build or dependency audit.
- Temporary source unavailability or malformed public responses can produce `UNRESOLVED`; retries are bounded by the contract.
- The contract has a bounded case capacity and is intentionally non-upgradable.
