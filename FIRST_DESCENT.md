# The First Descent — Phase 1 review build

Status: gameplay corrections available in the phone preview; browser/device verification
remains open. Preview deployment history is recorded in
`docs/phase-1-evidence/verification.md`. No production release or contract
transaction is included. Shareable preview access tokens are never committed.

## Start and play

From `frontend/`, install existing dependencies if needed (`npm ci`) and run
`npm run dev -- --hostname 127.0.0.1 --port 3100`. Open
<http://127.0.0.1:3100/play>, or choose **Play The First Descent** on the home page.
`/concept` is the historical development-only visual review.

1. Start a run. The original starting state applies: **100 HP, three potions,
   zero gold, base weapon/armor and no owned or equipped relic**. No build or
   relic selection, wallet, account or payment.
2. Tap the floor or use arrows/WASD to walk. The avatar turns left/right with
   travel and moves continuously to the monster guarding the north door.
   E/Enter approaches the enemy or uses the cleared room's exit.
3. Approaching starts a short close-up of the original monster illustration.
   It fades away after two seconds of loaded artwork. Attacking, waiting for
   an action, or landing a killing blow keeps the same timer. **Close artwork**
   dismisses it explicitly. **View monster** reopens a larger
   view during combat. HP and action controls remain usable throughout, and
   monsters retain their modest tier-1 scale on the room floor.
   Use **Storm (left) / Attack (right)** with **Potion below**. On short mobile
   viewports, the row is **Storm / Potion / Attack**. Keys **1 / 2 / 3** remain
   Attack / Storm / Potion; **A / S / P** work during combat. Attack has the original
   steady damage and critical chance. Storm has its original range and can roll
   zero. Potion heals 25 HP and receives the original half-strength retaliation
   during combat. Two combat potions per normal encounter, three per boss.
4. After victory, loot appears at a seeded random location on the visible floor.
   Tap the floor/loot or use arrows to walk there: entering pickup range collects
   it automatically, without another button press. Inventory changes once, on
   reaching the loot. To bypass it, tap the north doorway directly instead.
   The avatar walks to the door without collecting along that route, and leaves
   the reward only on arrival. Canceling that walk keeps the loot available.
   Reload does not collect or reroll the reward or its layout for that viewport.
   No separate pickup or bypass button is required or shown.
   The existing boss relic decision remains separate.
5. The original status bar remains above the room, including HP, potion stock,
   gold, equipment and room. Tap the green **POTION** button below the report
   on mobile (in the recovery sidebar on desktop) to heal after a kill, before
   or after picking up loot. It consumes one potion without retaliation,
   a combat turn or a random draw; held loot stays on the floor. Full HP, empty
   inventory and pending actions disable it. Recovery healing also remains in
   **Menu**. Combat's Potion remains in its established position.
   The orange **Enter room** button walks to the north doorway;
   the room changes only after arrival. A floor tap or E uses the same walk.
   Kevin appears in person after rooms 5 and 9: tap his figure, walk beside him,
   or use **Visit Kevin** to approach and open trade. His original illustration
   supplies the room sprite. He stands at the outer left in room 5 and outer
   right in room 9, always facing inward, with the approach point inside the
   room. Both positions follow the visible floor bounds on phones. The room-9
   camp retains its original 15 HP arrival
   recovery and existing shop prices.
6. Defeat the room-10 boss and collect or leave its floor loot. The earned relic can then be
   kept or equipped using the original relic rules. Review the recap or replay.

On mobile, the room panel fills the available browser viewport. Its background
continues behind the HUD. Room/progress, inventory, sound and Menu occupy the top
of the grid; HP, feedback and contextual actions occupy the bottom. The room
camera fills fixed viewport-based tracks between them, so action text, busy
states and switching between exploration/combat/loot cannot resize the room.
Artwork is not stretched and monsters are not enlarged. Desktop retains its
existing wider layout. Sound starts on interaction; mute is in the header. The UI uses the same background
as classic Practice/onchain and respects reduced motion and phone safe areas.

## Rules and authority

`app/descent/model.ts` is a presentation/progression wrapper around the actual
Practice engine. It retains the ten curated encounters, but uses the engine's
**default** Attack, Storm, Potion, critical, armor, loot, camp and relic rules.
The former starter builds, extra guard penalties and alternating reply multipliers
are removed. Enemy descriptions report ordinary retaliation; they do not change it.

A killing action calls the engine exactly once. Its existing loot roll and total
resource changes are stored as `pendingLoot`; gold, potions and upgrades wait for
collection. Walking to the loot applies those exact deltas once, without spending
a turn or advancing RNG. Door entry, shopping, healing and boss relic decisions
wait until the player collects or explicitly leaves the floor resources. Camp/kill HP effects retain their original timing.
The boss relic offer is rolled by the engine at victory, and claimed after the
floor-loot choice.

A new run receives a local random seed. Seed and PRNG state are saved. Animation,
walking, audio and loot collection do not draw new combat randomness. Floor
placement uses a separate seed/room hash, fitted to reachable camera bounds.
Changing portrait camera bounds retargets an active walk from its displayed
position to the same reachable destination (including relocated loot). Leaving
the page cancels the walk; the next input starts at the displayed point. Movement
uses one monotonic clock, with a timer fallback when animation frames stall.
Invalid floor coordinates are ignored before they can affect movement. Local saves
are editable by their owner; validation rejects inconsistent/malformed data, not
all cheating. This is local gameplay, not a competitive or onchain proof.

The scene consumes `RoomView` / `RoomActions`, not wallets, RPCs or chain names.
Endless Practice and the existing onchain client now reuse the room renderer;
see `ENDLESS_GRID.md`. The Weekly mode keeps its existing verified flow.
Somnia remains the intended onchain configuration. Its previously observed VRF
adapter mismatch is unresolved; no live onchain verification is claimed here.

## Save and recovery

Rules: `first-descent-2`. Save key: `delveworn_first_descent_v2`.
Earlier `delveworn_first_descent_v1` preview saves are preserved separately;
their starter relics are not imported into the corrected rules.

- Saves include the run ID, seed/RNG state, revision, original game state,
  engagement, pending loot and recap counters.
- Reload resumes combat, uncollected loot, recovery or boss relic selection at
  a safe avatar position. It cannot grant rewards twice.
- Unknown/newer saves stay untouched until explicit replacement is chosen.
- Denied storage allows clearly labeled session-only play.
- Revision checks and Web Locks prevent stale writes where supported. A lock held
  by another tab produces a retry message instead of waiting indefinitely; the
  attempted write is not applied. Conflicts expose **Resume saved run**, including
  inside mobile reward panels. Without Web Locks, compare-before-write is best-effort. There is no server/cross-device save.
- Start again confirms replacement of the active run. Other modes' saves remain.

No new names, emails, wallet identifiers or analytics identities are collected.

## Verification

From `frontend/`:

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
node --import tsx scripts/simulate-descent.ts
npm run test:e2e
```

Regression checks compare corrected starts and combat outcomes with the original
engine, including RNG, all loot types, once-only pickup, reload and boss relic
keep/equip behavior. The original Practice/Weekly golden traces remain required.
Actual results and preview checks are in `docs/phase-1-evidence/verification.md`.

Browser scenarios cover wallet-free entry, keyboard/repeated actions, movement
and loot pickup, full run/reload/shop/relic choices, compact mobile controls and
invalid/blocked storage. Browser automation remains blocked because its required
admin policy check is unavailable. Static illustration exports and HTTP checks
are not mobile/browser gameplay verification.

## Mobile viewport behavior

The active run uses `100dvh` with `100svh`/`100vh` fallbacks. This fills Safari's
available page area; it does not hide browser chrome or request OS fullscreen.
Safe-area padding protects controls near the notch and home indicator. Pinch
zoom remains enabled. The iPhone 11 Pro test profile has a 375×812 screen and a
375×635 browser viewport; the browser spec also checks 375×812 and 375×568.

Room sizing never changes combat/RNG/save state. The portrait camera caps actors
at the previous mobile visual scale and limits walking to its visible floor.
The mobile room has a dedicated enemy strip with current/max HP, a red health
bar and retaliation. The bottom dock reuses the real Practice `CombatActionDock`:
player/enemy HP, TOOK/DEALT, criticals, damage ranges, potion stock/usage and explicit
unavailable reasons. Potion is below the two attacks, or centered between Storm
and Attack at viewport heights of 700px or less. The default Practice/onchain UI
and all engine rules remain unchanged.

The last-action report stays readable and opens the full log. Modal/menu input
does not trigger attacks behind the panel. Menu opens help, journal and restart. Visit Kevin opens a scrollable modal after
the avatar arrives. Relic rewards and final results use scrollable room panels.
Storage problems remain visible in the HUD. No new wallet or chain integration.

## Next phone test

Use the latest owner-authorized preview link. Observe:

The latest correction covers free walking before Approach, rapid retargeting,
missing animation frames, invalid floor points, viewport changes and held save
locks. **Enter room** now walks to the doorway after loot, using the same resilient
movement clock as floor navigation. The movement and
full progression checks are recorded in the verification document; this review
build still needs confirmation on the affected phone.
If a separate error screen appears, use **Copy error report** and share the text with
the developer. **Resume saved run** reloads the last committed state without
starting a new run. This report stays local until manually shared. A full
browser process crash/reload cannot be caught by the in-game error screen.

- Starting immediately without a relic choice; walking in several directions
  before Approach, then reaching combat without reloading.
- Finding both enemy and player HP; Attack on the right and Potion below/in the
  middle; readable damage and potion reasons without hunting or scrolling.
- Reading retaliation and understanding Storm misses and Potion healing.
- Walking to loot; seeing the inventory update once; walking to the exit afterwards.
- Meeting Kevin at the left/right outer edge in rooms 5/9, facing into the room,
  and walking to his figure to open trade.
- Seeing the original monster close-up stay visible for the same two seconds
  while attacking, then reopening it without changing HP or room layout.
- A steady room during repeated attacks; smooth Approach; left/right facing;
  varied loot locations and automatic pickup using only floor taps or arrows.
- Reload before and after pickup; recovery at supplies/camp and the boss relic.
- Original background, item transparency, touch targets and sound on a phone.

After browser verification, run the planned uncoached 5–10-person blind test.
Ask what each action did, when loot entered the inventory, why HP changed and
what the player would try next. Record anonymous observations and aggregate times.
Human first-run duration and the intended 10–15-minute session remain unmeasured.

This is a **review build, not production or certified blind-test ready** until
current browser and physical-phone checks pass.
