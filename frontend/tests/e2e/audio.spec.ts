import { expect, test, type Page } from "@playwright/test";
import { EMPTY_GAME, type PracticeGame } from "../../app/practice/engine";
import { isStoredPracticeGame, PRACTICE_RUN_STORAGE_KEY } from "../../app/practice/storage";

type Automation = [method: string, value: number, time: number];
type ScoreVoice = {
  kind: string; wave: string; start: number; stop: number;
  frequency: Automation[]; envelope: Automation[]; pan: number | null;
  filter: { type: string; frequency: number; Q: number } | null;
  noise: number[] | null;
};
type AudioProbe = {
  supported: boolean;
  contexts: number;
  resumes: number;
  suspends: number;
  scoreStarts: number;
  scoreStops: number;
  activeScores: number;
  bossSources: number;
  futureBossSources: number;
  unscheduledNonScoreSources: number;
  sourceCount: number;
  actionCues: Record<string, string[][]>;
  scoreVoices: ScoreVoice[];
  scoreOutputGains: number[][];
};
type AudioWindow = typeof window & {
  __delvewornAudioProbe: () => AudioProbe;
  __interruptDelvewornAudio: () => Promise<void>;
};

/** Observe real native audio nodes. All probes live in the test page only. */
async function installProbe(page: Page) {
  await page.addInitScript(() => {
    const audioWindow = window as AudioWindow;
    const Context = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const contexts = new Set<AudioContext>();
    const links = new Map<AudioNode, Set<AudioNode>>();
    const owners = new Map<AudioParam, AudioNode>();
    const pitches = new WeakMap<AudioNode, number[]>();
    const automation = new WeakMap<AudioParam, Automation[]>();
    const scoreBuses = new Set<AudioNode>();
    const activeScores = new Set<AudioNode>();
    const sources: Array<{ node: AudioScheduledSourceNode; kind: string; ended: boolean; start: number; stop: number | null; initialStop: number; gesture: number | null }> = [];
    const gestures: Array<{ action: string; id: number }> = [];
    let currentGesture: number | null = null;
    let resumes = 0;
    let suspends = 0;
    let scoreStarts = 0;
    let scoreStops = 0;
    const supported = Boolean(Context);
    function record(parameter: AudioParam, method: string, value: number, time: number) {
      const events = automation.get(parameter) ?? [];
      events.push([method, value, time]); automation.set(parameter, events);
    }

    function recordGesture(action: string) {
      const id = gestures.length;
      gestures.push({ action, id });
      currentGesture = id;
      setTimeout(() => { if (currentGesture === id) currentGesture = null; }, 0);
    }
    document.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      const action = target?.textContent?.match(/\b(ATTACK|STORM|POTION)\b/)?.[1].toLowerCase();
      if (action && event.isTrusted) recordGesture(action);
    }, true);
    window.addEventListener("keydown", event => {
      const action = ({ k: "attack", j: "storm", m: "potion" } as Record<string, string>)[event.key.toLowerCase()];
      if (action && event.isTrusted) recordGesture(action);
    }, true);

    if (Context) {
      const createGain = Context.prototype.createGain;
      Context.prototype.createGain = function () {
        contexts.add(this);
        const gain = createGain.call(this);
        owners.set(gain.gain, gain);
        return gain;
      };
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (this: AudioNode, destination: AudioNode | AudioParam, ...ports: number[]) {
        if (destination instanceof AudioNode) {
          const destinations = links.get(this) ?? new Set<AudioNode>();
          destinations.add(destination); links.set(this, destinations);
        }
        return Reflect.apply(connect, this, [destination, ...ports]);
      } as typeof connect;
      const setValue = AudioParam.prototype.setValueAtTime;
      AudioParam.prototype.setValueAtTime = function (value, time) {
        record(this, "set", value, time);
        const owner = owners.get(this);
        if (owner && pitches.has(owner)) pitches.get(owner)!.push(value);
        if (owner && value === 0 && activeScores.delete(owner)) scoreStops += 1;
        return setValue.call(this, value, time);
      };
      const ramp = AudioParam.prototype.linearRampToValueAtTime;
      AudioParam.prototype.linearRampToValueAtTime = function (value, time) {
        record(this, "linear", value, time);
        const owner = owners.get(this);
        // The dedicated music bus fades to its score volume; action nodes route
        // directly to the master. Follow native connections to separate them.
        if (owner && value === 0.34) {
          scoreBuses.add(owner); activeScores.add(owner); scoreStarts += 1;
        }
        if (owner && value === 0 && activeScores.delete(owner)) scoreStops += 1;
        return ramp.call(this, value, time);
      };
      const exponential = AudioParam.prototype.exponentialRampToValueAtTime;
      AudioParam.prototype.exponentialRampToValueAtTime = function (value, time) {
        record(this, "exponential", value, time);
        return exponential.call(this, value, time);
      };
      const observe = <T extends AudioScheduledSourceNode>(source: T, kind: string) => {
        const entry = { node: source, kind, ended: false, start: 0, stop: null as number | null, initialStop: 0, gesture: currentGesture };
        sources.push(entry);
        const start = source.start.bind(source);
        source.start = (time = 0) => { entry.start = time; start(time); };
        const stop = source.stop.bind(source);
        source.stop = (time = 0) => {
          if (entry.stop === null) entry.initialStop = time;
          entry.stop = Math.max(time, source.context.currentTime); stop(time);
        };
        source.addEventListener("ended", () => { entry.ended = true; });
        return source;
      };
      const oscillator = Context.prototype.createOscillator;
      Context.prototype.createOscillator = function () {
        const source = observe(oscillator.call(this), "tone");
        owners.set(source.frequency, source); pitches.set(source, []);
        return source;
      };
      const buffer = Context.prototype.createBufferSource;
      Context.prototype.createBufferSource = function () { return observe(buffer.call(this), "noise"); };
      const resume = Context.prototype.resume;
      Context.prototype.resume = function () { resumes += 1; return resume.call(this); };
      const suspend = Context.prototype.suspend;
      Context.prototype.suspend = function () { suspends += 1; return suspend.call(this); };
      audioWindow.__interruptDelvewornAudio = () => Promise.all(
        [...contexts].filter(context => context.state !== "closed").map(context => suspend.call(context)),
      ).then(() => undefined);
    } else {
      audioWindow.__interruptDelvewornAudio = async () => undefined;
    }
    function isScore(node: AudioNode, seen = new Set<AudioNode>()): boolean {
      if (scoreBuses.has(node)) return true;
      if (seen.has(node)) return false;
      seen.add(node);
      return [...links.get(node) ?? []].some(next => isScore(next, seen));
    }
    audioWindow.__delvewornAudioProbe = () => {
      const bossSources = sources.filter(source => isScore(source.node));
      const scoreVoices = bossSources.map(source => {
        const voice: ScoreVoice = {
          kind: source.kind, wave: source.node instanceof OscillatorNode ? source.node.type : "",
          start: source.start, stop: source.initialStop,
          frequency: source.node instanceof OscillatorNode ? automation.get(source.node.frequency) ?? [] : [],
          envelope: [], pan: null, filter: null,
          noise: source.node instanceof AudioBufferSourceNode ? Array.from(source.node.buffer!.getChannelData(0).slice(0, 8)) : null,
        };
        let next = [...links.get(source.node) ?? []][0];
        while (next && !scoreBuses.has(next)) {
          if (next instanceof GainNode) voice.envelope = automation.get(next.gain) ?? [];
          if (next instanceof StereoPannerNode) voice.pan = next.pan.value;
          if (next instanceof BiquadFilterNode) voice.filter = { type: next.type, frequency: next.frequency.value, Q: next.Q.value };
          next = [...links.get(next) ?? []][0];
        }
        return voice;
      });
      const scoreOutputGains = [...scoreBuses].map(bus => {
        const gains: number[] = [];
        let node: AudioNode | undefined = bus;
        while (node) {
          if (node instanceof GainNode) gains.push(node.gain.value);
          node = [...links.get(node) ?? []][0];
        }
        return gains;
      });
      const actionCues: Record<string, string[][]> = {};
      for (const gesture of gestures) {
        const signature = sources.filter(source => source.gesture === gesture.id && !isScore(source.node))
          .map(source => `${source.kind}:${(pitches.get(source.node) ?? []).join(",")}`);
        if (signature.length) (actionCues[gesture.action] ??= []).push(signature);
      }
      return {
        supported, contexts: contexts.size, resumes, suspends, scoreStarts, scoreStops,
        // Inspect the native bus, including suspension, rather than inferring
        // playback only from automation calls (WebKit wrappers may differ).
        activeScores: [...scoreBuses].filter(bus => bus.context.state === "running"
          && (bus as GainNode).gain.value > 0).length,
        bossSources: bossSources.length,
        futureBossSources: bossSources.filter(source => !source.ended
          && (source.stop === null || source.stop > source.node.context.currentTime + 0.02)).length,
        unscheduledNonScoreSources: sources.filter(source => !isScore(source.node)
          && !source.ended && source.stop === null).length,
        sourceCount: sources.length, actionCues, scoreVoices, scoreOutputGains,
      };
    };
  });
}

const probe = (page: Page) => page.evaluate(() => (window as AudioWindow).__delvewornAudioProbe());
const attack = (page: Page) => page.getByRole("button", { name: /⚔️ ATTACK/ });
const dock = (page: Page) => page.getByLabel("Combat actions");
const confirmedGame = (page: Page): Promise<PracticeGame> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).game, PRACTICE_RUN_STORAGE_KEY);

function actionWithConfirmedOutcome(signature: string[], action: "attack" | "storm" | "potion", game: PracticeGame) {
  const actionSourceCount = action === "storm" ? 7 : 3;
  const outcome = action === "potion" || game.lastPlayerDamage === 0
    ? [] : game.lastCritical ? ["tone:440", "tone:660", "tone:880"] : ["tone:125"];
  // Local outcomes now happen in the same gesture. Check every remaining
  // native source separately: extra actions or doubled outcome tones still fail.
  expect(signature.slice(actionSourceCount)).toEqual(outcome);
  return signature.slice(0, actionSourceCount);
}

async function seed(page: Page, overrides: Partial<PracticeGame> = {}) {
  const game: PracticeGame = {
    ...EMPTY_GAME, hasStarted: true, active: true, hp: 60,
    monsterHp: 9999, monsterMaxHp: 9999, armorLevel: 5, log: [], ...overrides,
  };
  expect(isStoredPracticeGame(game)).toBe(true);
  await installProbe(page);
  await page.addInitScript(({ key, game }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, game }));
  }, { key: PRACTICE_RUN_STORAGE_KEY, game });
  await page.goto("/practice");
  await expect(attack(page)).toBeEnabled();
  test.skip(!(await probe(page)).supported, "This browser has no Web Audio implementation.");
}

async function expectScoreStopped(page: Page) {
  await expect.poll(async () => (await probe(page)).activeScores).toBe(0);
  await expect.poll(async () => (await probe(page)).futureBossSources).toBe(0);
  const before = await probe(page);
  await page.waitForTimeout(650);
  const after = await probe(page);
  expect(after.bossSources).toBe(before.bossSources);
  expect(after.scoreStarts).toBe(before.scoreStarts);
}

test("pointer and Enter share each action cue without duplicates or a room drone", async ({ page }) => {
  await seed(page);
  expect((await probe(page)).contexts).toBe(0);
  await attack(page).click();
  await expect(dock(page)).toHaveAttribute("aria-busy", "false");
  const pointerResult = await confirmedGame(page);
  await attack(page).focus();
  await page.keyboard.press("Enter");
  await expect(dock(page)).toHaveAttribute("aria-busy", "false");
  const keyboardResult = await confirmedGame(page);
  await expect.poll(async () => (await probe(page)).actionCues.attack?.length ?? 0).toBe(2);
  const actions = (await probe(page)).actionCues.attack;
  const pointerAttack = actionWithConfirmedOutcome(actions[0], "attack", pointerResult);
  expect(pointerAttack).toEqual(["noise:", "tone:920", "tone:145"]);
  expect(actionWithConfirmedOutcome(actions[1], "attack", keyboardResult)).toEqual(pointerAttack);
  await attack(page).focus();
  await page.keyboard.down("Enter");
  await expect(dock(page)).toHaveAttribute("aria-busy", "false");
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  expect((await probe(page)).actionCues.attack).toHaveLength(3);
  expect(actionWithConfirmedOutcome((await probe(page)).actionCues.attack[2], "attack", await confirmedGame(page))).toEqual(pointerAttack);
  await page.getByRole("button", { name: /⚡ STORM/ }).focus();
  await page.keyboard.press("Enter");
  await expect(dock(page)).toHaveAttribute("aria-busy", "false");
  const keyboardStormResult = await confirmedGame(page);
  await page.getByRole("button", { name: /⚡ STORM/ }).click();
  await expect(dock(page)).toHaveAttribute("aria-busy", "false");
  const pointerStormResult = await confirmedGame(page);
  const storm = (await probe(page)).actionCues.storm;
  expect(storm).toHaveLength(2);
  // Storm deliberately varies its unresolved pitches, preserving the same cue
  // structure for mouse and keyboard without suggesting a known result.
  const keyboardStorm = actionWithConfirmedOutcome(storm[0], "storm", keyboardStormResult);
  const pointerStorm = actionWithConfirmedOutcome(storm[1], "storm", pointerStormResult);
  expect(keyboardStorm.map(note => note.split(":")[0])).toEqual(["tone", "tone", "tone", "tone", "tone", "noise", "tone"]);
  expect(pointerStorm.map(note => note.split(":")[0])).toEqual(keyboardStorm.map(note => note.split(":")[0]));
  await page.getByRole("button", { name: /POTION ·/ }).focus();
  await page.keyboard.press("Enter");
  await expect(dock(page)).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: /POTION ·/ }).click();
  await expect(dock(page)).toHaveAttribute("aria-busy", "false");
  const potion = (await probe(page)).actionCues.potion;
  expect(potion).toHaveLength(2);
  const potionResult = await confirmedGame(page);
  expect(actionWithConfirmedOutcome(potion[0], "potion", potionResult)).toEqual(["tone:340", "tone:510", "tone:760"]);
  expect(actionWithConfirmedOutcome(potion[1], "potion", potionResult)).toEqual(["tone:340", "tone:510", "tone:760"]);
  expect((await probe(page)).bossSources).toBe(0);
  expect((await probe(page)).unscheduledNonScoreSources).toBe(0);
  const resumeCount = (await probe(page)).resumes;
  await page.getByRole("button", { name: "Mute sound" }).click();
  await expect(page.getByRole("button", { name: "Enable sound" })).toBeVisible();
  await page.getByRole("button", { name: "Enable sound" }).click();
  await expect.poll(async () => (await probe(page)).resumes).toBeGreaterThan(resumeCount);
  expect((await probe(page)).unscheduledNonScoreSources).toBe(0);
  const before = (await probe(page)).sourceCount;
  await page.waitForTimeout(650);
  expect((await probe(page)).sourceCount).toBe(before);
});

test("boss plays the Market Dungeon opening bar at 84 BPM with its stereo voicing and mix", async ({ page }) => {
  await seed(page, { roomsCleared: 9, monsterType: 3 });
  expect((await probe(page)).contexts).toBe(0);
  await page.getByRole("button", { name: "Mute sound" }).click();
  await page.getByRole("button", { name: "Enable sound" }).click();
  await expect.poll(async () => (await probe(page)).bossSources).toBeGreaterThanOrEqual(24);
  const playing = await probe(page);
  expect(playing.scoreStarts).toBe(1);
  expect(playing.activeScores).toBe(1);
  expect(playing.scoreOutputGains).toHaveLength(1);
  expect(playing.scoreOutputGains[0]).toHaveLength(2);
  expect(playing.scoreOutputGains[0][0]).toBeCloseTo(0.34, 6);
  expect(playing.scoreOutputGains[0][1]).toBeCloseTo(0.72, 6);
  const voices = playing.scoreVoices.slice(0, 24);
  const origin = voices[0].start;
  const steps = [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 4, 4, 6, 8, 8, 8, 8, 10, 10, 11, 12, 12, 14];
  // Frozen-reference MIDI pitches; null entries are drum skin buffers.
  const notes = [50, 57, 65, 76, 38, 26, null, null, 62, 74, 38, null, null, 38, 38, 26, null, null, 69, 81, 38, null, null, 38];
  for (const [index, voice] of voices.entries()) {
    expect(voice.start - origin).toBeCloseTo(steps[index] * (60 / 84 / 4), 5);
    if (notes[index] !== null) expect(voice.frequency[0][1]).toBeCloseTo(440 * 2 ** ((notes[index]! - 69) / 12), 6);
  }
  expect(voices.slice(0, 7).map(voice => voice.wave)).toEqual(["sine", "triangle", "sine", "triangle", "triangle", "sine", "sine"]);
  for (const [index, pan] of [-0.345, -0.115, 0.115, 0.345].entries()) expect(voices[index].pan).toBeCloseTo(pan, 6);
  expect(voices[8].pan).toBeCloseTo(-0.15, 6);
  expect(voices[18].pan).toBeCloseTo(0.15, 6);
  expect(voices[0].envelope.map(event => event.slice(0, 2))).toEqual([["set", 0], ["linear", 0.03], ["set", 0.03], ["linear", 0]]);
  expect(voices[0].envelope[1][2] - origin).toBeCloseTo(0.32, 6);
  expect(voices[0].envelope[3][2] - origin).toBeCloseTo(60 / 84 * 3.95, 6);
  expect(voices[0].stop - origin).toBeCloseTo(60 / 84 * 3.95 + 0.005, 6);
  expect(voices[6].frequency.map(event => event.slice(0, 2))).toEqual([["set", 118], ["exponential", 42]]);
  expect(voices[11].frequency.map(event => event.slice(0, 2))).toEqual([["set", 176], ["exponential", 91]]);
  const drums = voices.filter(voice => voice.kind === "noise");
  expect(drums).toHaveLength(4);
  expect(drums.map(voice => voice.filter?.frequency)).toEqual([540, 1050, 540, 1050]);
  for (const drum of drums) {
    expect(drum.filter?.type).toBe("lowpass");
    expect(drum.filter?.Q).toBeCloseTo(0.65, 6);
    expect(drum.noise).toHaveLength(8);
    expect(drum.noise).toEqual(drums[0].noise);
    expect(drum.noise!.some(sample => Math.abs(sample) > 0.01)).toBe(true);
  }
});

for (const ending of ["knockout", "death"] as const) {
  test(`boss ${ending} cancels native music sources and every future scheduled note`, async ({ page }) => {
    await seed(page, {
      roomsCleared: 9, monsterType: 3, monsterHp: ending === "knockout" ? 1 : 9999,
      hp: ending === "death" ? 1 : 100, armorLevel: ending === "death" ? 0 : 5,
    });
    expect((await probe(page)).contexts).toBe(0);
    // Unlock before the lethal action. WebKit can take longer to initialize
    // its device than a one-hit local fight; that must never start music late.
    await page.getByRole("button", { name: "Mute sound" }).click();
    await page.getByRole("button", { name: "Enable sound" }).click();
    await expect.poll(async () => (await probe(page)).activeScores).toBe(1);
    await attack(page).click();
    await expect(attack(page)).toHaveCount(0);
    expect((await probe(page)).scoreStarts).toBeGreaterThan(0);
    expect((await probe(page)).bossSources).toBeGreaterThan(0);
    await expectScoreStopped(page);
  });
}

test("boss music stays paused after blur and an external audio interruption until a new gesture", async ({ page }) => {
  await seed(page, { roomsCleared: 9, monsterType: 3 });
  await attack(page).click();
  await expect(dock(page)).toHaveAttribute("aria-busy", "false");
  await expect.poll(async () => (await probe(page)).activeScores).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("button", { name: "Resume sound" })).toBeVisible();
  await expectScoreStopped(page);
  const paused = await probe(page);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(350);
  expect((await probe(page)).resumes).toBe(paused.resumes);
  await page.getByRole("button", { name: "Resume sound" }).click();
  await expect.poll(async () => (await probe(page)).activeScores).toBe(1);
  await page.evaluate(() => (window as AudioWindow).__interruptDelvewornAudio());
  await expect(page.getByRole("button", { name: "Resume sound" })).toBeVisible();
  await expectScoreStopped(page);
  await page.getByRole("button", { name: "Resume sound" }).click();
  await expect.poll(async () => (await probe(page)).activeScores).toBe(1);
  await page.getByRole("link", { name: "Delveworn home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expectScoreStopped(page);
});
