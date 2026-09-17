export const COMBAT_CUE_DURATION_MS = 280;
export const TOUCH_COMBAT_COOLDOWN_MS = 280;
export const NON_COMBAT_COOLDOWN_MS = 160;

/** Desktop can accept the next confirmed turn immediately. Touch devices keep
 * a short guard against rapid accidental taps; neither value controls thermal
 * load, which is handled by the room's reduced mobile animation rules. */
export function descentActionCooldown(combatAction: boolean, coarsePointer: boolean) {
  if (!combatAction) return NON_COMBAT_COOLDOWN_MS;
  return coarsePointer ? TOUCH_COMBAT_COOLDOWN_MS : 0;
}
