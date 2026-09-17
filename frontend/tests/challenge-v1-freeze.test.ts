import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  attack as v1Attack,
  buy as v1Buy,
  campPrices as v1CampPrices,
  enterNextRoom as v1Enter,
  startRun as v1Start,
  stormAttack as v1Storm,
  supplyPrices as v1SupplyPrices,
  usePotion as v1Potion,
  type PracticeGame as V1Game,
  type ShopAction,
} from "../app/challenge/v1/engine";
import { createV1SeededRandom } from "../app/challenge/v1/random";

type TraceAction = "attack" | "storm" | "potion" | "enter" | ShopAction;

function withoutPresentation(game: V1Game) {
  return Object.fromEntries(Object.entries(game).filter(([key]) => key !== "log"));
}

function nextAction(game: V1Game, step: number): TraceAction {
  if (game.monsterHp > 0) {
    if (game.hp <= 32 && game.potions > 0
      && game.combatPotionsUsed < (game.monsterType === 3 ? 3 : 2)) return "potion";
    return step % 4 === 1 ? "storm" : "attack";
  }
  if (game.roomsCleared === 5) {
    const prices = v1SupplyPrices(game);
    if (!game.supplyBandageUsed && game.hp < game.maxHp && game.gold >= prices.bandage) return "supply-bandage";
    if (game.supplyPotionsBought < 1 && game.potions < 4 && game.gold >= prices.potion) return "supply-potion";
  }
  if (game.roomsCleared === 9) {
    const prices = v1CampPrices(game);
    if (!game.campRestUsed && game.hp < game.maxHp && game.gold >= prices.rest) return "camp-rest";
    if (game.weaponLevel < 2 && game.gold >= prices.weapon) return "camp-weapon";
    if (game.armorLevel < 1 && game.gold >= prices.armor) return "camp-armor";
  }
  if (game.hp <= 65 && game.potions > 0) return "potion";
  return "enter";
}

test("frozen V1 mechanics and RNG retain their multi-seed release vectors", () => {
  const vectors = new Map<number, string>([
    [1, "8012deded849ad1f20353e956bc4e38a4b5695ca6b78cd109aab29873faf2409"],
    [7, "0e85a323c0a63621457d9bcc25ba04f99626c61193cd9516040b7f1543153371"],
    [42, "5c0d6cd3fbacc6907e02858443c015867a4d6a950c5d28eb3210554ca9ca013c"],
    [3678871334, "ebb1db878f00cc317d6a580c5b39b8c42becc114efde27290f9ac9e47730cb19"],
  ]);
  for (const [seed, digest] of vectors) {
    const v1Random = createV1SeededRandom(seed);
    let frozen = v1Start(v1Random.nextInt);

    for (let step = 0; step < 320 && frozen.active && frozen.roomsCleared < 10; step += 1) {
      const action = nextAction(frozen, step);
      if (action === "attack") {
        frozen = v1Attack(frozen, v1Random.nextInt);
      } else if (action === "storm") {
        frozen = v1Storm(frozen, v1Random.nextInt);
      } else if (action === "potion") {
        frozen = v1Potion(frozen, v1Random.nextInt);
      } else if (action === "enter") {
        frozen = v1Enter(frozen, v1Random.nextInt);
      } else {
        frozen = v1Buy(frozen, action);
      }
    }
    assert.equal(
      createHash("sha256").update(JSON.stringify({ game: withoutPresentation(frozen), rng: v1Random.state() })).digest("hex"),
      digest,
      `V1 release vector changed for seed ${seed}`
    );
  }
});
