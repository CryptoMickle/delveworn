# Proofbound development baseline

This document separates the Delveworn code that existed before the BUIDL CTC
2026 Fall Proofbound work from the implementation produced for the hackathon.

## Frozen baseline

| Field | Value |
| --- | --- |
| Repository | `CryptoMickle/delveworn` |
| Baseline tag | `pre-proofbound-baseline-2026-08-29` |
| Baseline commit | `279a8e88d4746685ff977158c834c8e07cd452e4` |
| Baseline commit subject | `fix: contain RISE combat layout (#21)` |
| Baseline commit time | `2026-08-28T03:07:55+02:00` |
| Baseline recorded | 2026-08-29 (Europe/Oslo) |
| Proofbound branch | `feat/proofbound` |

The annotated tag points at the canonical `origin/main` commit. The repository
was clean when the tag was created. A repository-wide search at the baseline
found no existing `Proofbound`, `Attestcoin` or `Creditcoin` implementation.

The baseline tag is immutable project evidence and must not be moved or reused.

## Existing Delveworn work

Everything reachable from the baseline tag predates Proofbound, including:

- the Solidity/Foundry dungeon game and its tests;
- the Next.js game frontend and public RISE Testnet configuration;
- player state, combat, procedural encounters, progression and economy;
- the existing relic system and `RelicClaimed` gameplay event;
- randomness adapters and chain-agnostic deployment architecture;
- existing documentation, assets and deployment tooling.

These components are the source game and integration foundation. They must not
be represented as work created for BUIDL CTC 2026 Fall.

## New Proofbound scope

Work after the baseline may include:

- the canonical Ethereum Sepolia deployment/configuration used as the source;
- Attestcoin proof acquisition, decoding and verification;
- Creditcoin `ProofboundRegistry` validation and replay protection;
- the Proofbound ERC-1155 relic contract;
- the minimal Relic Bazaar marketplace;
- Proofbound Vault and Judge Mode frontend flows;
- negative-path tests, deployment records and judge evidence;
- Proofbound-specific architecture, threat-model and integration documents.

Existing Delveworn code may be changed where integration requires it, but every
such change remains visible after the baseline and must be described accurately.

## Commit provenance

Git history is the authoritative log of all post-baseline work. Review it with:

```bash
git log --reverse --date=iso-strict \
  --format='%H%x09%aI%x09%an%x09%s' \
  pre-proofbound-baseline-2026-08-29..HEAD
```

Inspect the complete patch introduced after the baseline with:

```bash
git diff --stat pre-proofbound-baseline-2026-08-29..HEAD
git diff pre-proofbound-baseline-2026-08-29..HEAD
```

Proofbound commits should be focused, reviewable and pushed throughout the
hackathon. Avoid squashing the complete implementation into one final commit.
The submission must describe pre-existing and post-baseline work separately.

## Organizer eligibility clarification

On 2026-08-29, the team asked the Creditcoin organizers in
[`#buidl-ctc-qna`](https://discord.com/channels/762302877518528522/1456591484739387478)
whether a new Proofbound module built on the existing Delveworn project is
eligible when the baseline and all new work are disclosed transparently.

Status: awaiting a written organizer response. Record the response permalink or
screenshot here before submission and follow any additional disclosure or
repository requirements stated by the organizers.
