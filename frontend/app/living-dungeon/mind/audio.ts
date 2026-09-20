/** Short, event-driven motifs. No background rendering loop or continuously running oscillator. */
export function createMindAudio() {
  let context: AudioContext | null = null;
  let enabled = false;
  return {
    async toggle() {
      enabled = !enabled;
      if (enabled) {
        context ??= new AudioContext();
        try { await context.resume(); } catch { enabled = false; }
      } else if (context) await context.suspend();
      return enabled;
    },
    motif(kind: "understand" | "learn" | "step" | "echo") {
      if (!enabled || !context || context.state !== "running" || document.hidden) return;
      const notes = kind === "understand" ? [220, 330, 440] : kind === "learn" ? [164, 155, 110] : kind === "echo" ? [110, 82, 55] : [90];
      for (let i = 0; i < notes.length; i++) {
        const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + i * 0.16;
        oscillator.type = "sine"; oscillator.frequency.value = notes[i]; gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(kind === "step" ? 0.018 : 0.065, start + 0.025); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + 0.65);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
    },
    async close() { if (context) await context.close(); },
  };
}
