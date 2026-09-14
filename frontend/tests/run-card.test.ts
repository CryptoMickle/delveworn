import assert from "node:assert/strict";
import test from "node:test";
import { createRunCardModel, RUN_CARD_WIDTH, RUN_CARD_HEIGHT, type RunCardData } from "../app/run-card-render";

const data: RunCardData = { mode: "practice", roomsCleared: 13, bossesDefeated: 1, gold: 92, weaponLevel: 3, armorLevel: 2, relicName: "Gilded Hunger", uniqueRelics: 1, totalRelicDrops: 3 };

test("run card distinguishes room reached from defeated enemies and preserves caller totals", () => {
  const card = createRunCardModel(data);
  assert.equal(card.room, "14");
  assert.equal(card.enemies, "13");
  assert.equal(card.gold, "92");
  assert.equal(card.filename, "delveworn-practice-room-14.png");
  assert.match(card.alt, /weapon level 3; armor level 2; relic Gilded Hunger; 1 unique relics; 3 total relic drops/);
  assert.equal(RUN_CARD_WIDTH / RUN_CARD_HEIGHT, 16 / 9);
});

test("Practice export always contains its trust boundary and supports endless rooms", () => {
  const card = createRunCardModel({ ...data, roomsCleared: 144 });
  assert.equal(card.room, "145");
  assert.equal(card.disclosure, "LOCAL PRACTICE · SELF-REPORTED · NO ONCHAIN REWARDS");
  assert.doesNotMatch(card.alt, /\/40|Somnia|Market Dungeon|verified|certificate/i);
});

test("Onchain export uses supplied network without inventing proof or network identity", () => {
  const card = createRunCardModel({ ...data, mode: "onchain", networkLabel: "RISE Testnet" });
  assert.equal(card.modeLabel, "ONCHAIN · RISE Testnet");
  assert.equal(card.filename, "delveworn-onchain-room-14.png");
  assert.equal(card.disclosure, "Confirmed game snapshot · image is not a proof certificate");
  assert.equal(createRunCardModel({ ...data, mode: "onchain" }).modeLabel, "ONCHAIN · Network not provided");
});

test("invalid counts are shown as unavailable rather than invented results", () => {
  const card = createRunCardModel({ ...data, roomsCleared: Infinity, gold: -1, armorLevel: 1.5 });
  assert.equal(card.room, "—");
  assert.equal(card.gold, "—");
  assert.equal(card.armor, "—");
  assert.equal(card.filename, "delveworn-practice-room-unknown.png");
});
