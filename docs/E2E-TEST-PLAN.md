# Studio E2E test plan — Package Release Provenance Consistency Register

Status: `DRAFT_PENDING_ANONYMOUS_PLAN_APPROVAL`

This is the minimum-sufficient live plan for the exact PRE_DEPLOY package. No
signature, deployment transaction, or contract write is authorized by this
document. The plan becomes executable only after anonymous `PRE_DEPLOY`
approval, direct user confirmation of the frozen decision, and anonymous
approval of this exact E2E plan.

## Exact package and network

- Implementation commit: `4ac5017a0e697426fb5c49fedde3180e262948d4`.
- Contract source: `contracts/package_release_provenance_consistency_register.py`.
- Contract source SHA-256: `BD996101A1900972F78607C5E116E1D159231127644E8DBFE1A209CB0C62FDE8`.
- Network: Studionet; chain ID `61999`; RPC `https://studio.genlayer.com/api`.
- Studio deployer/owner account: `0x34b92E6553eaCA11A00A9d86d75d8a7881779D78`.
- Unauthorized caller account: `0xeF5D2119416A2f5afa35dCFA209766EFC1BE5902`.
- Constructor arguments: `[]`; linked contracts: none; classification:
  `INTENTIONALLY FROZEN`.
- Deployment address and transaction: `NOT YET CREATED`.

## Live fixture policy

All case IDs are unique and include a run suffix generated before submission.
The primary AI records the exact arguments sent, transaction hash, lifecycle
status, semantic execution result, consensus/finality evidence, and
authoritative readback for every attempt, including expected rejections.

The valid baseline fixture is `is-number@7.0.0`:

- registry URL: `https://registry.npmjs.org/is-number/7.0.0`
- expected repository: `jonschlinkert/is-number`
- release URL: `https://github.com/jonschlinkert/is-number/releases/tag/v7.0.0`
- expected commit: `98e8ff1da1a89f93d1397a24d7413ed15421c139`
- source subdirectory: empty string

Before any write, the primary AI rechecks each fixture with bounded
authoritative reads and records the response date/status. If a fixture is no
longer authoritative or returns an unexpected shape, that row is not retried
blindly; the full bounded fixture set is revalidated and the plan is amended
and re-reviewed before proceeding.

## Matrix and exact proof requirements

| ID | Actor | Action | Expected terminal result and readback |
|---|---|---|---|
| E1 | owner | Deploy contract, then `create_case` with the valid baseline fixture | `FINALIZED` + semantic success; `get_count=1`; `get_case` is `DRAFT` with exact stored fields |
| E2 | unauthorized account | `freeze_case(E1)` | finalized expected rejection; `get_case(E1)` remains `DRAFT`; no duplicate retry |
| E3 | owner | `freeze_case(E1)` | `FINALIZED` + semantic success; `get_case(E1)` is `FROZEN` |
| E4 | permissionless assessor | `assess_case(E1)` | `FINALIZED` + semantic success and consensus; `PROVENANCE_MATCH`, observed tag/commit and evidence digest read back authoritatively |
| E5 | owner | Fresh valid case with release URL tag `9.9.9`; freeze and assess | `VERSION_TAG_MISMATCH`; retain transaction/finality/readback evidence |
| E6 | owner | Fresh case whose frozen repository is `other/tool` while registry fixture remains `is-number@7.0.0`; freeze and assess | `REPOSITORY_MISMATCH` |
| E7 | owner | Fresh case with valid repository/tag but expected commit `0000000000000000000000000000000000000000`; freeze and assess | `COMMIT_MISMATCH` |
| E8 | owner | Fresh case using an authoritative package/version whose registry metadata has no usable repository link; freeze and assess | `SOURCE_LINK_MISSING`; fixture URL and bounded response are recorded before use |
| E9 | owner | Fresh case with a deliberately unavailable/nonexistent registry version; freeze and assess | `UNRESOLVED`; one `retry_unresolved`, then reassess; final bounded retry rejection is recorded |
| E10 | owner | Repeat the exact provenance tuple from E1 under a new case ID | finalized expected duplicate rejection; count and existing case readback unchanged |
| E11 | owner | Invalid URL/commit/subdirectory controls | finalized expected rejection; count and all prior state unchanged |

E8 is the only fixture-dependent row: it may use a newly discovered
authoritative npm package with absent/malformed repository metadata, but the
exact URL and response must be recorded in the evidence ledger and included
in the anonymous re-review delta before the transaction is sent. A failed
fixture lookup is not converted into a different outcome by assertion.

## Transaction and RPC controls

- Operate Studio only through the Codex in-app Browser, using the selected
  provider/account and Studionet chain shown in the session.
- Never expose private keys, seed phrases, provider objects, RPC internals,
  chain-routing text, or reviewer/developer notes in the public UI or evidence.
- Use one write at a time. Poll the returned transaction object with bounded
  backoff; do not resubmit while status is `PROPOSING`, `COMMITTING`,
  `REVEALING`, or otherwise pending.
- A pass requires `FINALIZED`, semantic execution success, consensus/finality
  acceptance where shown, and authoritative contract readback. `FINALIZED`
  alone is not a pass.
- On 429/transient error, stop duplicate writes, preserve the transaction
  identity and response, and use only sparse authoritative status/readback
  calls after cooldown.
- Keep the entire matrix in one evidence ledger. Do not hide rejected,
  reverted, timed-out, or finalized-with-error attempts.

## Exit criteria

The Studio stage is complete only when the exact deployment source/address,
all attempted matrix rows, lifecycle and semantic results, consensus/finality,
authoritative readbacks, and secret-free recovery manifest are assembled in
`docs/PRE-DEPLOY.md`/the consolidated verification package. Then route to
`POST_DEPLOY_TEST` review on the same package. GitHub/Vercel work waits until
the user supplies those targets after Studio is complete.
