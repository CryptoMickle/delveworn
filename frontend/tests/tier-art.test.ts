import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { HIGHER_TIER_ART, type DungeonEnemyArt } from "../app/dungeon/tier-art";
import { EnemySprite, getEnemyArt } from "../app/dungeon/scene";
import type { MonsterType } from "../app/practice/engine";

const expected = {
  0: [
    ["Miss Morgue", "Zombie", "/monsters/zombie-2-miss-morgue.webp"],
    ["Velvet Rot", "Zombie", "/monsters/zombie-3-velvet-rot.webp"],
    ["Lady Decomposition", "Zombie", "/monsters/zombie-4-lady-decomposition.webp"],
  ],
  1: [
    ["Gribnob the Unqualified", "Goblin", "/monsters/goblin-2-kevin-the-unqualified.webp"],
    ["Gribble", "Goblin", "/monsters/goblin-3-gribble.webp"],
    ["Gary's Supervisor", "Goblin", "/monsters/goblin-4-garys-supervisor.webp"],
  ],
  2: [
    ["Brutus", "Orc", "/monsters/orc-2-brutus.webp"],
    ["Gronk", "Orc", "/monsters/orc-3-gronk.webp"],
    ["Meatwall", "Orc", "/monsters/orc-4-meatwall.webp"],
  ],
  3: [
    ["The Senior Dungeon Lord", "Senior Management", "/monsters/boss-2-senior-dungeon-lord.webp"],
    ["The Executive Overlord", "Executive Management", "/monsters/boss-3-executive-overlord.webp"],
    ["The Chairman Below", "Board Level", "/monsters/boss-4-chairman-below.webp"],
  ],
} as const satisfies Record<MonsterType, readonly (readonly [string, string, string])[]>;

function cropNumbers(art: DungeonEnemyArt) {
  const values = art.crop.split(" ").map(Number);
  assert.equal(values.length, 4, `${art.name} needs a four-number crop`);
  assert.ok(values.every(Number.isFinite), `${art.name} crop contains a non-number`);
  return values as [number, number, number, number];
}

function outlinePoints(art: DungeonEnemyArt) {
  assert.match(art.outline, /^M[\d\s.MLCQZ-]+Z$/);
  const values = [...art.outline.matchAll(/-?\d+(?:\.\d+)?/g)].map(match => Number(match[0]));
  assert.equal(values.length % 2, 0, `${art.name} outline needs coordinate pairs`);
  return Array.from({ length: values.length / 2 }, (_, index) => ({ x: values[index * 2], y: values[index * 2 + 1] }));
}

test("higher dungeon tiers use the established Practice personas in tier order", () => {
  assert.deepEqual(Object.keys(HIGHER_TIER_ART), ["0", "1", "2", "3"]);
  for (const type of [0, 1, 2, 3] as const) {
    assert.equal(HIGHER_TIER_ART[type].length, 3, `monster ${type} needs tiers 2, 3, and 4`);
    assert.deepEqual(HIGHER_TIER_ART[type].map(({ name, role, src }) => [name, role, src]), expected[type]);
  }
  assert.ok(HIGHER_TIER_ART[3].every(art => art.roomHeight <= 225), "boss art must still fit the room floor");
});

test("higher-tier entries point at the original WebP assets with their real dimensions", async () => {
  for (const type of [0, 1, 2, 3] as const) {
    for (const art of HIGHER_TIER_ART[type]) {
      assert.match(art.src, /^\/monsters\/[a-z0-9-]+\.webp$/);
      const metadata = await sharp(`public${art.src}`).metadata();
      assert.equal(metadata.format, "webp", `${art.name} should keep its original format`);
      assert.deepEqual([art.width, art.height], [metadata.width, metadata.height], `${art.name} dimensions drifted from its source`);
    }
  }
});

test("manual crops and outlines stay inside each source without falling back to a background box", () => {
  for (const type of [0, 1, 2, 3] as const) {
    for (const art of HIGHER_TIER_ART[type]) {
      const [left, top, width, height] = cropNumbers(art);
      assert.ok(width > 0 && height > 0);
      assert.ok(left >= 0 && top >= 0 && left + width <= art.width && top + height <= art.height);

      const points = outlinePoints(art);
      assert.ok(points.length >= 50, `${art.name} needs a hand-traced silhouette, not a box`);
      const xs = points.map(point => point.x), ys = points.map(point => point.y);
      assert.ok(Math.min(...xs) >= left && Math.max(...xs) <= left + width, `${art.name} outline escapes its horizontal crop`);
      assert.ok(Math.min(...ys) >= top && Math.max(...ys) <= top + height, `${art.name} outline escapes its vertical crop`);
      assert.ok(new Set(xs).size > 12 && new Set(ys).size > 12, `${art.name} outline is suspiciously rectangular`);
      // A subject can touch the top/bottom of its original portrait. Its full
      // height alone is not evidence of retaining a rectangular background.
      assert.ok(Math.max(...xs) - Math.min(...xs) < art.width || Math.max(...ys) - Math.min(...ys) < art.height, `${art.name} must not retain the full painted background`);
    }
  }
});

test("Gary's Supervisor has transparent space around the complete room sprite", async () => {
  const sprite = HIGHER_TIER_ART[1][2].sprite;
  assert.ok(sprite);
  assert.equal(sprite.src, "/monsters/goblin-4-garys-supervisor-sprite-v2.webp");
  const image = sharp(`public${sprite.src}`);
  const metadata = await image.metadata();
  assert.deepEqual([metadata.width, metadata.height], [sprite.width, sprite.height]);
  assert.equal(metadata.hasAlpha, true);

  const [left, top, width, height] = sprite.crop.split(" ").map(Number);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let visiblePixels = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * info.channels + info.channels - 1];
      // Decoded WebP can retain a single alpha quantum in otherwise empty pixels.
      if (alpha <= 1) continue;
      visiblePixels++;
      assert.ok(x >= left + 6 && x < left + width - 6 && y >= top + 6 && y < top + height - 6,
        "the complete figure, including the crown, must fit inside the crop with a transparent margin");
    }
  }
  assert.ok(visiblePixels > 0, "the sprite cannot be empty");
});

test("the repaired Supervisor uses its own frame without the old crown mask", () => {
  const markup = renderToStaticMarkup(createElement(EnemySprite, { type: 1, room: 31 }));
  assert.match(markup, /viewBox="240 80 1226 746"/);
  assert.match(markup, /href="\/monsters\/goblin-4-garys-supervisor-sprite-v2.webp" width="1672" height="941"/);
  assert.doesNotMatch(markup, /clipPath|clip-path|crown-fixed/);

  const original = renderToStaticMarkup(createElement(EnemySprite, { type: 1, room: 1 }));
  assert.match(original, /href="\/monsters\/goblin-1-gary.webp"/);
  assert.match(original, /clip-path="url\(/);
});

// These are perceived progression guarantees, independent of individual art sizes.
test("every ten-room tier increases monster size without outgrowing the doorway", () => {
  for (const type of [0, 1, 2, 3] as const) {
    let previous = 0;
    for (let tier = 1; tier <= 100; tier++) {
      const first = getEnemyArt(type, (tier - 1) * 10 + 1);
      const last = getEnemyArt(type, tier * 10);
      assert.ok(first.roomHeight > previous, `monster ${type} must grow at tier ${tier}`);
      assert.ok(first.roomHeight <= 225, `monster ${type} must fit below the room top`);
      assert.equal(last.roomHeight, first.roomHeight, "size stays stable during a tier");
      assert.equal(last.src, first.src, "art stays stable during a tier");
      if (tier > 4) assert.equal(first.src, getEnemyArt(type, 31).src, "deep tiers reuse original tier-four art");
      previous = first.roomHeight;
    }
  }
});

test("zombie growth is clearly visible and tier one stays smaller than the player", () => {
  const heights = [1, 11, 21, 31].map(room => getEnemyArt(0, room).roomHeight);
  assert.ok(heights[0] <= 120);
  for (let tier = 1; tier < heights.length; tier++) {
    assert.ok(heights[tier] - heights[tier - 1] >= 20, "early zombie tiers need a visible step up");
  }
  assert.ok(heights[3] / heights[0] >= 1.5, "tier-four zombie must be substantially larger");
  for (const room of [1, 11, 21, 31, 101]) {
    assert.ok(getEnemyArt(1, room).roomHeight < getEnemyArt(0, room).roomHeight);
    assert.ok(getEnemyArt(0, room).roomHeight < getEnemyArt(2, room).roomHeight);
    assert.ok(getEnemyArt(2, room).roomHeight < getEnemyArt(3, room).roomHeight);
  }
});
