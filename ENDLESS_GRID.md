# Shared dungeon room — Practice and Somnia

The approved room presentation is shared by `/play`, `/practice`, and active
`/onchain` runs. `/play` remains the ten-room introduction. Practice and onchain
retain their existing endless progression, enemy selection, combat, shops,
boss cadence, relic rules and respective randomness authorities.

## Playing

- `/practice`: start without a wallet, account or payment. Walk toward the monster
  and use Approach, then Attack, Storm or Potion. The original starting kit is
  100 HP, three potions and no relic choice.
- On a keyboard, hold **WASD** for smooth free movement. Movement starts on the
  first keydown, continues without relying on operating-system key repeat, supports
  direction changes and diagonals, and stops on release, focus loss or an open
  input/dialog. Walking into the enemy's approach range starts combat. **E** walks
  to the current interaction: the enemy before combat or the north door after it.
  Arrow keys only move focus among visible action buttons, and **Enter** selects
  the focused button. Attack, Storm and Potion use the same arrow-and-Enter
  navigation; there are no J/K/M action shortcuts. Each physical Enter press
  resolves at most one action. After approaching, clearing a room, closing the
  boss reward, or entering a new room, the enabled default action receives focus.
  A pending onchain action delays this handoff until its controls are ready.
  Enter also activates the enabled Approach/Enter-room button when focus is on
  the floor or document after walking or restoring a room; selecting an action
  with arrows is not required first. Other controls retain their own behavior.
  In Kevin's shop,
  arrows move between its buttons and Enter activates the selected button;
  room movement remains paused while the dialog is open.
- On desktop, compact combat controls sit in the right sidebar directly below
  the monster card: Storm left, Attack right, Potion beneath. Player/enemy HP,
  damage ranges, potion stock and encounter limits stay in the panel. Phones
  keep the controls inside the room. Only one live action panel is mounted;
  changing the viewport neither duplicates actions nor advances the game.
- On phones, compact controls keep **Storm left, Potion middle, Attack right**.
  HP, damage ranges, potion count/usage and retaliation stay visible. The top
  status bar retains health, potions, gold and Gear; the room remains in the
  heading. The report and log retain action outcomes. Small monsters and the
  avatar are enlarged relative to the floor; large bosses keep enough headroom,
  and every tier still grows. Kevin, his wagon and loot retain their scale.
  Floor geometry stays stable through combat, loot and recovery. Short or wide
  phone viewports scroll when the full room and controls cannot fit, instead of
  cutting off the doorway, boss or buttons. Tap an empty floor area to walk.
- Click or tap empty floor to walk there, including during combat. Another
  floor click retargets the walk immediately. This changes only presentation:
  it does not spend a turn, heal, dodge an attack or consume randomness.
- The avatar faces left/right on even subpixel steps and uses the matching
  rear/front view when moving north/south. The same hooded character is retained.
  The exposed leg swings from the hip, including thigh, knee and boot; the
  cape-side visible lower leg takes a smaller opposite step. The painted upper
  body and cape stay steady. The
  original standing pose returns on arrival, release or pause. Reduced-motion
  settings keep the legs still.
- Opening a menu/dialog cancels the current walk, including click-to-walk.
  Closing it does not restart the cancelled trip.
- After victory, tap the loot in the grid for automatic pickup on arrival, or
  **tap the north doorway directly** to walk past the loot and continue.
  At merchant stops, drops reserve space around Kevin and his complete wagon,
  including both pickup and shop interaction ranges. The cosmetic placement
  stays deterministic and reachable after reload or resize. Clicking the loot
  image or its label targets pickup before merchant interaction.
  There is no separate pickup/bypass button. E uses the door; WASD can walk onto
  loot for automatic collection. Enter remains button selection.
  In `/play` and new Practice runs, leaving loot forfeits the held gold, potion,
  weapon or armor reward. Pickup or leaving advances no combat turn or RNG.
  The existing boss relic keep/equip decision remains separate. Loot is left only
  on door arrival; canceling/retargeting the walk preserves it. Failed room entry
  preserves the previous state and pending loot for retry.
- **Enter room** walks to the north doorway and advances only on arrival.
- The original **GameHud** stays above the room: HP and its health bar, potion
  stock, gold, equipment and room. Mobile Gear opens the existing equipment
  details. Picking up loot no longer replaces the potion count with Relics.
- After a kill, the original green **POTION** style is used below the report
  on mobile (in the recovery sidebar on desktop). It works before and after
  collecting loot, and can be selected with arrows and Enter. Full HP, empty stock
  and pending actions disable healing;
  floor loot and room turns are preserved. **Relics** has its own header button
  during recovery, and **Enter room** uses the original orange action style.
  **Menu** also retains recovery healing.
- There is no sustained exploration drone. Short action/character/outcome
  effects and the boss score retain their existing sound controls.
- On desktop, monster notes remain on parchment at the top right of the room.
  On phones, the small picture button opens the original monster painting and
  Field Notes; the persistent floor note is hidden. The full painting is fitted
  above scrollable notes, keeping the text off the artwork. The old
  bottom-right "Dungeon remarks" parchment is removed. Short speech bubbles
  next to the enemy contain direct spoken lines from that monster or boss,
  selected from its persona and confirmed combat outcome while it is alive.
  The compact speech bubble shares Field Notes' parchment background, dark ink,
  book-serif font and body-text sizing (12px desktop, 10.5px mobile), using the
  same appearance variables. It has no text shadow or visible nameplate;
  on mobile, it sits along the lower-right edge with at most three visible lines,
  leaving the centered monster and doorway clear. Its full line remains in the
  accessible text;
  its accessible label still identifies the speaker. A line disappears after
  4.2 seconds; ordinary rerenders do not restart its timer. Defeating the enemy
  immediately removes the bubble, with no final/death remark. Speech uses no
  randomness and does not alter the saved combat log. Neither
  notes nor speech take pointer input or change room size. The full log remains
  available. The cosmetic armor ring over the avatar is removed.
  The notes use IM Fell English, served with the app through the existing font
  pipeline, with book-serif fallbacks and slightly larger mobile text.
- The tier-two goblin is **Gribnob the Unqualified**; **Quartermaster Kevin**
  remains the merchant. Every monster uses its original painting, with its
  own traced silhouette; bitmap files are unchanged.
  The Executive Overlord's mask excludes the background wedges above his cape
  and keeps the painted red cloth between his legs, avoiding the false-wing shape.
  Gold has three stack silhouettes using the original Delveworn coin face:
  1–9 gold is one short stack, 10–24 is two stacks, and 25+ is three stacks.
  The label continues to report the exact reward.
- The room background follows the exact original monster illustration: sixteen
  rooms match the four monster families and their four artwork tiers. Each was
  generated with the existing room as the floor-plan reference and the matching
  original painting as the environmental reference. Purple crypts, torch-lit
  goblin passages, damp green orc chambers and red bureaucratic boss offices use
  the architecture, materials, lighting and details seen behind those monsters.
  The room changes on the same ten-room tier boundaries as the monster artwork;
  tier-four rooms continue in deeper runs. It stays stable through combat, loot
  and recovery. Central floor, north doorway, south stairs, movement, pickup and
  merchant coordinates are preserved. Mobile uses the same surrounding image.
  See `frontend/public/dungeon/rooms/original/README.md` for all assets, source
  paintings and exact generation prompts.
- Practice and onchain continue through rooms 11, 21, 31, 41 and beyond. The
  original four sets of monster artwork follow the ten-room tier cadence;
  the fourth artwork set continues in deeper tiers. All monsters grow with each
  tier. Zombies have a clear 120 → 144 → 168 → 190 room-unit progression over
  tiers 1–4. Later tiers grow gradually toward species-specific limits, keeping
  every monster below the doorway's 225-unit height limit. Tier-one actors stay
  small. Difficulty follows the existing engine/contract; visual size changes
  do not change stats, randomness or the room cap. Mobile floor-tap targets
  follow the enlarged artwork, and movement bounds retain a visible edge gutter.
- Kevin enters through the north door immediately after victory at existing
  supply/camp stops, while loot is still on the floor, and walks to one fixed
  upper-left position adjusted to the visible mobile floor. You may trade before
  collecting loot; purchases spend only gold already held. Shopping leaves the
  floor reward intact, and door arrival can still leave it behind. Picking up
  loot neither restarts Kevin's walk nor remounts him.
  He leads the wagon left, parks it, walks around its south side, and faces
  the wagon before turning it. He then pushes it to the visible left wall and
  turns back toward the room only after parking. He stands on the
  right/inward side with the wagon behind him. The original wagon,
  stock and no-refunds sign travel with him; the sign's lettering stays readable.
  Shopping waits for the complete arrival, turn and final push. Resizing preserves the current
  stage instead of replaying the entrance.
  Characters are drawn in floor-depth order: walking behind Kevin or his wagon
  places the avatar behind them, including during Kevin's entrance. Kevin and
  the wagon each use their own floor position for this ordering. Damage and
  healing feedback remain visible above the actors.
  Reduced-motion settings skip the entrance animation. Walk to him or use
  **Visit Kevin**. His shop shows the complete original rectangular painting,
  including the character, wagon and surroundings, with current
  HP, gold, potion count, weapon and armor above the purchase controls.
- The original monster illustration opens at fresh combat for two seconds after
  image load/error. Attacks, pending transactions, damage, and even a killing
  blow neither shorten nor restart that timer. **Close artwork** closes it
  explicitly; **View monster** reopens a manual view. Controls remain usable.
  The expanded artwork also shows the same Field Notes card (role, name and
  existing description) as the room, together with the monster's current HP.

## Reused components and authority

`app/dungeon/scene.tsx` owns floor navigation, sprites and proximity interactions.
`app/dungeon/endless-room.tsx` supplies the shared responsive HUD, dialogs,
portrait, reports and slots for the existing controls. It neither calculates
combat nor imports a wallet/RPC. Existing Practice/Onchain combat docks, shop
buttons, relic collection, boss decisions, wallet entry and results are reused.

`app/practice/engine.ts` remains the Practice authority. `grid-state.ts` holds
only presentation/proximity state and deferred local reward deltas. Each killing
engine action runs once; collection applies that recorded delta once and leaving
it clears the delta without credit. Camp/relic healing and room-clear effects
retain their original timing. The engine's randomness and damage rules are not
reimplemented by the renderer.

The onchain frontend consumes confirmed snapshots and uses the existing wallet,
transaction, VRF and canonical synchronization paths. The contract already grants
gold and rolled loot when it resolves a kill. Floor pickup acknowledges the display
without a transaction. Tapping the door skips the display and uses the existing
room-entry transaction once, retaining the loot display on a failed entry. Both
preserve the confirmed reward balance. The UI states rewards are already credited.
Boss relic decisions still use the existing contract-required operation.

Somnia is the intended onchain deployment. The preserved legacy network build
remains a compatibility check. This change does not configure VRF, call
`setConsumer`, alter any contract, or resolve the previously reported adapter
mismatch. No live onchain playthrough is claimed by the local tests.

## Saving and compatibility

Practice writes the game and optional validated `grid` metadata together in its
existing v1 save envelope. Existing saves without grid metadata restore their
already-credited rewards and combat readiness; they never re-hold old loot.
New saves preserve uncollected drops and the selected approach phase through
reload. Invalid metadata preserves the save for explicit recovery/replacement.
Existing conflict and session-only handling remain in place. Other modes keep
separate save keys.

Onchain walking and pending floor loot are presentation state. Reload resumes
canonical chain state rather than recreating a reward from stale `lastLoot`.
Wallet/player identity scopes presentation separately from gameplay authority.

## Artwork review

`frontend/scripts/render-dungeon-art.tsx` exports all 16 current monster masks
against a neutral background, both enlarged and at the mobile room scale.
The committed `docs/phase-1-evidence/monster-cutout-review.png` records the
latest static review. This catches clipped body parts and background chunks;
it does not validate browser input, responsive layout or actual gameplay.

## Verification and first phone check

Exact automated results and the current preview are recorded in
`docs/phase-1-evidence/verification.md`. Approved Browser interaction is blocked
by its mandatory admin-policy check; Node/component tests and static art exports
are not substitutes for mobile browser verification.

First test on the phone:

Check that the whole figure and doorway are visible, the picture button opens
readable Field Notes, and Storm/Potion/Attack remain reachable with Safari's
address bar expanded and collapsed. On especially short screens, scrolling is
intentional so that neither artwork nor controls have to be clipped.

1. Start `/practice`, tap empty floor to walk and retarget, approach, attack
   during the artwork display, then tap empty floor again during combat.
2. Defeat the enemy and tap the doorway directly while loot is still visible.
   The avatar walks to the door and enters without collecting. Repeat by tapping
   the loot itself; it is collected automatically on arrival. Retarget a door
   walk to the floor and confirm loot is still available. Reload around both choices.
3. After room 5, watch Kevin enter from the door and settle upper left with
   his wagon and readable sign. Visit him; check HP, gold, potions, weapon and
   armor, buy a supply and confirm the values update. He uses the same side
   at the next supply/camp stop.
4. Continue past the first boss and its relic decision into room 11. Confirm the
   next tier's original monster artwork appears and the run continues.

This remains a preview pending actual browser/phone checks and a separately
approved, working Somnia environment for live onchain verification.
