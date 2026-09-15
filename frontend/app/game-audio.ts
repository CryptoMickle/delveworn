import { BossBattleScore } from "./boss-battle-score";

/** Procedural presentation audio. It never reads or advances gameplay randomness. */
export const GAME_AUDIO_STORAGE_KEY = "delveworn_audio_enabled_v1";

export type GameAudioAction = "attack" | "storm" | "potion" | "click";
export type GameAudioOutcome = "hit" | "critical" | "loot" | "relic" | "victory" | "death";
export type GameAudioSnapshot = Readonly<{ enabled: boolean; paused: boolean; available: boolean }>;

export const INITIAL_GAME_AUDIO_SNAPSHOT: GameAudioSnapshot = Object.freeze({
  enabled: true, paused: false, available: true,
});

export type GameAudioEnvironment = {
  createContext: () => AudioContext | null;
  isForeground: () => boolean;
  readPreference?: () => string | null;
  writePreference?: (value: string) => void;
  setTimer: (callback: () => void, milliseconds: number) => unknown;
  clearTimer: (timer: unknown) => void;
};

type SourceGroup = "effect";

/** One controller is shared by the page and header. Browser APIs are injected for tests. */
export class GameAudioController {
  private readonly environment: GameAudioEnvironment;
  private snapshot: GameAudioSnapshot = INITIAL_GAME_AUDIO_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private bossScore: BossBattleScore | null = null;
  private readonly sources: Record<SourceGroup, Set<AudioScheduledSourceNode>> = {
    effect: new Set(),
  };
  private active = false;
  private engaged = false;
  private resuming = false;
  private bossActive = false;
  private stormVariant = 0;
  private destroyed = false;

  constructor(environment: GameAudioEnvironment) {
    this.environment = environment;
    try {
      if (environment.readPreference?.() === "off") {
        this.snapshot = { ...this.snapshot, enabled: false };
      }
    } catch { /* Sound remains optional when storage is blocked. */ }
  }

  getSnapshot = (): GameAudioSnapshot => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(next: Partial<GameAudioSnapshot>) {
    const snapshot = { ...this.snapshot, ...next };
    if (snapshot.enabled === this.snapshot.enabled && snapshot.paused === this.snapshot.paused
      && snapshot.available === this.snapshot.available) return;
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener());
  }

  private ensureContext(): AudioContext | null {
    if (this.destroyed) return null;
    if (this.context) return this.context;
    let context: AudioContext | null = null;
    try {
      context = this.environment.createContext();
      if (!context) { this.update({ available: false }); return null; }
      const master = context.createGain();
      master.gain.value = 0.58;
      master.connect(context.destination);
      // Match Market Dungeon's score mix without changing Delveworn's action cues.
      const scoreOutput = context.createGain();
      scoreOutput.gain.value = 0.72;
      scoreOutput.connect(context.destination);
      this.bossScore = new BossBattleScore(context, scoreOutput, {
        setTimer: this.environment.setTimer,
        clearTimer: this.environment.clearTimer,
        onError: () => this.pause(),
      });
      this.context = context;
      this.master = master;
      context.onstatechange = () => {
        if (context?.state === "running") {
          if (!this.active || !this.snapshot.enabled || !this.environment.isForeground()) this.pause();
          else this.syncBoss();
        } else if (this.active && !this.resuming) {
          // Audio interruptions must not be fought by a polling/resume loop.
          this.pause();
        }
      };
      this.update({ available: true });
      return context;
    } catch {
      this.context = null;
      this.master = null;
      this.bossScore = null;
      try { void context?.close().catch(() => undefined); } catch { /* Unavailable device. */ }
      this.update({ available: false });
      return null;
    }
  }

  /** Only call from a player action callback, never a timer or confirmed-state effect. */
  private activate(): boolean {
    if (this.destroyed || !this.snapshot.enabled || !this.environment.isForeground()) return false;
    const context = this.ensureContext();
    if (!context || context.state === "closed") return false;
    this.engaged = true;
    this.active = true;
    this.update({ paused: false });
    if (context.state === "running") { this.syncBoss(); return true; }
    if (this.resuming) return true;
    this.resuming = true;
    try {
      void context.resume().then(() => {
        if (!this.active || !this.snapshot.enabled
          || !this.environment.isForeground()) {
          this.pause();
        } else if (context.state === "running") {
          this.syncBoss();
        } else {
          this.pause();
        }
      }).catch(() => this.pause()).finally(() => { this.resuming = false; });
    } catch {
      this.resuming = false;
      this.pause();
      return false;
    }
    return true;
  }

  private canPlay(): boolean {
    return this.active && this.snapshot.enabled && this.environment.isForeground()
      && Boolean(this.context && (this.context.state === "running" || this.resuming));
  }

  /** Cancel both currently sounding and future scheduled sources on interruption. */
  pause = () => {
    this.active = false;
    this.stopBoss(true);
    this.stopSources("effect");
    if (this.engaged && this.snapshot.enabled) this.update({ paused: true });
    const context = this.context;
    if (!context || context.state === "closed" || context.state === "suspended") return;
    try { void context.suspend().catch(() => undefined); } catch { /* Output already disappeared. */ }
  };

  /** A change in another tab may mute, but may never resume this tab's playback. */
  syncPreference = (value: string | null) => {
    const enabled = value !== "off";
    this.pause();
    this.update({ enabled, paused: enabled && this.engaged });
  };

  toggleSound = () => {
    if (this.snapshot.enabled && this.snapshot.paused) { this.activate(); return; }
    const enabled = !this.snapshot.enabled;
    this.update({ enabled, paused: false });
    try { this.environment.writePreference?.(enabled ? "on" : "off"); } catch { /* Optional persistence. */ }
    if (enabled) this.activate();
    else this.pause();
  };

  /** Supply confirmed combat state; no audio method changes the game's result. */
  setBossBattle = (active: boolean) => {
    this.bossActive = active;
    this.syncBoss();
  };

  private syncBoss() {
    if (!this.canPlay() || this.context?.state !== "running") {
      this.stopBoss(true);
      return;
    }
    if (!this.bossActive) { this.stopBoss(); return; }
    try { this.bossScore?.start(); } catch { this.pause(); }
  }

  private stopBoss(immediate = false) {
    try { this.bossScore?.stop(immediate); } catch { /* Closed output. */ }
  }

  private stopSources(group: SourceGroup) {
    this.sources[group].forEach(source => {
      try { source.stop(this.context?.currentTime ?? 0); } catch { /* Source already ended. */ }
    });
    this.sources[group].clear();
  }

  private track(source: AudioScheduledSourceNode, group: SourceGroup, nodes: AudioNode[]) {
    this.sources[group].add(source);
    source.onended = () => {
      this.sources[group].delete(source);
      nodes.forEach(node => { try { node.disconnect(); } catch { /* Already disconnected. */ } });
    };
  }

  private tone(frequency: number, start: number, duration: number, volume: number,
    wave: OscillatorType = "triangle", group: SourceGroup = "effect", endFrequency?: number) {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.018, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    this.track(oscillator, group, [oscillator, gain]);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  private noise(start: number, duration: number, volume: number, frequency: number,
    group: SourceGroup = "effect") {
    if (!this.context || !this.master) return;
    const buffer = this.context.createBuffer(1, Math.max(1, Math.floor(this.context.sampleRate * duration)), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    // This random source is decorative and independent of every game/provider.
    for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.master);
    this.track(source, group, [source, filter, gain]);
    source.start(start);
    source.stop(start + duration + 0.01);
  }

  /** Mouse and keyboard should call this same method from the same action handler. */
  playAction = (action: GameAudioAction) => {
    if (!this.activate() || !this.canPlay() || !this.context) return;
    try {
      const now = this.context.currentTime + 0.008;
      if (action === "attack") {
        this.noise(now, 0.12, 0.22, 1350);
        this.tone(920, now, 0.105, 0.1, "triangle", "effect", 240);
        this.tone(145, now + 0.025, 0.15, 0.07, "square", "effect", 72);
      } else if (action === "storm") {
        // Unresolved, uneven motion conveys risk without claiming a win or loss.
        const patterns = [[640, 1010, 760, 1240, 900], [780, 1120, 670, 990, 840], [710, 950, 1220, 810, 1080]];
        const pitches = patterns[this.stormVariant++ % patterns.length];
        pitches.forEach((pitch, index) => this.tone(pitch, now + index * 0.044, 0.1, 0.05, "triangle"));
        this.noise(now, 0.24, 0.14, 1900);
        this.tone(170, now + 0.02, 0.2, 0.035, "sawtooth", "effect", 121);
      } else if (action === "potion") {
        [340, 510, 760].forEach((pitch, index) => this.tone(pitch, now + index * 0.075, 0.12, 0.075, "sine", "effect", pitch * 1.12));
      } else {
        this.tone(660, now, 0.045, 0.04, "triangle");
      }
    } catch { this.pause(); }
  };

  /** Confirmed feedback does not unlock or resume an interrupted AudioContext. */
  playOutcome = (outcome: GameAudioOutcome) => {
    if (outcome === "victory" || outcome === "death") {
      this.bossActive = false;
      // Endings have their own cue. Zero/disconnect the score immediately,
      // including a bus whose last voices ended before its fade completed.
      this.stopBoss(true);
    }
    if (!this.canPlay() || !this.context) return;
    try {
      const now = this.context.currentTime + 0.008;
      const notes: Record<Exclude<GameAudioOutcome, "hit">, number[]> = {
        critical: [440, 660, 880], loot: [784, 988], relic: [392, 494, 587, 784],
        victory: [262, 330, 392, 523, 659], death: [196, 185, 147, 98],
      };
      if (outcome === "hit") {
        this.tone(125, now, 0.1, 0.05, "triangle", "effect", 65);
        return;
      }
      notes[outcome].forEach((pitch, index) => this.tone(pitch, now + index * 0.095,
        outcome === "death" || outcome === "relic" ? 0.3 : 0.2,
        0.065, outcome === "death" ? "triangle" : "sine"));
    } catch { this.pause(); }
  };

  playCharacter = (name: string) => {
    if (!name || !this.canPlay() || !this.context) return;
    let fingerprint = 0;
    for (const letter of name) fingerprint = ((fingerprint * 31) + letter.charCodeAt(0)) >>> 0;
    const boss = /Lord|Overlord|Chairman/.test(name);
    const merchant = /Quartermaster/.test(name);
    const base = boss ? 98 : merchant ? 392 : 145 + fingerprint % 170;
    const intervals = boss ? [0, -2, -7] : merchant ? [0, 4, 7] : [0, 3 + fingerprint % 5, -2 - fingerprint % 5];
    try {
      intervals.forEach((interval, index) => this.tone(base * 2 ** (interval / 12),
        this.context!.currentTime + 0.008 + index * 0.11, 0.16, 0.055,
        merchant ? "sine" : "triangle"));
    } catch { this.pause(); }
  };

  destroy = () => {
    this.destroyed = true;
    this.pause();
    this.bossScore?.destroy();
    this.bossScore = null;
    if (this.context) {
      this.context.onstatechange = null;
      try { void this.context.close().catch(() => undefined); } catch { /* Already closed. */ }
    }
    this.context = null;
    this.listeners.clear();
  };
}
