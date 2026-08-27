# Delveworn and Market Dungeon execution plan

Last updated: 27 August 2026

## Fixed decisions

- Delveworn will become one public monorepo containing Foundry contracts and the Next.js frontend.
- The current contract repository is the destination repository.
- The current frontend `main` branch will be imported as a clean snapshot under `frontend/`; its old Git history will remain in the archived private repository.
- The Foundry project stays at repository root for this migration.
- Market Dungeon remains a separate public hackathon repository and Vercel project.
- No shared npm package, Git submodule, wallet-enabled Market Dungeon mode or history rewrite is part of the current work.

## Active branches

| Repository | Branch | Purpose |
| --- | --- | --- |
| `CryptoMickle/rise-dungeon` | `chore/monorepo-consolidation` | Import frontend, consolidate CI and prepare repository rename |
| `CryptoMickle/market-dungeon` | `feat/judge-proof-layout-sync` | Final judge flow, proof links, selective layout sync and submission documentation |

## Completed

- Closed obsolete frontend draft PR #44 as superseded by PRs #45–#65.
- Created both working branches.

## Delveworn monorepo checklist

- [ ] Import the clean frontend snapshot under `frontend/`.
- [ ] Exclude nested Git metadata, `.next`, `node_modules`, `.vercel` and local environment files.
- [ ] Run a secret and oversized-file check before pushing.
- [ ] Add root-level, path-filtered contract and frontend CI workflows.
- [ ] Update the root README for the monorepo structure and Practice/onchain trust boundaries.
- [ ] Verify `forge fmt --check`, `forge build`, `forge test`, frontend lint and frontend production build.
- [ ] Open and review the monorepo PR.
- [ ] Rename `CryptoMickle/rise-dungeon` to `CryptoMickle/delveworn` after the PR is ready.
- [ ] Point the existing Vercel project to `CryptoMickle/delveworn` with Root Directory `frontend`.
- [ ] Verify production, then archive the old private frontend repository without deleting it.

## Market Dungeon checklist

- [ ] Add a judge setup state that first loads and displays the finalized replay market.
- [ ] Let the judge choose UP or DOWN against that exact replay market before combat starts.
- [ ] Remove `winningOutcome` and payout fields from the initial replay response.
- [ ] Fetch settlement data only when boss fate is revealed.
- [ ] Add full market ID, market address, pool address, Somnia chain 5031 and explorer links.
- [ ] Port only the relevant Delveworn HUD, room-progress, potion-state and spacing refinements.
- [ ] Update README and submission-facing explanation of ecosystem value and trust boundaries.
- [ ] Run one consolidated lint/build/preview and desktop/mobile QA cycle.
- [ ] Merge, verify production and tag the competition snapshot.

## Operating rules

- Keep each deliverable in one branch and one PR.
- Do not revisit fixed architectural decisions unless a concrete blocker is found.
- Use one terminal block at a time when a local operation is unavoidable.
- Do not merge or change Vercel production until all relevant CI and preview checks pass.
