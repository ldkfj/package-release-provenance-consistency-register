# Package Release Provenance Consistency Register

A non-economic GenLayer Project that records whether one npm package version matches its declared GitHub repository, release tag, full commit, and source subdirectory.

The contract is intentionally narrow: one `npm` adapter and public GitHub evidence. It emits `PROVENANCE_MATCH`, `REPOSITORY_MISMATCH`, `VERSION_TAG_MISMATCH`, `COMMIT_MISMATCH`, `SOURCE_LINK_MISSING`, or `UNRESOLVED`. It does not certify reproducible builds, byte equality, malware safety, licensing, or maintainer identity.

## Local verification

```powershell
genvm-lint check contracts/package_release_provenance_consistency_register.py --json
$env:PYTHONIOENCODING='utf-8'; gltest -q -p no:cacheprovider
ruff check contracts tests
Set-Location frontend
npm ci
npm test
npm run build
```

## Frontend configuration

Copy `frontend/.env.example` to `frontend/.env.local` and set the deployed contract address before using the dApp. The app starts disconnected on every reload and supports MetaMask, OKX Wallet, and Rabby through EIP-6963 discovery.

## Current release boundary

The exact source revision has a completed Studionet deployment and bounded live
E1–E11 evidence. Release approval is still pending the post-deployment review,
Explorer pre-submission route, GitHub/Vercel target confirmation, and user-run
Vercel E2E. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the
reviewer-facing evidence ledger.
