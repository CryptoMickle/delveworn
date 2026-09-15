import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { BossBattleScore } from "../app/boss-battle-score";
import { GameAudioController, type GameAudioEnvironment } from "../app/game-audio";

class Parameter {
  value = 0;
  values: number[] = [];
  events: Array<[string, number, number]> = [];
  setValueAtTime(value: number, time = 0) { this.value = value; this.values.push(value); this.events.push(["set", value, time]); return this; }
  exponentialRampToValueAtTime(value: number, time = 0) { this.values.push(value); this.events.push(["exponential", value, time]); return this; }
  linearRampToValueAtTime(value: number, time = 0) { this.value = value; this.values.push(value); this.events.push(["linear", value, time]); return this; }
  cancelAndHoldAtTime() { return this; }
  cancelScheduledValues() { return this; }
}

class FakeNode {
  constructor(readonly kind = "node") {}
  connections: FakeNode[] = [];
  gain = new Parameter();
  frequency = new Parameter();
  pan = new Parameter();
  Q = new Parameter();
  type = "";
  connect(target: FakeNode) { this.connections.push(target); return target; }
  disconnect() { this.connections = []; }
}

class FakeSource extends FakeNode {
  onended: (() => void) | null = null;
  buffer: { getChannelData: () => Float32Array } | undefined;
  starts: number[] = [];
  stops: number[] = [];
  start(time = 0) { this.starts.push(time); }
  stop(time = 0) { this.stops.push(time); }
}

class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  state = "running";
  destination = new FakeNode();
  onstatechange: (() => void) | null = null;
  sources: FakeSource[] = [];
  resumes = 0;
  suspends = 0;
  closes = 0;
  throwOnSource = false;
  pendingResume: (() => void) | null = null;
  delayResume = false;
  failResume = false;
  createGain() { return new FakeNode("gain"); }
  createOscillator() {
    if (this.throwOnSource) throw new Error("Device disappeared");
    const source = new FakeSource("oscillator"); this.sources.push(source); return source;
  }
  createBufferSource() {
    if (this.throwOnSource) throw new Error("Device disappeared");
    const source = new FakeSource("buffer"); this.sources.push(source); return source;
  }
  createBiquadFilter() { return new FakeNode("filter"); }
  createStereoPanner() { return new FakeNode("panner"); }
  createBuffer(_channels: number, frames: number) { const data = new Float32Array(frames); return { getChannelData: () => data }; }
  resume() {
    this.resumes += 1;
    if (this.failResume) return Promise.reject(new Error("Resume denied"));
    if (this.delayResume) return new Promise<void>(resolve => {
      this.pendingResume = () => { this.state = "running"; this.onstatechange?.(); resolve(); };
    });
    this.state = "running"; this.onstatechange?.(); return Promise.resolve();
  }
  suspend() { this.suspends += 1; this.state = "suspended"; this.onstatechange?.(); return Promise.resolve(); }
  close() { this.closes += 1; this.state = "closed"; return Promise.resolve(); }
  interrupt(state = "suspended") { this.state = state; this.onstatechange?.(); }
}

function fixture(overrides: Partial<GameAudioEnvironment> = {}) {
  const context = new FakeContext();
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  let foreground = true;
  let creations = 0;
  const preferences: string[] = [];
  const controller = new GameAudioController({
    createContext: () => { creations += 1; return context as unknown as AudioContext; },
    isForeground: () => foreground,
    readPreference: () => null,
    writePreference: value => { preferences.push(value); },
    setTimer: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimer: timer => { timers.delete(timer as number); },
    ...overrides,
  });
  return {
    controller, context, timers, preferences,
    creations: () => creations,
    foreground: (next: boolean) => { foreground = next; },
    tick: () => {
      context.currentTime += 0.3;
      const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback());
    },
  };
}

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test("room ambience needs a gesture, stops at combat/blur, and owns no scheduler", () => {
  const {controller,context,timers,creations} = fixture();
  controller.setExploration(true);
  assert.equal(creations(),0);
  controller.playAction("click");
  const drones=context.sources.filter(s => [82.4,123.5].includes(s.frequency.value));
  assert.equal(drones.length,2); assert.equal(timers.size,0);
  controller.setExploration(true);
  assert.equal(context.sources.filter(s => [82.4,123.5].includes(s.frequency.value)).length,2);
  controller.setExploration(false);
  assert.ok(drones.every(s => s.stops.length === 1 && s.connections.length === 0));
  controller.setExploration(true);
  const count=context.sources.length;
  controller.pause();
  controller.setExploration(true);
  assert.equal(context.sources.length,count);
  controller.destroy();
});

function scoreTrace(context: FakeContext) {
  return context.sources.map(source => {
    const route: unknown[] = [];
    let node = source.connections[0];
    while (node && node !== context.destination) {
      route.push(node.kind === "gain" ? { kind: node.kind, value: node.gain.value, envelope: node.gain.events }
        : node.kind === "panner" ? { kind: node.kind, pan: node.pan.value }
          : { kind: node.kind, type: node.type, frequency: node.frequency.value, Q: node.Q.value });
      node = node.connections[0];
    }
    const noise = source.buffer?.getChannelData();
    return { kind: source.kind, wave: source.type, frequency: source.frequency.events,
      start: source.starts[0], stop: source.stops[0], route,
      noise: noise ? createHash("sha256").update(Buffer.from(noise.buffer)).digest("hex") : null };
  });
}

test("boss music matches the frozen Market Dungeon 16-bar note, tempo and synthesis trace", () => {
  const context = new FakeContext(); context.sampleRate = 48_000;
  const output = context.createGain(); output.gain.value = 0.72; output.connect(context.destination);
  const timers = new Map<number, () => void>(); let nextTimer = 0;
  const score = new BossBattleScore(context as unknown as AudioContext, output as unknown as AudioNode, {
    setTimer: (callback, milliseconds) => {
      assert.equal(milliseconds, 25);
      const id = ++nextTimer; timers.set(id, () => { timers.delete(id); callback(); }); return id;
    },
    clearTimer: timer => { timers.delete(timer as number); },
  });
  score.start();
  // Cover every note of the 45.714-second phrase without scheduling its repeat.
  for (let milliseconds = 25; milliseconds <= 45_500; milliseconds += 25) {
    context.currentTime = milliseconds / 1000;
    [...timers.values()].forEach(callback => callback());
  }
  const trace = scoreTrace(context);
  assert.equal(trace.length, 392, "all 16 bars, including the four drum fills, are present");
  assert.deepEqual(trace.slice(0, 8).map(source => source.kind), ["oscillator", "oscillator", "oscillator", "oscillator", "oscillator", "oscillator", "oscillator", "buffer"]);
  assert.deepEqual(trace.slice(0, 7).map(source => source.wave), ["sine", "triangle", "sine", "triangle", "triangle", "sine", "sine"]);
  assert.ok(Math.abs(trace[8].start - trace[0].start - 2 * (60 / 84 / 4)) < 1e-10, "the melody enters on step two at 84 BPM");
  // This oracle was captured from the frozen Market Dungeon source, not from
  // the implementation under test. It includes every pitch, start/stop time,
  // gain envelope, stereo position, filter and deterministic drum sample.
  const normalized = JSON.stringify(trace, (_key, value) => typeof value === "number" ? Number(value.toFixed(9)) : value);
  assert.equal(createHash("sha256").update(normalized).digest("hex"), "8472c0672be923be684417fc43db64dfe91123d44fd528f2bb5b17bc05ef73fd");
  score.destroy();
  assert.equal(timers.size, 0);
});

test("loading, outcomes and boss snapshots never create audio before a player gesture", () => {
  const { controller, context, creations, timers } = fixture();
  controller.setBossBattle(true);
  controller.playOutcome("loot");
  controller.playCharacter("Gary");
  assert.equal(creations(), 0);
  assert.equal(context.sources.length, 0);
  assert.equal(timers.size, 0);
  controller.playAction("attack");
  assert.equal(creations(), 1);
  assert.ok(context.sources.length > 0);
  assert.equal(timers.size, 1);
  controller.destroy();
});

test("ordinary actions and confirmed rewards are short cues with no background scheduler", () => {
  const { controller, context, timers } = fixture();
  for (const action of ["attack", "storm", "potion", "click"] as const) {
    const before = context.sources.length;
    controller.playAction(action);
    assert.ok(context.sources.length > before, `${action} produces feedback`);
  }
  for (const outcome of ["hit", "critical", "loot", "relic", "victory", "death"] as const) {
    const before = context.sources.length;
    controller.playOutcome(outcome);
    assert.ok(context.sources.length > before, `${outcome} produces feedback`);
  }
  assert.equal(timers.size, 0, "ordinary rooms never create ambient/drone timers");
  for (const source of context.sources) {
    assert.equal(source.starts.length, 1);
    assert.equal(source.stops.length, 1);
    assert.ok(source.stops[0] < context.currentTime + 1, "all non-boss cues finish within one second");
  }
  controller.destroy();
});

test("boss music starts once and cancels its scheduler and future notes on knockout", () => {
  const { controller, context, timers, tick } = fixture();
  controller.playAction("click");
  controller.setBossBattle(true);
  tick();
  const scoreSources = context.sources.slice(1);
  const previousCount = context.sources.length;
  const staleCallback = [...timers.values()][0];
  controller.setBossBattle(true);
  assert.equal(context.sources.length, previousCount, "unchanged boss state cannot restart music");
  assert.equal(timers.size, 1);
  assert.ok(scoreSources.some(source => source.starts[0] > context.currentTime), "test includes future scheduled notes");
  controller.setBossBattle(false);
  assert.equal(timers.size, 0);
  for (const source of scoreSources) {
    const latestStop = source.stops.at(-1)!;
    assert.ok(latestStop <= context.currentTime + 0.06, "sounding notes release within 60 ms");
    if (source.starts[0] > context.currentTime) assert.ok(latestStop <= context.currentTime, "future notes are cancelled immediately");
  }
  staleCallback();
  tick();
  assert.equal(context.sources.length, previousCount, "cancelled timer cannot schedule more music");
  controller.destroy();
});

test("a stale scheduler callback cannot add voices or replace a new boss fight's timer", () => {
  const { controller, context, timers, tick } = fixture();
  controller.playAction("click");
  controller.setBossBattle(true);
  const staleCallback = [...timers.values()][0];
  controller.setBossBattle(false);
  controller.setBossBattle(true);
  const newTimer = [...timers.keys()][0];
  const count = context.sources.length;
  staleCallback();
  assert.deepEqual([...timers.keys()], [newTimer]);
  assert.equal(context.sources.length, count);
  tick();
  assert.ok(context.sources.length > count, "the new fight's scheduler still advances");
  controller.destroy();
});

test("a delayed scheduler skips missed beats instead of playing a burst of old music", () => {
  const { controller, context, timers, tick } = fixture();
  controller.playAction("click");
  controller.setBossBattle(true);
  const count = context.sources.length;
  context.currentTime = 9.7;
  tick();
  const added = context.sources.slice(count);
  assert.ok(added.length > 0 && added.length <= 8, "only the current lookahead window is scheduled");
  assert.ok(added.every(source => source.starts[0] >= context.currentTime && source.starts[0] < context.currentTime + 0.12));
  assert.equal(timers.size, 1);
  controller.destroy();
});

for (const outcome of ["victory", "death"] as const) {
  test(`${outcome} stops boss notes before playing the confirmed result cue`, () => {
    const { controller, context, timers } = fixture();
    controller.setBossBattle(true);
    controller.playAction("attack");
    const before = [...context.sources];
    controller.playOutcome(outcome);
    assert.equal(timers.size, 0);
    assert.ok(before.some(source => source.stops.length > 1 && source.stops.at(-1)! === context.currentTime));
    assert.ok(context.sources.length > before.length);
    controller.destroy();
  });
}

test("leaving focus cancels all sound and returning focus never resumes without another action", async () => {
  const { controller, context, timers, foreground, tick } = fixture();
  controller.setBossBattle(true);
  controller.playAction("storm");
  const before = [...context.sources];
  foreground(false);
  controller.pause();
  assert.equal(controller.getSnapshot().paused, true);
  assert.equal(timers.size, 0);
  for (const source of before) assert.equal(source.stops.at(-1), context.currentTime);
  foreground(true);
  controller.setBossBattle(true);
  controller.playOutcome("critical");
  controller.playCharacter("The Dungeon Lord");
  tick();
  assert.equal(context.sources.length, before.length);
  assert.equal(context.resumes, 0);
  controller.playAction("potion");
  await flush();
  assert.equal(context.resumes, 1);
  assert.equal(controller.getSnapshot().paused, false);
  assert.equal(timers.size, 1);
  controller.destroy();
});

test("an external audio interruption stays paused until explicit resume", async () => {
  const { controller, context, timers } = fixture();
  controller.setBossBattle(true);
  controller.playAction("attack");
  context.interrupt("interrupted");
  assert.equal(controller.getSnapshot().paused, true);
  assert.equal(timers.size, 0);
  context.state = "running";
  context.onstatechange?.();
  assert.equal(context.state, "suspended", "device returning must not reclaim audio");
  assert.equal(context.resumes, 0);
  controller.toggleSound();
  await flush();
  assert.equal(context.resumes, 1);
  assert.equal(controller.getSnapshot().paused, false);
  assert.equal(timers.size, 1);
  controller.destroy();
});

test("mute persists and changing preference from another tab never starts playback", async () => {
  const { controller, context, preferences, timers } = fixture();
  controller.setBossBattle(true);
  controller.playAction("attack");
  controller.toggleSound();
  assert.deepEqual(preferences, ["off"]);
  assert.equal(controller.getSnapshot().enabled, false);
  assert.equal(controller.getSnapshot().paused, false);
  assert.equal(timers.size, 0);
  const count = context.sources.length;
  controller.playAction("storm");
  assert.equal(context.sources.length, count);
  controller.syncPreference("on");
  assert.equal(controller.getSnapshot().enabled, true);
  assert.equal(controller.getSnapshot().paused, true);
  assert.equal(context.resumes, 0);
  controller.toggleSound();
  await flush();
  assert.equal(context.resumes, 1);
  assert.equal(timers.size, 1);
  controller.destroy();
});

test("a stored mute prevents context creation until the player enables sound", () => {
  const { controller, creations } = fixture({ readPreference: () => "off" });
  controller.playAction("attack");
  assert.equal(creations(), 0);
  controller.toggleSound();
  assert.equal(creations(), 1);
  controller.destroy();
});

test("blocked storage and unavailable or throwing audio remain harmless to game actions", () => {
  const blocked = fixture({
    readPreference: () => { throw new Error("Storage blocked"); },
    writePreference: () => { throw new Error("Storage full"); },
  });
  assert.doesNotThrow(() => { blocked.controller.playAction("attack"); blocked.controller.toggleSound(); });
  assert.equal(blocked.controller.getSnapshot().enabled, false);
  blocked.controller.destroy();
  for (const createContext of [() => null, () => { throw new Error("No audio device"); }]) {
    const { controller } = fixture({ createContext });
    assert.doesNotThrow(() => { controller.playAction("attack"); controller.playOutcome("death"); });
    assert.equal(controller.getSnapshot().available, false);
    controller.destroy();
  }
});

test("failed resume and a disappearing source device cannot reject or crash an action", async () => {
  const { controller, context, timers } = fixture();
  context.state = "suspended";
  context.failResume = true;
  controller.setBossBattle(true);
  controller.playAction("attack");
  await flush();
  assert.equal(controller.getSnapshot().paused, true);
  assert.equal(timers.size, 0);
  context.failResume = false;
  context.throwOnSource = true;
  assert.doesNotThrow(() => controller.playAction("potion"));
  await flush();
  assert.equal(controller.getSnapshot().paused, true);
  assert.equal(timers.size, 0);
  controller.destroy();
});

test("a delayed resume cannot restart music after focus loss or destruction", async () => {
  for (const exit of ["pause", "destroy"] as const) {
    const { controller, context, timers, foreground } = fixture();
    context.state = "suspended";
    context.delayResume = true;
    controller.setBossBattle(true);
    controller.playAction("attack");
    foreground(false);
    controller[exit]();
    const count = context.sources.length;
    context.pendingResume?.();
    await flush();
    assert.equal(timers.size, 0);
    assert.equal(context.sources.length, count);
    controller.destroy();
  }
});

test("a new explicit action can resume even when the previous resume promise was interrupted", async () => {
  const { controller, context, timers, foreground } = fixture();
  context.state = "suspended";
  context.delayResume = true;
  controller.setBossBattle(true);
  controller.playAction("attack");
  foreground(false); controller.pause();
  foreground(true); controller.playAction("storm");
  context.pendingResume?.();
  await flush();
  assert.equal(controller.getSnapshot().paused, false);
  assert.equal(timers.size, 1);
  controller.destroy();
});
