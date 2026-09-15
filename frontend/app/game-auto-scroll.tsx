"use client";

import { useLayoutEffect, useRef } from "react";

/** Keep the HUD and encounter in view when a run opens or its room changes. */
export function GameAutoScroll({ encounter }: { encounter: string | null }) {
  const anchor = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!encounter) return;
    // Finish before paint so a later scroll cannot override keyboard navigation.
    // Instant scrolling also respects players who prefer reduced motion.
    anchor.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [encounter]);

  return <div ref={anchor} data-game-scroll-anchor aria-hidden="true" style={{ scrollMarginTop: 8 }} />;
}
