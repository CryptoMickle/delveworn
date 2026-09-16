import assert from "node:assert/strict";
import test from "node:test";
import { roomLootPoint } from "../app/dungeon/movement";
import {
  clampRoomPoint,
  portraitRoomCamera,
  roomFloorLootPoint,
  roomMerchantPoint,
} from "../app/dungeon/scene";

type Camera = { actorScale: number; minX: number; maxX: number };
type Rect = { left: number; right: number; top: number; bottom: number };

const cameras: Camera[] = [
  { actorScale: 1, minX: 170, maxX: 733 },
  ...[
    [320, 390], [320, 440], [320, 650], [360, 800],
    [375, 500], [375, 650], [390, 844], [430, 650],
    [430, 800], [540, 720], [650, 900], [760, 1000],
  ].map(([width, height]) => portraitRoomCamera(width, height)),
];

function overlaps(a: Rect, b: Rect) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function distanceToSegment(point: { x: number; y: number }, from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const progress = Math.max(0, Math.min(1,
    ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (from.x + dx * progress), point.y - (from.y + dy * progress));
}

function paintedShop(camera: Camera): Rect {
  const merchant = roomMerchantPoint(camera), scale = camera.actorScale;
  return {
    left: merchant.x - 210 * scale,
    right: merchant.x + 52 * scale,
    top: merchant.y - 190 * scale,
    bottom: merchant.y + 24 * scale,
  };
}

function wholeDrop(point: { x: number; y: number }, scale: number): Rect {
  // Includes the widest ordinary merchant-stop reward and its label, rather
  // than checking only the pickup anchor beneath the artwork.
  return {
    left: point.x - 50 * scale,
    right: point.x + 50 * scale,
    top: point.y - 96 * scale,
    bottom: point.y + 25 * scale,
  };
}

test("merchant-stop loot keeps the whole painted reward clear on desktop and portrait floors", () => {
  for (const camera of cameras) {
    const shop = paintedShop(camera);
    const merchant = roomMerchantPoint(camera);
    for (const room of [5, 9, 15, 19, 25, 29]) {
      for (let seed = 0; seed < 256; seed++) {
        const point = roomFloorLootPoint(seed, room, camera, true);
        assert.deepEqual(roomFloorLootPoint(seed, room, camera, true), point, "reloads reproduce the same cosmetic point");
        assert.deepEqual(clampRoomPoint(point, true, camera), point, "the separated point remains reachable");
        assert.ok(Math.hypot(point.x - 400, point.y - 391) >= 95, "a kill cannot collect the reward remotely");
        assert.ok(Math.hypot(point.x - merchant.x, point.y - merchant.y) > 96,
          "loot pickup and merchant interaction radii never overlap");
        if (Math.abs(merchant.x - 400) < 96) {
          const reservedBottom = merchant.y + Math.max(96, 124 * camera.actorScale + 24);
          assert.ok(point.y > reservedBottom, "a cropped combat lane approaches merchant loot from the south");
        }
        assert.equal(overlaps(wholeDrop(point, camera.actorScale), shop), false,
          `seed ${seed}, room ${room} keeps the reward outside Kevin and the wagon`);
      }
    }
  }
});

test("rooms without Kevin retain their exact seeded loot positions", () => {
  for (const camera of cameras) {
    for (const room of [1, 5, 9, 10, 37]) {
      for (const seed of [0, 1, 6, 21, 44, 777, 0xffff_ffff]) {
        assert.deepEqual(roomFloorLootPoint(seed, room, camera, false), roomLootPoint(seed, room, camera));
      }
    }
  }
});

test("known collisions are displaced and the deterministic narrow-floor fallback stays safe", () => {
  const desktop = cameras[0];
  const desktopRaw = roomLootPoint(21, 5, desktop);
  assert.equal(overlaps(wholeDrop(desktopRaw, desktop.actorScale), paintedShop(desktop)), true);
  assert.equal(overlaps(wholeDrop(roomFloorLootPoint(21, 5, desktop, true), desktop.actorScale), paintedShop(desktop)), false);

  const portrait = portraitRoomCamera(320, 440);
  const portraitRaw = roomLootPoint(5, 5, portrait);
  assert.equal(overlaps(wholeDrop(portraitRaw, portrait.actorScale), paintedShop(portrait)), true);
  assert.equal(overlaps(wholeDrop(roomFloorLootPoint(5, 5, portrait, true), portrait.actorScale), paintedShop(portrait)), false);

  const fallback = roomFloorLootPoint(24454, 5, portrait, true);
  assert.deepEqual(fallback, { x: 562, y: 495 });
  assert.deepEqual(clampRoomPoint(fallback, true, portrait), fallback);
  assert.equal(overlaps(wholeDrop(fallback, portrait.actorScale), paintedShop(portrait)), false);

  const laneCamera = portraitRoomCamera(375, 650), laneMerchant = roomMerchantPoint(laneCamera);
  const laneLoot = roomFloorLootPoint(20967, 5, laneCamera, true);
  assert.deepEqual(laneLoot, { x: 537, y: 451 });
  assert.ok(laneLoot.y > laneMerchant.y + Math.max(96, 124 * laneCamera.actorScale + 24));
  assert.ok(distanceToSegment(laneMerchant, { x: 400, y: 391 }, laneLoot) > 96,
    "the direct walk reaches loot without crossing Kevin's trade radius");
});
