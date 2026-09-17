export type CombatRange = readonly [minimum: number, maximum: number];

function orderedRange(first: number, second: number): CombatRange {
  return first <= second ? [first, second] : [second, first];
}

export function parseCombatRange(value: string): CombatRange | null {
  const match = /^\s*(\d+)\s*(?:[–-]\s*(\d+))?\s*$/.exec(value);
  if (!match) return null;
  const first = Number(match[1]);
  const second = match[2] === undefined ? first : Number(match[2]);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(second)) return null;
  return orderedRange(first, second);
}

export function formatCombatRange([minimum, maximum]: CombatRange): string {
  return minimum === maximum ? String(minimum) : `${minimum}–${maximum}`;
}

/**
 * Mirrors the original combat engine: add the full heal, subtract the halved
 * reply, and cap the final value at max HP. Incoming values are expected to
 * already include armor and relic modifiers.
 */
export function potionResultingHpRange({
  hp,
  maxHp,
  incoming,
  heal = 25,
}: {
  hp: number;
  maxHp: number;
  incoming: CombatRange;
  heal?: number;
}): CombatRange {
  const [incomingMinimum, incomingMaximum] = orderedRange(incoming[0], incoming[1]);
  const resultFor = (damage: number) => Math.max(0, Math.min(maxHp, hp + heal - Math.ceil(damage / 2)));
  return orderedRange(resultFor(incomingMaximum), resultFor(incomingMinimum));
}

export function lethalRetaliationIsPossible({
  hp,
  enemyHp,
  actionDamage,
  incoming,
}: {
  hp: number;
  enemyHp: number;
  actionDamage: CombatRange;
  incoming: CombatRange;
}): boolean {
  const [minimumDamage] = orderedRange(actionDamage[0], actionDamage[1]);
  const [, maximumIncoming] = orderedRange(incoming[0], incoming[1]);
  return hp > 0 && enemyHp > minimumDamage && maximumIncoming >= hp;
}
