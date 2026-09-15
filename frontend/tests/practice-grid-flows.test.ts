import assert from 'node:assert/strict';
import test from 'node:test';
import { startRun, attack, usePotion as drinkPotion, enterNextRoom, claimRelic, buy, getMerchantVisit } from '../app/practice/engine';
import { createSeededRandom } from '../app/practice/random';
import { createPracticeGrid, engagePracticeGrid, countPracticeTurn, holdPracticeLoot, collectPracticeLoot, skipPracticeLoot, enterPracticeRoom, practiceGridPhase } from '../app/practice/grid-state';
import { savePracticeRun, inspectPracticeRun } from '../app/practice/storage';

test("Practice collect/leave flows restore valid saves after every transition across 100 seeded runs", (context) => {
  // A fixed policy exercises ordinary deaths and both loot choices; it does not boost HP.
  let actions = 0, collected = 0, skipped = 0, deaths = 0, deepest = 0, restores = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const random = createSeededRandom(seed);
    let game = startRun(random.nextInt), grid = createPracticeGrid(seed), raw = '';
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const check = () => {
      assert.equal(savePracticeRun(storage, game, grid), 'saved', `save rejected: seed=${seed} room=${game.roomsCleared} phase=${practiceGridPhase(game, grid)}`);
      const restored = inspectPracticeRun(storage);
      assert.equal(restored.status, 'restored');
      if (restored.status !== 'restored') throw Error('save not restored');
      assert.deepEqual(restored.game, game);
      assert.deepEqual(restored.grid, grid);
      game = restored.game; grid = restored.grid; restores++;
    };
    check();
    let steps = 0;
    while (game.active && game.roomsCleared < 50) {
      assert.ok(++steps < 2000, `stalled seed ${seed}`);
      const phase = practiceGridPhase(game, grid);
      if (phase === 'explore') grid = engagePracticeGrid(grid);
      else if (phase === 'combat') {
        const canHeal = game.hp <= 40 && game.potions > 0 && game.combatPotionsUsed < (game.monsterType === 3 ? 3 : 2);
        const before = game;
        game = canHeal ? drinkPotion(game, random.nextInt) : attack(game, random.nextInt);
        assert.notEqual(game, before, 'combat must make progress');
        ({ game, grid } = holdPracticeLoot(before, game, countPracticeTurn(grid)));
        if (!game.active) grid = { ...grid, engaged: false };
        actions++;
      } else if (phase === 'loot') {
        const randomBefore = random.state();
        if ((seed + game.roomsCleared) % 4 === 0) { grid = skipPracticeLoot(grid); skipped++; }
        else { ({ game, grid } = collectPracticeLoot(game, grid)); collected++; }
        assert.equal(random.state(), randomBefore);
      } else if (phase === 'reward') game = claimRelic(game, seed % 2 === 0);
      else if (phase === 'recovery') {
        if (game.hp <= game.maxHp - 25 && game.potions > 0) game = drinkPotion(game, random.nextInt);
        const visit = getMerchantVisit(game);
        if (visit) game = buy(game, visit === 'supply' ? 'supply-bandage' : 'camp-rest');
        if (visit) game = buy(game, visit === 'supply' ? 'supply-potion' : 'camp-potion');
        check();
        game = enterNextRoom(game, random.nextInt); grid = enterPracticeRoom(grid);
      } else throw Error(`Unexpected phase: ${phase}`);
      deepest = Math.max(deepest, game.roomsCleared);
      check();
    }
    if (!game.active) deaths++;
  }
  context.diagnostic(JSON.stringify({ runs: 100, actions, collected, skipped, deaths, deepest, validSaveRestores: restores }));
});
