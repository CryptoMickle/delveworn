import { CombatActionDock } from "../game-ui";
import { attackRange, combatRelicSummary, currentCriticalChance, incomingRange, stormRange } from "../practice/engine";
import { getRelicDefinition } from "../relics";
import type { Descent } from "./model";

const MAX_POTIONS = 5;

function damageRange([minimum, maximum]: [number, number]) {
  return `${minimum}–${maximum}`;
}

function healthState(hp: number, maxHp: number) {
  if (hp <= maxHp * 0.25) return "danger";
  if (hp <= maxHp * 0.55) return "warning";
  return "healthy";
}

function progress(hp: number, maxHp: number) {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(100, (hp / maxHp) * 100));
}

export function DescentCombatPanel({
  run,
  busy,
  onAction,
}: {
  run: Descent;
  busy: boolean;
  onAction: (action: "attack" | "storm" | "potion") => void;
}) {
  const game = run.game;
  const attackDamage = attackRange(game);
  const stormDamage = stormRange(game);
  const incoming = incomingRange(game);
  const criticalChance = currentCriticalChance(game);
  const potionLimit = game.monsterType === 3 ? 3 : 2;
  const potionLimitReached = game.combatPotionsUsed >= potionLimit;
  const potionDisabledReason = busy
    ? "Resolving action…"
    : game.potions === 0
      ? "No potions left · restock at Kevin's"
      : game.hp >= game.maxHp
        ? "HP is full · save it for later"
        : potionLimitReached
          ? "Combat limit reached"
          : null;
  const relic = getRelicDefinition(game.equippedRelic);
  const playerHealth = healthState(game.hp, game.maxHp);

  return (
    <div
      className="descent-actions descent-practice-controls"
      role="group"
      aria-label="Combat actions"
      aria-busy={busy}
    >
      <div
        className="descent-player-health-track"
        data-health={playerHealth}
        role="progressbar"
        aria-label="Player health"
        aria-valuemin={0}
        aria-valuemax={game.maxHp}
        aria-valuenow={Math.max(0, Math.min(game.maxHp, game.hp))}
      >
        <span style={{ width: `${progress(game.hp, game.maxHp)}%` }} />
      </div>
      {busy && (
        <span className="descent-practice-busy-enemy" role="status">
          ENEMY HP <strong>{game.monsterHp}/{game.monsterMaxHp}</strong>
          <em>Resolving…</em>
        </span>
      )}
      <CombatActionDock
        busy={busy}
        hp={game.hp}
        maxHp={game.maxHp}
        enemyHp={game.monsterHp}
        enemyMaxHp={game.monsterMaxHp}
        lastExchange={run.roomTurns > 0 ? {
          dealt: game.lastPlayerDamage,
          taken: game.lastMonsterDamage,
          critical: game.lastCritical,
        } : undefined}
        retaliation={damageRange(incoming)}
        stormDamage={damageRange(stormDamage)}
        attackDamage={damageRange(attackDamage)}
        criticalChance={criticalChance}
        potionLabel={`🧪 POTION · ${game.potions}/${MAX_POTIONS}`}
        potionDetail="Heal 25 HP · monster retaliates at half damage"
        potionUsage={<>{game.combatPotionsUsed}/{potionLimit}<span>used</span></>}
        potionDisabled={potionDisabledReason !== null}
        potionDisabledReason={potionDisabledReason}
        potionLimitReached={potionLimitReached}
        relicName={relic.name}
        stormRelicSummary={combatRelicSummary(game, true)}
        attackRelicSummary={combatRelicSummary(game, false)}
        onStorm={() => onAction("storm")}
        onPotion={() => onAction("potion")}
        onAttack={() => onAction("attack")}
      />
    </div>
  );
}

export function DescentEnemyStatus({
  name,
  hp,
  maxHp,
  incoming,
  isBoss,
}: {
  name: string;
  hp: number;
  maxHp: number;
  incoming: string;
  isBoss: boolean;
}) {
  return (
    <section className="descent-enemy-status" data-boss={isBoss || undefined} aria-label={`${name} combat status`}>
      <div className="descent-enemy-status-heading">
        <strong>{isBoss ? "BOSS" : "ENEMY"} · {name}</strong>
        <span>HP <b>{hp}/{maxHp}</b></span>
      </div>
      <div
        className="descent-enemy-health-track"
        role="progressbar"
        aria-label="Enemy health"
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-valuenow={Math.max(0, Math.min(maxHp, hp))}
      >
        <span style={{ width: `${progress(hp, maxHp)}%` }} />
      </div>
      {hp > 0
        ? <p>💥 RETALIATION <strong>{incoming} DAMAGE</strong> IF IT SURVIVES</p>
        : <p data-cleared="true">✓ ENEMY DEFEATED · ROOM SECURED</p>}
    </section>
  );
}
