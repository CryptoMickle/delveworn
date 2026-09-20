import assert from "node:assert/strict";
import test from "node:test";
import {
  activePromiseSummary,
  bossPreparationExplanation,
  pactActionWarning,
  witnessBeliefSummary,
} from "../app/living-dungeon/presentation";
import type { ActivePact } from "../app/living-dungeon/pact-schema";

function pact(
  restrictionId: ActivePact["terms"]["restrictionId"],
  boonId: ActivePact["terms"]["boonId"] = "BOSS_OPENING_WARD",
  status: ActivePact["status"] = "ACTIVE",
): ActivePact {
  return {
    terms: {
      pactId: "pact-deadbeef",
      templateId: `${restrictionId}:${boonId}`,
      rulesVersion: "living-dungeon-v0",
      catalogueHash: "test",
      offerSeed: 1,
      restrictionId,
      boonId,
      durationId: "UNTIL_BOSS_DEFEATED",
      breachId: "FORFEIT_BOON_EMPOWER_BOSS",
    },
    status,
    acceptedAtRevision: 1,
    boonUsesRemaining: status === "BREACHED" ? 0 : 1,
    entryBoonApplied: false,
    breachedAtRevision: status === "BREACHED" ? 2 : null,
    breachActionId: status === "BREACHED" ? "breach" : null,
    completedAtRevision: status === "COMPLETED" ? 2 : null,
  };
}

test("active promise summary is compact and action warnings appear before the breach", () => {
  const noStorm = pact("NO_STORM");
  assert.equal(activePromiseSummary(noStorm), "NO STORM → FIRST BOSS REPLY −50%");
  assert.equal(pactActionWarning(noStorm, "storm"), "BREAKS YOUR PROMISE");
  assert.equal(pactActionWarning(noStorm, "attack"), null);
  assert.equal(pactActionWarning(pact("NO_VOLUNTARY_HEALING"), "potion"), "BREAKS YOUR PROMISE");
  assert.equal(pactActionWarning(pact("NO_CAMP_PURCHASE"), "purchase"), "BREAKS YOUR PROMISE");
  assert.equal(activePromiseSummary(pact("NO_STORM", "BOSS_OPENING_WARD", "BREACHED")), "PROMISE BROKEN · BOON LOST · BOSS +20 HP");
});

test("boss explanations name the witness, observation and resulting preparation", () => {
  const belief = {
    id: "belief",
    subjectId: "PLAYER" as const,
    claimId: "PLAYER_RELIES_ON_STORM" as const,
    sourceId: "dungeon-scrivener" as const,
    sourceFactIds: ["fact"],
    confidence: 85,
    formedAtRevision: 4,
    expiresAfterStage: null,
  };
  assert.equal(
    bossPreparationExplanation({ beliefs: [belief], bossPreparation: "ANTI_STORM_WARD" }),
    "The Scrivener saw you use Storm and carried that impression forward. The Keeper built an anti-Storm ward.",
  );
  assert.equal(
    bossPreparationExplanation({
      beliefs: [{ ...belief, sourceFactIds: ["relay"] }],
      bossPreparation: "ANTI_STORM_WARD",
      facts: [{
        id: "relay", type: "REPORT_RELAYED", revision: 9, roomId: "witness",
        subjectId: "dungeon-scrivener", actionId: "action", actionTag: "STORM",
        valueId: "GAMBLES_WITH_STORM", sourceFactIds: ["masked-observation"],
      }],
    }),
    "The Masked Warden saw you use Storm and relayed that impression to the Scrivener. The Keeper built an anti-Storm ward.",
  );
  assert.equal(
    bossPreparationExplanation({ beliefs: [], bossPreparation: "NONE" }),
    "No witness reached the Keeper, so it prepared without a report about you.",
  );
  assert.equal(witnessBeliefSummary("PLAYER_AVOIDS_STORM"), "The Scrivener thinks you avoid Storm.");
});
