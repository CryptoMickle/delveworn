# The First Descent — local compatibility mode and Weekly foundation

Status: the shared grid flow, Weekly V2 entry and Room 11 Practice continuation
are implemented locally. The current public game entry is **Weekly Challenge:
The First Descent**; this standalone local run remains available through its
explicit compatibility URL. No production deployment, contract transaction,
physical Safari test or external player test is claimed in this document.

## Start and play

From `frontend/`, install existing dependencies if needed (`npm ci`) and run
`npm run dev -- --hostname 127.0.0.1 --port 3100`. Open
<http://127.0.0.1:3100/play?legacy=1> for this standalone compatibility mode.
`/play` and the home-page Weekly action route to the current Weekly V2 grid.
`/concept` is the historical development-only visual review.

Monster notes and recent dungeon remarks are shown on small parchment sheets
inside the room, at the top right and bottom right. They reuse existing copy
and let clicks pass through to the floor. The full text remains in the log.
The avatar's cosmetic armor ring is removed; armor remains in the original HUD.

1. Start a run. The original starting state applies: **100 HP, three potions,
   zero gold, base weapon/armor and no owned or equipped relic**. No build or
   relic selection, wallet, account or payment.
2. Tap the floor or hold **WASD** to walk. Held movement starts immediately,
   continues without operating-system key repeat, supports diagonals and direction
   changes, and stops on release or focus loss. The avatar turns left/right with
   travel, and walking into the enemy's approach range starts combat. **E** walks
   to the enemy or uses the cleared room's exit. Arrow keys only navigate visible
   action buttons; **Enter** selects the focused button.
3. Approaching starts a short close-up of the original monster illustration.
   It fades away after two seconds of loaded artwork. Attacking, waiting for
   an action, or landing a killing blow keeps the same timer. **Close artwork**
   dismisses it explicitly. **View monster** reopens a larger
   view during combat. HP and action controls remain usable throughout, and
   monsters retain their modest tier-1 scale on the room floor.
   Use **Storm (left) / Attack (right)** with **Potion below**. On short mobile
   viewports, the row is **Storm / Potion / Attack**. **K / J / M** select
   Attack / Storm / Potion once per physical press. Attack has the original
   steady damage and critical chance. Storm has its original range and can roll
   zero. Potion heals 25 HP and receives the original half-strength retaliation
   during combat. Two combat potions per normal encounter, three per boss.
4. After victory, loot appears at a seeded random location on the visible floor.
   Tap the floor/loot or use WASD to walk there: entering pickup range collects
   it automatically, without another button press. Inventory changes once, on
   reaching the loot. To bypass it, tap the north doorway directly instead.
   The avatar walks to the door without collecting along that route, and leaves
   the reward only on arrival. Canceling that walk keeps the loot available.
   Reload does not collect or reroll the reward or its layout for that viewport.
   No separate pickup or bypass button is required or shown.
   The existing boss relic decision remains separate.
5. The original status bar remains above the room, including HP, potion stock,
   gold, equipment and room. Tap the green **POTION** button below the report
   on mobile (in the recovery sidebar on desktop), or press **M**, to heal after
   a kill before or after picking up loot. It consumes one potion without retaliation,
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
   kept or equipped using the original relic rules. The completed result remains
   available and can continue to Room 11 in local Endless Practice with the
   earned HP, supplies, equipment and relic. If another Practice save exists,
   the player must explicitly keep it or replace it; canceling preserves both
   original saves. Reopening the same continuation resumes later Practice
   progress instead of generating Room 11 again.

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
Endless Practice, Weekly V2 and the existing onchain client reuse the room
renderer; see `ENDLESS_GRID.md`. Weekly keeps separate deterministic state,
actions, scoring and replay verification. The archived Weekly V1 verifier is
frozen under `app/challenge/v1/`; old unversioned result links keep that flow,
while the single current Weekly entry uses V2 and the shared grid.

Somnia remains the intended onchain configuration. Exact physical loot equality
with local/Weekly play is blocked by the current contract granting loot in the
kill callback. The source/configuration boundary and required new-core/new-adapter
approach are documented in `SOMNIA_GRID_FLOW_REVIEW.md`. No live onchain
verification is claimed here.

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
- A completed Room 10 run creates a separate validated handoff keyed by its
  source run ID. Practice writes the import identity in the same save as the
  imported game and grid. Room 11 is generated once by the normal Practice
  engine and normal local randomness. Web Locks and compare-before-write checks
  protect retries, reloads and cooperating tabs.

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

The current local automated baseline is **248 passing tests**, a passing
production build (`next build --webpack`, including TypeScript) and lint with
**0 errors and 14 existing warnings**. Regression coverage includes frozen
Weekly V1 proofs, Weekly V2 replay, physical loot, Room 11 continuation,
existing-save confirmation, retry/resume behavior and local Practice records.

Internal browser QA completed two full V2 runs, sharing and friend-target
comparison, local leaderboard submission and Room 11 continuation/reload.
375×812, 320×568 and desktop layouts were inspected in the approved in-app
browser. See `LEVERANSE_FASE_1_2026-09-17.md` for actual results and limits.
Physical Safari, standalone Playwright execution and external players were not
tested in this delivery. A production build is not a production deployment.

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

## Remaining browser, phone and player verification

The approved in-app browser run should cover the following at 375×812,
320×568 and desktop. Physical Safari remains a separate check:

The latest correction covers free walking before Approach, rapid retargeting,
missing animation frames, invalid floor points, viewport changes and held save
locks. **Enter room** now walks to the doorway after loot, using the same resilient
movement clock as floor navigation. The movement and full progression behavior
still need confirmation in the current browser QA and on the affected physical
phone.
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
  varied loot locations and automatic pickup using only floor taps or WASD.
- Reload before and after pickup; recovery at supplies/camp and the boss relic.
- Original background, item transparency, touch targets and sound on a phone.

The planned uncoached 5–10-person blind test is intentionally deferred.
When resumed, run it after browser and physical-phone verification.
Ask what each action did, when loot entered the inventory, why HP changed and
what the player would try next. Record anonymous observations and aggregate times.
Human first-run duration and the intended 10–15-minute session remain unmeasured.

This is a local implementation state. It is **not a production deployment or a
certified external-test result**.
