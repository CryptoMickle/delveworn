"use client";

import { useSyncExternalStore } from "react";

// Keep this breakpoint aligned with the room's mobile layout in game.css.
const SIDEBAR_QUERY = "(min-width: 761px)";
const snapshot = () => window.matchMedia(SIDEBAR_QUERY).matches;
const serverSnapshot = () => false;
const subscribe = (changed: () => void) => {
  const query = window.matchMedia(SIDEBAR_QUERY);
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
};

/** Place one live action panel in the sidebar or the mobile room controls. */
export function useRoomSidebar() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
