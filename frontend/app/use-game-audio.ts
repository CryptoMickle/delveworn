"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  GAME_AUDIO_STORAGE_KEY,
  GameAudioController,
  INITIAL_GAME_AUDIO_SNAPSHOT,
  type GameAudioAction,
  type GameAudioOutcome,
} from "./game-audio";

let controller: GameAudioController | null = null;
let users = 0;
let detach: (() => void) | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

function getController(): GameAudioController | null {
  if (typeof window === "undefined") return null;
  if (controller) return controller;
  controller = new GameAudioController({
    createContext: () => {
      const AudioContextClass = window.AudioContext
        ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      return AudioContextClass ? new AudioContextClass() : null;
    },
    isForeground: () => !document.hidden && document.hasFocus(),
    readPreference: () => window.localStorage.getItem(GAME_AUDIO_STORAGE_KEY),
    writePreference: value => window.localStorage.setItem(GAME_AUDIO_STORAGE_KEY, value),
    setTimer: (callback, milliseconds) => window.setTimeout(callback, milliseconds),
    clearTimer: timer => window.clearTimeout(timer as number),
  });
  controller.subscribe(notify);
  return controller;
}

function attachBrowserAudio() {
  users += 1;
  if (users > 1) return;
  const audio = getController();
  if (!audio) return;
  const pause = () => audio.pause();
  const visibility = () => { if (document.hidden) pause(); };
  const preference = (event: StorageEvent) => {
    if (event.key === GAME_AUDIO_STORAGE_KEY) audio.syncPreference(event.newValue);
  };
  window.addEventListener("blur", pause);
  window.addEventListener("pagehide", pause);
  window.addEventListener("storage", preference);
  document.addEventListener("visibilitychange", visibility);
  navigator.mediaDevices?.addEventListener("devicechange", pause);
  detach = () => {
    window.removeEventListener("blur", pause);
    window.removeEventListener("pagehide", pause);
    window.removeEventListener("storage", preference);
    document.removeEventListener("visibilitychange", visibility);
    navigator.mediaDevices?.removeEventListener("devicechange", pause);
  };
  notify();
}

function detachBrowserAudio() {
  users = Math.max(0, users - 1);
  if (users > 0) return;
  detach?.();
  detach = null;
  controller?.destroy();
  controller = null;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const getSnapshot = () => controller?.getSnapshot() ?? INITIAL_GAME_AUDIO_SNAPSHOT;
const getServerSnapshot = () => INITIAL_GAME_AUDIO_SNAPSHOT;

const methods = {
  playAction: (action: GameAudioAction) => getController()?.playAction(action),
  playSceneAction: (action: GameAudioAction) => controller?.playSceneAction(action),
  playOutcome: (outcome: GameAudioOutcome) => controller?.playOutcome(outcome),
  playCharacter: (name: string) => controller?.playCharacter(name),
  setBossBattle: (active: boolean) => controller?.setBossBattle(active),
  toggleSound: () => getController()?.toggleSound(),
};

/** The header can use this without options; only the game should own boss state. */
export function useGameAudio(options?: { bossActive?: boolean; encounter?: string; encounterKey?: string | number }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => { attachBrowserAudio(); return detachBrowserAudio; }, []);
  const bossActive = options?.bossActive;
  const encounter = options?.encounter;
  const encounterKey = options?.encounterKey;
  useEffect(() => {
    if (bossActive === undefined) return;
    methods.setBossBattle(bossActive);
    return () => { methods.setBossBattle(false); };
  }, [bossActive]);
  useEffect(() => {
    if (encounter) methods.playCharacter(encounter);
  }, [encounter, encounterKey]);
  return { ...snapshot, ...methods };
}
