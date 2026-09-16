"use client";

import { useEffect, useRef } from "react";

const CONTROLS = 'button, a[href], summary, [role="button"]';
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="textbox"], [role="combobox"]';
const EXCLUDED = '[inert], [hidden], [aria-hidden="true"], [data-keyboard-exclude], [data-wallet-controls]';
const MODAL = 'dialog[open], [role="dialog"][aria-modal="true"]:not([hidden]), [role="alertdialog"][aria-modal="true"]:not([hidden]), .descent-mobile-menu[open], .descent-supplies-menu[open]';
const SCROLL_HEADER = "[data-keyboard-scroll-header]";

export type ArrowDirection = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";
export type NavigationRect = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

/** Keep vertical movement in the same column through a full-width control. */
export function spatialTarget<T>(
  current: NavigationRect,
  candidates: ReadonlyArray<{ item: T; rect: NavigationRect }>,
  direction: ArrowDirection,
  preferredX: number | null,
): { item: T | null; preferredX: number | null } {
  const x = (current.left + current.right) / 2;
  const y = (current.top + current.bottom) / 2;
  const horizontal = direction === "ArrowLeft" || direction === "ArrowRight";
  const sign = direction === "ArrowLeft" || direction === "ArrowUp" ? -1 : 1;
  const lane = horizontal ? null : preferredX === null || preferredX < current.left || preferredX > current.right ? x : preferredX;
  const ranked = candidates.map(candidate => {
    const next = candidate.rect;
    const nx = (next.left + next.right) / 2;
    const ny = (next.top + next.bottom) / 2;
    const forward = sign * (horizontal ? nx - x : ny - y);
    const aligned = horizontal
      ? next.top < current.bottom && next.bottom > current.top
      : (lane ?? x) >= next.left && (lane ?? x) <= next.right;
    const lateral = Math.abs(horizontal ? ny - y : nx - (lane ?? x));
    return { item: candidate.item, forward, aligned, distance: forward + (aligned ? 0 : lateral * 2) };
  }).filter(candidate => candidate.forward > 1)
    .sort((a, b) => Number(b.aligned) - Number(a.aligned) || a.distance - b.distance);
  return { item: ranked[0]?.item ?? null, preferredX: lane };
}

function available(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.matches(':disabled, [aria-disabled="true"]')
    || element.closest(EXCLUDED)) return false;
  if (typeof element.checkVisibility === "function"
    && !element.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0"
    || element.getClientRects().length === 0 || rect.width <= 0 || rect.height <= 0) return false;
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  // Overlays still block the controls beneath them. A button covered only by
  // the sticky HUD remains a destination: focusing it will reveal it below
  // that header. Offscreen controls likewise remain reachable by scrolling.
  if (x >= 0 && x < window.innerWidth && y >= 0 && y < window.innerHeight) {
    const hit = document.elementFromPoint(x, y);
    if (!hit || (!element.contains(hit) && !hit.closest(SCROLL_HEADER))) return false;
  }
  return true;
}

export function KeyboardHint() {
  return <p className="desktop-keyboard-hint">↑ ↓ ← → choose an action · Enter select</p>;
}

/**
 * Opt-in presentation navigation. Mark game actions with data-keyboard-actions;
 * wallet controls and site navigation keep their own behavior. Open modals own
 * arrow focus while focused buttons retain their native Enter activation.
 * Activation always follows the existing guarded button callback and audio path.
 */
export function DesktopNavigation() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = marker.current?.closest("main");
    if (!root) return;
    let enterHeld = false;
    let preferredX: number | null = null;
    let remembered: HTMLElement | null = null;
    const forgetSelection = () => { remembered = null; preferredX = null; };
    const focus = (item: HTMLElement) => {
      remembered = item;
      item.focus({ preventScroll: true });
      item.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      const rect = item.getBoundingClientRect();
      let visibleTop = 8;
      for (const header of root.querySelectorAll<HTMLElement>(SCROLL_HEADER)) {
        if (header.contains(item)) continue;
        const box = header.getBoundingClientRect();
        const position = window.getComputedStyle(header).position;
        if ((position === "sticky" || position === "fixed") && box.height > 0
          && box.bottom > 0 && box.left < rect.right && box.right > rect.left) {
          visibleTop = Math.max(visibleTop, box.bottom + 8);
        }
      }
      if (rect.top < visibleTop) window.scrollBy({ top: rect.top - visibleTop, behavior: "instant" });
    };
    const keydown = (event: KeyboardEvent) => {
      // Tab and pointer input return focus ownership to the browser. A later
      // Enter must never reactivate an action the player navigated away from.
      if (event.key === "Tab") { forgetSelection(); return; }
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey
        || event.metaKey || event.shiftKey) return;
      if (event.key !== "Enter" && !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      const targetElement = event.target instanceof Element ? event.target : null;
      const target = targetElement instanceof HTMLElement ? targetElement : null;
      if (targetElement?.closest(EDITABLE) || targetElement?.closest(EXCLUDED)) return;
      if (targetElement && targetElement !== document.body && targetElement !== document.documentElement && !root.contains(targetElement)) return;
      const targetControl = targetElement?.closest<HTMLElement>(CONTROLS) ?? null;
      const openModal = document.querySelector<HTMLElement>(MODAL);
      // A wallet or third-party modal outside this game owns every key itself.
      if (openModal && !root.contains(openModal)) return;
      const modal = openModal;
      if (modal) {
        // Native Enter activates its focused button; arrows below only move
        // focus inside this modal.
        if (event.key === "Enter") return;
        if (targetElement && targetElement !== document.body && targetElement !== document.documentElement
          && !modal.contains(targetElement)) return;
      }
      const scopes = [...root.querySelectorAll<HTMLElement>("[data-keyboard-action-scope]")]
        .filter(scope => (!modal || modal.contains(scope)) && scope.getClientRects().length > 0 && !scope.closest(EXCLUDED)
          && window.getComputedStyle(scope).visibility !== "hidden");
      // A real pending-action overlay owns navigation even when the previous
      // battle or result remains mounted underneath it.
      const overlay = scopes.find(scope => scope.dataset.keyboardActionScope === "overlay");
      const actionScope = modal ?? overlay ?? scopes[0] ?? root;
      if (overlay && event.key === "Enter" && targetControl && !overlay.contains(targetControl)) {
        event.preventDefault();
        return;
      }
      // Enter and Tab remain native on navigation, help and wallet controls.
      // An arrow can re-enter the action field after using another page control,
      // just as it does in Market Dungeon; it never activates the entry choice.
      if (event.key === "Enter" && targetControl
        && (!targetControl.closest("[data-keyboard-actions]") || !actionScope.contains(targetControl))) return;
      const items = [...actionScope.querySelectorAll<HTMLElement>(CONTROLS)]
        .filter(item => (Boolean(modal) || Boolean(item.closest("[data-keyboard-actions]"))) && available(item));
      if (!items.length) {
        if (overlay) event.preventDefault();
        return;
      }
      const unfocused = !targetElement || targetElement === document.body || targetElement === document.documentElement || !target;
      // Browsers drop focus when an action temporarily disables its button.
      // Keep that same connected button for the next physical key gesture,
      // while requiring it to be enabled again before it can be activated.
      const selected = targetControl
        ?? (unfocused && remembered?.isConnected && items.includes(remembered) ? remembered : null);
      if (event.key === "Enter") {
        if (!selected || !items.includes(selected)) return;
        event.preventDefault();
        if (enterHeld || event.repeat) return;
        enterHeld = true;
        focus(selected);
        // This synchronous click runs within the real key gesture. Audio is
        // emitted by the existing action callback, once, without another cue.
        selected.click();
        return;
      }
      event.preventDefault();
      const direction = event.key as ArrowDirection;
      if (!selected || !items.includes(selected)) {
        preferredX = null;
        const edges = items.filter(item => item.closest('[data-keyboard-vertical="edges"]'))
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
            || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        if (edges.length && (direction === "ArrowUp" || direction === "ArrowDown")) {
          focus(edges[direction === "ArrowUp" ? 0 : edges.length - 1]);
        } else {
          focus(items.find(item => item.dataset.keyboardDefault === "true") ?? items[0]);
        }
        return;
      }
      const next = spatialTarget(selected.getBoundingClientRect(),
        items.filter(item => item !== selected).map(item => ({ item, rect: item.getBoundingClientRect() })),
        direction, preferredX);
      preferredX = next.preferredX;
      focus(next.item ?? selected);
    };
    const release = (event: KeyboardEvent) => {
      if (event.key === "Enter") enterHeld = false;
    };
    const reset = () => { enterHeld = false; forgetSelection(); };
    const focusChanged = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target !== remembered && target.matches(CONTROLS)) forgetSelection();
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("keyup", release);
    document.addEventListener("focusin", focusChanged);
    document.addEventListener("pointerdown", forgetSelection);
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("keyup", release);
      document.removeEventListener("focusin", focusChanged);
      document.removeEventListener("pointerdown", forgetSelection);
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
    };
  }, []);
  return <span ref={marker} hidden />;
}
