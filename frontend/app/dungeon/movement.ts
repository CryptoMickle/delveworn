export type Point = { x: number; y: number };
export type Facing = "left" | "right";

export function movementFacing(from: Point, to: Point, previous: Facing): Facing {
  return Math.abs(to.x - from.x) < 1 ? previous : to.x < from.x ? "left" : "right";
}

type Frames = { request: (callback: (time: number) => void) => number; cancel: (id: number) => void };

/** One clock owns both visible movement and arrival. Cancelling keeps the last
 * displayed point, so a new destination never starts at the old destination. */
export function startRoomWalk(from: Point, to: Point, step: (point: Point) => boolean | void, arrive: () => void,
  frames: Frames = {
    // Native animation methods require Window as their receiver. Copying them
    // onto `frames` makes frames.request() throw before the first movement frame.
    request: callback => window.requestAnimationFrame(callback),
    cancel: id => window.cancelAnimationFrame(id),
  }) {
  const duration = Math.hypot(to.x - from.x, to.y - from.y) / .24;
  let start: number | undefined, frame = 0, stopped = false;
  const tick = (time: number) => {
    if (stopped) return;
    start ??= time;
    const fraction = duration === 0 ? 1 : Math.min(1, (time - start) / duration);
    const point = { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
    if (step(point) === false) { stopped = true; return; }
    if (fraction === 1) { stopped = true; arrive(); }
    else frame = frames.request(tick);
  };
  frame = frames.request(tick);
  return () => { stopped = true; frames.cancel(frame); };
}

/** Cosmetic randomness only: stable for a seed/room, never consumes combat RNG.
 * Use the visible floor bounds so every drop remains reachable on a phone. */
export function roomLootPoint(seed: number, room: number, bounds = { minX: 170, maxX: 733 }): Point {
  let hash = (seed ^ Math.imul(room, 0x9e3779b1) ^ 0x6c6f6f74) >>> 0;
  const random = () => {
    hash = (hash + 0x6d2b79f5) >>> 0;
    let n = Math.imul(hash ^ hash >>> 15, hash | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
  const left = Math.max(210, bounds.minX + 12), right = Math.min(690, bounds.maxX - 12);
  for (let n = 0; n < 16; n++) {
    const point = { x: Math.round(left + random() * (right - left)), y: Math.round(265 + random() * 205) };
    // A kill/reload at the combat anchor must never collect a drop remotely.
    if (Math.hypot(point.x - 400, point.y - 391) >= 95) return point;
  }
  return { x: Math.round((left + right) / 2), y: 275 };
}
