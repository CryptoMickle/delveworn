# Rooms based on the original monster backgrounds

These sixteen empty environments replace the earlier generic family rooms.
Created 2026-09-16 with **built-in ImageGen edits**. Every generation used two
images: the existing `/dungeon/stone-room.webp` for the playable camera and
floor plan, and the matching original monster painting for architecture,
materials, lighting and environmental details. The original monster paintings
were not edited. No CLI/API fallback was used.

## Assets and source references

Each final asset is a 1536×1024 (3:2), opaque WebP converted at quality 90.
Links point to the exact saved asset and its original source painting.

| Family | Art tier | Monster | Room asset | Original reference |
| --- | --- | --- | --- | --- |
| Zombie | 1 | Grave Belle | [zombie-1-grave-belle.webp](zombie-1-grave-belle.webp) | [Original](../../../monsters/zombie-1-grave-belle.webp) |
| Zombie | 2 | Miss Morgue | [zombie-2-miss-morgue.webp](zombie-2-miss-morgue.webp) | [Original](../../../monsters/zombie-2-miss-morgue.webp) |
| Zombie | 3 | Velvet Rot | [zombie-3-velvet-rot.webp](zombie-3-velvet-rot.webp) | [Original](../../../monsters/zombie-3-velvet-rot.webp) |
| Zombie | 4 | Lady Decomposition | [zombie-4-lady-decomposition.webp](zombie-4-lady-decomposition.webp) | [Original](../../../monsters/zombie-4-lady-decomposition.webp) |
| Goblin | 1 | Gary | [goblin-1-gary.webp](goblin-1-gary.webp) | [Original](../../../monsters/goblin-1-gary.webp) |
| Goblin | 2 | Gribnob the Unqualified | [goblin-2-kevin-the-unqualified.webp](goblin-2-kevin-the-unqualified.webp) | [Original](../../../monsters/goblin-2-kevin-the-unqualified.webp) |
| Goblin | 3 | Gribble | [goblin-3-gribble.webp](goblin-3-gribble.webp) | [Original](../../../monsters/goblin-3-gribble.webp) |
| Goblin | 4 | Gary's Supervisor | [goblin-4-garys-supervisor.webp](goblin-4-garys-supervisor.webp) | [Original](../../../monsters/goblin-4-garys-supervisor.webp) |
| Orc | 1 | Thud | [orc-1-thud.webp](orc-1-thud.webp) | [Original](../../../monsters/orc-1-thud.webp) |
| Orc | 2 | Brutus | [orc-2-brutus.webp](orc-2-brutus.webp) | [Original](../../../monsters/orc-2-brutus.webp) |
| Orc | 3 | Gronk | [orc-3-gronk.webp](orc-3-gronk.webp) | [Original](../../../monsters/orc-3-gronk.webp) |
| Orc | 4 | Meatwall | [orc-4-meatwall.webp](orc-4-meatwall.webp) | [Original](../../../monsters/orc-4-meatwall.webp) |
| Boss | 1 | Dungeon Lord | [boss-1-dungeon-lord.webp](boss-1-dungeon-lord.webp) | [Original](../../../monsters/boss-1-dungeon-lord.webp) |
| Boss | 2 | The Senior Dungeon Lord | [boss-2-senior-dungeon-lord.webp](boss-2-senior-dungeon-lord.webp) | [Original](../../../monsters/boss-2-senior-dungeon-lord.webp) |
| Boss | 3 | The Executive Overlord | [boss-3-executive-overlord.webp](boss-3-executive-overlord.webp) | [Original](../../../monsters/boss-3-executive-overlord.webp) |
| Boss | 4 | The Chairman Below | [boss-4-chairman-below.webp](boss-4-chairman-below.webp) | [Original](../../../monsters/boss-4-chairman-below.webp) |

## Matching the game

`app/dungeon/room-theme.ts` selects by confirmed monster type and room number.
Artwork tiers follow rooms 1–10, 11–20, 21–30 and 31 onward, exactly as the
monster illustration selection does. Tier-four rooms continue in deeper runs.
Combat actions, loot pickup and recovery never change the selected background.
Practice, First Descent and the existing onchain presentation share this code.

The source palette is part of the image; the former generic purple/red floor
tint is removed. Mobile uses the same background behind the HUD. No changes to
movement, hit targets, loot rules, merchant parking, combat, seeds or wallets.

The art keeps the fixed north doorway, south stairs and open floor. Furniture,
bones and other raised scenery remain at the perimeter. The Chairman's desk
and Meatwall's lower-left decoration received targeted clearance corrections.

## Exact prompts and provenance

- [Zombie prompts and source observations](zombie-provenance.md)
- [Goblin prompts and source observations](goblin-provenance.md)
- [Orc prompts and source observations](orc-provenance.md)
- [Boss prompts and source observations](boss-provenance.md)

## Static visual review

Run from `frontend/`:

```sh
node --import tsx scripts/render-room-theme-review.tsx /tmp/delveworn-original-rooms
```

The four review sheets compare each original painting with its room, both with
the actual enemy sprite and with the open door. These are static SVG/image
renders, not browser screenshots. Actual mobile and desktop gameplay testing
remains separate.

