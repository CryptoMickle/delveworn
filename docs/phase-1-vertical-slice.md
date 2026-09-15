# Delveworn — the first descent

Milestone B proposal, 2026-09-15. Status: **awaiting visual approval**.
The one-room concept illustrates this proposal; it does not implement C–F.

## Product promise

Enter an ominous, slightly ridiculous dungeon. Walk a small adventurer through
torchlit rooms, read the enemy's next move, choose a risk, and see exactly what
it cost. The equipped relic is part of the character's silhouette. A defeated
enemy leaves a physical doorway ahead, not a new menu disconnected from the room.

Practice starts immediately without wallet, RPC, payment or account. Keep all
game copy in English, matching Delveworn. Wallet/onchain information belongs in
the optional mode boundary. Somnia is the proposed onchain configuration; the
core and renderer contain no chain names, RPC clients or wallet calls.

## First 10–15 minutes (target, to measure in blind tests)

| Time | Experience | Decision learned |
| --- | --- | --- |
| 0–1 min | Enter; choose one of three training relics; walk to the first enemy | The relic changes what the character does. |
| 1–3 min | Zombie and Goblin fights; damage numbers and a one-line result | Attack is narrow/crit; Storm is wide and can roll zero. |
| 3–6 min | Orc, a second encounter, then room-5 supplies | Saving potions versus buying weapon/armor upgrades. |
| 6–10 min | Three harder encounters; see build strengths and tradeoffs | Read intention before committing; use potion's reduced retaliation. |
| 10–12 min | Room 9 and Kevin's camp | Spend gold on recovery or damage before the boss. |
| 12–15 min | Dungeon Lord, relic reward, clear recap and replay | Recognize a boss cycle and understand why the run succeeded/failed. |

Time targets are not artificial timers. No animation padding to force session
length. Aim for 40–60 meaningful player decisions; tune from observed playtime.

## Rooms and progression

**Ten combat rooms**, matching the existing boss cadence. Entrance, supplies,
camp and reward are spaces/overlays associated with those rooms, not extra
authoritative combat clears. This avoids rewriting every boss/save assumption.

1. Entrance vestibule + Zombie tutorial.
2. Goblin storeroom.
3. Orc guard chamber.
4. Mixed fight; introduce a second intention.
5. Fight, then supply alcove (current supply rules).
6. Crypt fight: reinforce potion timing.
7. Goblin fight: pressure build choice.
8. Orc fight: armor/Storm payoff.
9. Last regular fight, then Kevin's boss camp (current camp rules).
10. Dungeon Lord, existing boss relic reward and end-of-descent summary.

Use one reusable stone-room kit with dressing, lighting and door variations.
No branching map. A ten-node strip distinguishes cleared/current/unseen rooms
with icons and labels, plus darkness beyond unopened doors. The same floor,
avatar and HUD remain visible when combat ends and during purchases/relic choice.

## Controls and combat rhythm

- Desktop: WASD/arrows move while the scene has focus; click floor to walk;
  click an enemy to approach. Enter/E interacts with doors and camp objects.
  In combat use visible buttons or 1 Attack / 2 Storm / 3 Potion.
- Mobile: tap floor/target to walk, plus optional four-direction pad. At least
  44px touch targets. Native scrolling remains available outside the scene.
- No chasing enemies or collision damage. Moving does not spend a turn or
  generate a game roll. Combat starts when approaching an already spawned enemy.
- Scene position is bounded to a simple floor rectangle and door corridor.
  A central clear lane avoids pathfinding around complicated obstacles.
- During combat, stand at a readable staging position. One input commits one
  turn. Show intent, action anticipation, confirmed hit, retaliation, then control.
- Local action feedback budget: 80–120ms anticipation; 120–220ms hit; total
  450–650ms before next action. Reduced motion keeps the same input guards.
- Onchain: immediate input acknowledgement, stable buttons, visible pending
  status; confirmed HP/VFX only after the authoritative result. No fake resolution
  countdown. Background/blur clears held movement input, not a submitted action.
- Killing blow prevents retaliation. Potion copy explains heal 25, half reply,
  caps/limits, and net HP. A zero Storm says "0 damage — Gary still retaliates."

## Enemy behavior and rules compatibility

Current contracts and Practice v1 are immediate retaliation with different
stats. The concept uses those exact rules and displays the real retaliation
range. It must not claim that current enemies have mechanics they do not have.

For milestone D, introduce **one versioned local training ruleset** with four
small intention cycles, built on the existing roll/armor/relic primitives:

| Enemy | Proposed training behavior | Player response |
| --- | --- | --- |
| Zombie | Every third reply is a visible wind-up (no hit), followed by a 1.5× hit | Heal safely on wind-up, or kill before the heavy reply. |
| Goblin | Every third player turn is "braced": normal damage ×0.75, Storm unchanged | Storm can bypass the brace; Attack remains more predictable otherwise. |
| Orc | Alternates 0.5× probing reply and 1.5× crushing reply | Time a potion for half of the heavy retaliation; armor gains clear value. |
| Dungeon Lord | Three-step loop: ordinary reply, guard (Attack ×0.75, 0.5× reply), crushing 1.75× reply | Use Storm at guard, prepare HP, then kill or potion through the crush. |

Show cycles before the player acts. Multipliers apply in a documented integer
order and require transition/golden tests; do not layer invisible damage in the
renderer. Tune these initial values with seeded simulations across all builds.
No new enemy species, spells, currencies or equipment systems.

**Compatibility decision:** new training behavior is opt-in via `rulesVersion`,
not a silent change to normal Practice saves or existing contracts. Extract
shared combat arithmetic only where necessary and prove unchanged v1 behavior
with golden vectors. Legacy/onchain modes retain their actual current rules and
honest "retaliates for X–Y" intent. An onchain mode may use new behavior only when
a matching contract rules version explicitly supports it. Do not deploy or
misrepresent such support in this phase. Both versions use the same room/art UI.

## Three builds using existing relics

| Build | Equipped relic | Meaningful choice | Avatar cue |
| --- | --- | --- | --- |
| Warden | Iron Shell (Common) | +20 max HP, −5% outgoing damage; sustain/armor and safe potions | Small orbiting iron plate, bronze shield pulse on damage. |
| Duelist | Echo Lens (Common) | +5 percentage points Attack crit, −20% Storm; weapon/Attack focus | Floating lens, clean gold ring on a critical. |
| Stormcaller | Stormglass (Uncommon) | +30% Storm damage, −5% normal damage; higher variance | Floating violet crystal, arc from relic to target. |

In the new **Practice training scenario only**, entrance choice initializes an
explicit training loadout before saving under its separate scenario key. It is
not an earned drop/NFT and does not alter normal Practice inventory. The small
concept presets Stormglass to make that layer reviewable immediately.

Onchain shows only actually owned/equipped relics from the snapshot. It never
grants a fake starter relic. Show no relic when none is equipped; an introductory
training run remains a separate local mode. Boss rewards follow existing rules.

## Visual direction — original monster artwork is the source of truth

User correction on 2026-09-15: **keep the style of the original monster artwork**.
The earlier painted target and flat vector figures are not the chosen style.
Use the detailed, dimensional fantasy rendering already present in Gary,
Grave Belle, Thud and Dungeon Lord: sculpted forms, exaggerated expressive
faces, weathered skin/leather/metal and cinematic dungeon lighting. Preserve
each character's identity, equipment and silhouette, as well as the original
portrait files. Match the new avatar, environment and effects to these sources.
Gary has a hair tuft, huge eyes, rope belt, ragged loincloth and dagger; he does
not gain the helmet, armor or mace from the rejected prototype.
Keep Delveworn's amber brass, soot-black masonry, plum shadows, violet Storm and
green healing. Existing logo, relic and monster artwork remain authoritative.
One stable overhead camera; feet and cast shadows anchor figures to the floor.
Use restrained gold borders and serif room headings, legible sans-serif numbers.
The dungeon should occupy most of the screen; UI supports it rather than replacing it.

Current review material:

- `frontend/public/concept/original-style-revision.png`: revised ImageGen
  mockup made with the actual original monster illustrations as references.
  This is a visual proposal, not a browser screenshot or production asset set.
- Local `/concept` opens with unchanged original Gary, Grave Belle and Thud
  artwork and the revised mockup. The earlier movement/combat study is collapsed
  and explicitly labeled as temporary graphics, so it cannot be mistaken for
  the selected style. Its Practice transitions remain intact.
- `phase-1-evidence/original-style-revision-prompt.md` records the reference
  files, exact prompt, provenance and mockup limitations.
- `phase-1-evidence/art-direction-target.png` is retained only as rejected
  history. Do not use it or the vector scene as a style reference.

After layout/concept approval, create the small room/avatar/sprite adaptations
in the original style. Do not replace the existing artwork, redesign monsters,
or introduce a separate visual style per room. The original-style requirement
is decided by the user; it does not need another preference question.

### Avatar/relic layers

- One base adventurer; facing/idle/walk/attack/hit/death states.
- Separate weapon and armor attachments keyed to equipment level.
- A relic anchor next to the shoulder: object/icon + rarity halo; no 15× avatar
  animation sets. Relic ID maps to visual behavior, not wallet identity.
- HUD: equipped name, rarity, effect and cost. Touch/click can expand details.
- Confirmed effect events only: Stormglass pulse on Storm; Ashen Fang healing
  glow after kill; Grave Pact/Undying Flame revive flare. No fake stat bonuses.
- Future ownership can be supplied through a boundary; no NFT dependency now.

### Environment, feedback and sound

Small kit: floor/wall/door, torch, column, debris, camp/shop props; one avatar,
four enemy silhouettes, three initial relic effects with a generic fallback for
the remaining catalog. Shared style/palette across entrance, fights and recovery.
Attack slash, critical accent, purple Storm arc, healing motes, revive ring.
Damage numbers and concise causal text accompany every effect; never color alone.

Reuse current audio controller and action cues. Add one quiet optional ambient
loop for exploration and retain a boss cue; no music starting before interaction.
Mute and pause/background behavior remain. Reduced motion removes shake/flashes;
no high-frequency flicker. Limit particles, avoid large animated filters, pause
offscreen work, lazy-load other rooms. Verify on a real phone before release.

## Desktop and mobile

Desktop: compact header/HUD; scene left (about 70%), enemy/intent/relic detail
right; action dock immediately below the scene. No modal hiding the enemy.
Mobile: room-first vertical layout; health/room/resources at top; scene at least
300px high; current intent and three large actions directly beneath; relic detail
compact/expandable, history secondary. Avoid hover-only information. Landscape
and 200% zoom remain usable. Focus rings, named targets, text status, reduced motion.

## Technical design after approval

```text
Practice state/engine ────┐
                         ├─ read-only scene view + guarded action interface
Contract snapshot ───────┘                │
                                         ├─ room renderer / avatar / fog
                                         ├─ HUD / combat / recovery
Confirmed result delta ───────────────────└─ VFX + sound (no game RNG)
```

- `SceneView`: confirmed room key, phase, avatar equipment, enemy, resources,
  allowed actions, pending/error and previous resolved delta.
- `SceneActions`: existing start/attack/storm/potion/enter/purchase/equip calls.
  Practice and onchain supply adapters, renderer imports neither wallet nor RPC.
- `RoomLayout`: deterministic static geometry keyed by room/type, independent
  of combat randomness. Only render current room and a doorway preview.
- One authoritative gameplay state per mode. Visual state holds coordinates,
  facing and animation only, never a second HP/inventory/progression model.
- Door request keyed by run/room identity, submitted once; hold at threshold
  until a newer snapshot. Failure returns to safe threshold with retry. No
  optimistic room increment or double charge. Test late snapshots/account changes.
- On reload: derive completed/current phase from confirmed progress; restore
  to a safe entry/cleared-room anchor. Clamp optional saved coordinates; do not
  trust them for actions. Unknown local save versions remain preserved.
- New training save namespace/version contains scenario/rules IDs; legacy keys
  remain intact. One engine reducer per ruleset, no separate scene combat engine.
- Keep the concept route local-development-only and unlinked from the home page.
  Remove or retire it after integration; it is not the new default experience.

## Verification and gate

Milestone B concept acceptance: move by key/tap; approach Goblin; perform
Attack/Storm/Potion with real Practice results; see relic, intent, health and
feedback; kill enemy and inspect open doorway. Reset is explicit. One room only,
no persistent run, ownership claim or onchain request.

After visual approval, test C–F: full ten-room completion and death for all
builds; movement/door guards; save reload at combat/recovery/relic/camp/boss;
rapid input and pending failures; unchanged v1 golden behavior; relic effects;
blocked storage; independent game/audio RNG; keyboard/touch/reduced motion;
lint/typecheck/unit/Foundry/Playwright/build matrix and device visual review.
No onchain transaction is needed for local adapter/contract regression tests.

Blind test 5–10 newcomers without explanation. Observe time to move/first hit,
understanding of intent/Storm risk/potion retaliation, noticing relic activation,
camp spending, cause of death and voluntary replay. Ask: "What changed because
of your relic?", "Why did you lose HP?", "What would you try differently?".
Do not call it production-ready before a full pass and actual device checks.

## Explicit exclusions

No real-time combat, enemy pursuit, complex collision, large open map, branching
tournament platform, Weekly expansion, token/NFT, social integrations, SDK,
partner/grant work, new chain dependency, deployment or contract transaction.
The current Somnia VRF adapter issue remains outside Phase 1.
