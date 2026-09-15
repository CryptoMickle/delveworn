# The First Descent — local Phase 1 review build

Status: implementation available locally; browser/device verification remains
open. No deployment or contract transaction is included in this phase.

## Start and play

From `frontend/`, install existing dependencies if needed (`npm ci`) and run
`npm run dev -- --hostname 127.0.0.1 --port 3100`. Open
<http://127.0.0.1:3100/play>, or choose **Play The First Descent** on the home page.
`/concept` is the old development-only visual review, not the new full run.

1. Choose Warden, Duelist or Stormcaller. No wallet/account/payment.
2. Click/tap the floor, or focus it and use arrows/WASD. E/Enter approaches the
   enemy or walks to the door. The large approach/door controls are equivalent.
3. Read the next intention. Attack is narrow with crits; Storm varies from zero
   to a higher maximum and bypasses a guard; Potion heals 25 before a half reply.
   Use buttons or desktop keys 1/2/3. Two combat potions per ordinary fight,
   three against the boss; safe healing between fights has no combat limit.
4. Walk to the north door after winning. Supplies follow room 5. Kevin's camp
   after room 9 restores up to 15 HP on arrival and offers recovery/equipment.
5. Defeat room-10 Management, collect the local relic and review the recap.
   Try another build for a fresh set of rolls. The training loadout is fixed
   for this descent; the boss relic is a local end-of-run reward.

Mute/resume is in the header. Sound starts only after interaction. The scene
uses native scrolling outside movement controls and respects reduced motion.

## Rules and authority

`app/descent/model.ts` defines the ten-room sequence and `first-descent-1` rules.
`practice/engine.ts` supplies the real combat, loot, healing, armor, relic and
shop operations. Optional context parameters leave classic v1 calls unchanged.
The entry grants one explicitly local training relic. No onchain item is granted.

Normal damage order: roll, critical, existing relic rounding, floor(guard %).
Reply order: roll, floor(intent %), armor, existing incoming relic rounding.
Wind-up zero stays zero; combat Potion halves the resulting reply, rounding up.
A killing blow prevents the reply. Zombie turns 3/6/9… wind up; the following
reply is 150%. Gary guards every third action. Thud alternates 50%/150% replies.
Management cycles normal, guard with a 50% reply, then a 175% reply.

A new run receives a local random seed. Its seed and PRNG state are saved.
The pure reducer reproduces the next outcome from the same saved state/action;
animation, walking and sound never consume this RNG. This is a local learning
game, not a competitive proof or anti-cheat system. Local saves can be edited
by their owner; validation rejects malformed/inconsistent data, not all cheating.

The scene consumes `RoomView` and `RoomActions`, not wallets, RPCs or chain names.
Classic Practice, prior Weekly work and the existing onchain renderer remain.
Somnia is the intended onchain product configuration. Current contract behavior
does not support training intentions or free starter relics, and is not presented
as doing so. The previously observed VRF adapter mismatch is still unresolved.

## Save and recovery

Only `delveworn_first_descent_v1` is written for this mode. Saves include rules,
run ID, seed/RNG state, revision, build, actual Practice game, engagement/turns
and recap counters. No name, wallet, email or new analytics identity is added.
Existing site-wide analytics remain unchanged; no new analytics dependency.

- Reload resumes combat, recovery, camp or reward at a safe scene anchor.
- Invalid/newer saves remain untouched until **Replace save & enter** is chosen.
- Denied storage/quota allows session-only play with a visible notice.
- Revisions and Web Locks prevent stale writes where supported. Without Web
  Locks compare-before-write is best-effort. Use one tab for a run; no cross-device
  save or server synchronization exists.
- Start again asks before replacing an in-progress descent. Classic saves remain.

## Verification

Run from `frontend/`:

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
node --import tsx scripts/simulate-descent.ts
npm run test:e2e
```

Browser suite: desktop Chromium, Android-sized Chromium, small iPhone WebKit.
The new tests cover fresh entry, keyboard/repeated input, full run/reload/shop/
reward, responsive/reduced motion and invalid/blocked storage. They are authored
but **not yet run for this checkpoint** because the agent's browser policy check
is unavailable. Do not mistake test discovery or static art exports for a pass.
After policy access is restored, rerun the full suite and inspect actual pages.

Repository root: `forge fmt --check`, `forge build --sizes`, `forge test`.
The existing frontend CI matrix includes RISE legacy, Somnia standard and Somnia
session keys. Those configurations are build checks, not chain transactions.

`docs/phase-1-status.md` is the continuation record; evidence includes exact art
prompts, source-rendered scene illustrations, seeded simulation JSON and checks.

## Blind test once the browser gate passes

Invite 5–10 people unfamiliar with the game. Give only the `/play` link and
"Try to survive the dungeon." Do not explain buttons or recommend a build.
Use local/private review access approved by the project owner; do not publish
or send invitations automatically. `127.0.0.1` is only the current computer,
not a link another device can reach.

Observe and time:

- First movement and first attack; ability to find the next doorway.
- Whether intention changes are noticed before committing an action.
- Understanding that Storm can roll zero, guard only reduces Attack, and a
  potion can still receive damage.
- Recognition of the floating relic and its benefit/cost.
- Supply/camp purchases, understanding room-9 recovery, and the boss cycle.
- Reload during a run, mobile scrolling/targets, sound/mute and reduced motion.
- Cause of death, time to complete and voluntary replay/build change.

Ask after play: "What changed because of your relic?", "Why did you lose HP?",
"What did you expect Storm/Potion to do?", "What would you try differently?"
Record only aggregate counts/times and anonymous observations; no unnecessary
personal data. The automated policy's 67.5–76% win rate is not a beginner target.
The planned 10–15-minute session length is still unmeasured; do not add delays
to make the duration fit.

Release gate: a complete current browser pass, actual desktop and physical-phone
review, no progress-loss/duplicate-action bug, and understandable first-run play.
Until then this is a **local review build, not production or certified blind-test ready**.
