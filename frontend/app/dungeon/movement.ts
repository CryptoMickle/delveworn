export type Point = { x: number; y: number };
export type Facing = "left" | "right";
export type Orientation = "north" | "south";

export function movementFacing(from: Point, to: Point, previous: Facing): Facing {
  return to.x === from.x ? previous : to.x < from.x ? "left" : "right";
}

export function movementOrientation(from: Point, to: Point, previous: Orientation): Orientation {
  return to.y === from.y ? previous : to.y < from.y ? "north" : "south";
}

export type RoomFrames = {
  now: () => number;
  request: (callback: (time: number) => void) => number;
  cancel: (id: number) => void;
};
export type RoomFrameHost = RoomFrames & { delay: (callback: () => void, ms: number) => number; clear: (id: number) => void };

export function isRoomPoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** RAF provides smooth frames; a slow fallback keeps walking usable when RAF
 * stops arriving. Both use one monotonic clock, and only one can win each step. */
export function createRoomFrameClock(host: RoomFrameHost = {
  now: () => performance.now(),
  request: callback => window.requestAnimationFrame(callback),
  cancel: id => window.cancelAnimationFrame(id),
  delay: (callback, ms) => window.setTimeout(callback, ms),
  clear: id => window.clearTimeout(id),
}): RoomFrames {
  let sequence = 0;
  const pending = new Map<number, { frame: number | null; timer: number | null }>();
  const cancel = (id: number) => {
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (job.frame !== null) host.cancel(job.frame);
    if (job.timer !== null) host.clear(job.timer);
  };
  return {
    now: () => host.now(),
    request(callback) {
      const id = ++sequence, job = { frame: null as number | null, timer: null as number | null };
      pending.set(id, job);
      const deliver = () => {
        if (!pending.has(id)) return;
        cancel(id);
        callback(host.now());
      };
      job.timer = host.delay(deliver, 80);
      try { job.frame = host.request(deliver); }
      catch { /* The timer also covers an unavailable animation scheduler. */ }
      return id;
    },
    cancel,
  };
}

/** Movement starts at input time, so retargeting cannot repeatedly spend the
 * first frame standing still. Cancellation keeps the last displayed point. */
export function startRoomWalk(from: Point, to: Point, step: (point: Point) => boolean | void, arrive: () => void,
  frames: RoomFrames = createRoomFrameClock()) {
  if (!isRoomPoint(from) || !isRoomPoint(to)) throw new RangeError("Invalid room position");
  const duration = Math.hypot(to.x - from.x, to.y - from.y) / .24;
  const start = frames.now();
  let frame = 0, stopped = false;
  const tick = (time: number) => {
    if (stopped) return;
    const fraction = duration === 0 ? 1 : Math.max(0, Math.min(1, (time - start) / duration));
    const point = { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
    if (step(point) === false) { stopped = true; return; }
    if (fraction === 1) { stopped = true; arrive(); }
    else frame = frames.request(tick);
  };
  frame = frames.request(tick);
  return () => { stopped = true; frames.cancel(frame); };
}

export type RoomMovementKey = "w" | "a" | "s" | "d";
export function roomMovementKey(key: string): RoomMovementKey | null {
  const lower = key.toLowerCase();
  return lower === "w" || lower === "a" || lower === "s" || lower === "d" ? lower : null;
}

/** Held keys steer on animation frames, independently of the operating system's
 * key-repeat delay. A fresh direction changes the next frame without a pause. */
export function createRoomSteering(position: () => Point, step: (point: Point) => boolean | void,
  motion: (moving: boolean) => void, frames: RoomFrames = createRoomFrameClock()) {
  const held = new Set<RoomMovementKey>();
  let frame: number | null = null, last = 0;
  const direction = () => ({ x: Number(held.has("d")) - Number(held.has("a")), y: Number(held.has("s")) - Number(held.has("w")) });
  const pause = () => {
    if (frame !== null) { frames.cancel(frame); frame = null; motion(false); }
  };
  const stop = () => { held.clear(); pause(); };
  const tick = (time: number) => {
    if (frame === null) return;
    const vector = direction(), length = Math.hypot(vector.x, vector.y);
    const from = position();
    if (!length || !isRoomPoint(from)) { stop(); return; }
    // Limit a delayed frame so it cannot jump across loot or an interaction.
    const distance = Math.max(0, Math.min(80, time - last)) * .24;
    last = time;
    if (step({ x: from.x + vector.x / length * distance, y: from.y + vector.y / length * distance }) === false) {
      stop(); return;
    }
    // The step callback may stop us synchronously on arrival or open a dialog.
    if (frame !== null) frame = frames.request(tick);
  };
  const update = () => {
    const vector = direction();
    if (!vector.x && !vector.y) { pause(); return; }
    if (frame === null) { last = frames.now(); frame = frames.request(tick); motion(true); }
  };
  return {
    press(key: RoomMovementKey) { if (!held.has(key)) { held.add(key); update(); } },
    release(key: RoomMovementKey) { held.delete(key); update(); },
    stop,
    get moving() { return frame !== null; },
  };
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
