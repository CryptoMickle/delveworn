# Original Orc Room Background Provenance

All four room backgrounds were created with the built-in OpenAI ImageGen tool. Each initial generation used both the existing dungeon room as the strict geometry/camera reference and the matching original monster painting as the authoritative environmental reference.

## Shared geometry reference

- `frontend/public/dungeon/stone-room.webp`
- Preserved requirements: 3:2 overhead/isometric room, closed north door, centered south stairs, open central play area, clear left Kevin bay, and perimeter-only environmental props.

## Tier 1 — Thud

- Monster reference: `frontend/public/monsters/orc-1-thud.webp`
- Observed environment: damp moss-black crypt, wet stone, sparse bones and skulls at the edges, rusty chains, a barred arch, sickly green flames, and an olive-charcoal palette.
- Generated source: `/Users/mikkelraaholt/.codex/generated_images/01a0aa22-2c53-72b0-bf06-957a47c7693c/exec-8ab02e72-508d-4475-a6f6-519f48b1e5a6.png`
- Final asset: `frontend/public/dungeon/rooms/original/orc-1-thud.webp`

### Exact prompt

```text
Use case: precise-object-edit
Asset type: 3:2 top-down/isometric dungeon room background for Delveworn
Input images: Image 1 is the strict edit target for camera, room footprint, layout, perspective, door, stairs, and playable geometry. Image 2 is the authoritative environment/style reference for tier-1 Orc Thud; use only its background and never copy the orc character.
Primary request: redesign Image 1 as Thud's room using the actual environment behind Thud in Image 2: a damp moss-dark crypt with wet black-green stone, restrained sickly green brazier flames, rusty hanging chains, barred-arch motifs, sparse skulls and old bones along the perimeter, and heavy shadowed masonry.
Composition/framing: preserve Image 1's exact overhead/isometric camera, 3:2 framing, square room footprint, wall locations, north CLOSED door and inner aperture at logical x=407..493 y=10..77, centered south stairs, and open playable geometry. At logical 900x600 keep x=170..733 and y=190..505 unobstructed; only flat walkable floor and a subtle integrated floor seal/medallion may occupy it. Keep the left Kevin bay clear. Put all chains, bones, braziers, rubble, and bars tight against outer walls/corners.
Style/lighting: match Image 2's dark olive, charcoal, damp moss, green flame, wet reflective stone, grounded detailed dark-fantasy raster painting. Maintain enough floor contrast for characters.
Constraints: no characters, orcs, silhouettes, creatures, text, UI, loot, merchant objects, open door, extra doorway, raised center, foreground obstruction, camera change, crop change, or altered stair position. Preserve a clearly closed north door and the four perimeter torch locations, changing their flame color/material treatment to match Image 2.
```

## Tier 2 — Brutus

- Monster reference: `frontend/public/monsters/orc-2-brutus.webp`
- Observed environment: fortified barred dungeon armory, polearm and axe racks, hanging chains, a skull war-banner, vivid green fire, and wet reflective black stone and iron.
- Generated source: `/Users/mikkelraaholt/.codex/generated_images/01a0aa22-2c53-72b0-bf06-957a47c7693c/exec-a8d64081-89a9-4b7c-843a-d88530a21fca.png`
- Final asset: `frontend/public/dungeon/rooms/original/orc-2-brutus.webp`

### Exact prompt

```text
Use case: precise-object-edit
Asset type: 3:2 top-down/isometric dungeon room background for Delveworn
Input images: Image 1 is the strict edit target for camera, room footprint, layout, perspective, door, stairs, and playable geometry. Image 2 is the authoritative environment/style reference for tier-2 Orc Brutus; use only its background and never copy the orc character.
Primary request: redesign Image 1 as Brutus's room using the actual environment behind Brutus in Image 2: a fortified wet dungeon armory with barred iron arches, dense but perimeter-bound polearm and axe racks, heavy hanging chains, a weathered skull war-banner, blackened stone, and vivid sickly green fire reflected in damp floor joints.
Composition/framing: preserve Image 1's exact overhead/isometric camera, 3:2 framing, square room footprint, wall locations, north CLOSED door and inner aperture at logical x=407..493 y=10..77, centered south stairs, and open playable geometry. At logical 900x600 keep x=170..733 and y=190..505 unobstructed; only flat walkable floor and a subdued integrated iron war seal or drain may occupy it. Keep the left Kevin bay clear. All racks, banners, chains, skulls, grates, and armor must hug the outer walls and corners.
Style/lighting: match Image 2's iron-barred armory, wet charcoal masonry, acid-green flames, brown-black forged metal, reflected green highlights, and realistic highly detailed dark-fantasy raster painting. Maintain adequate floor contrast for actors.
Constraints: no characters, orcs, silhouettes, creatures, text, UI, loose loot, merchant objects, open door, extra doorway, raised center, foreground obstruction, camera change, crop change, or altered stair position. Preserve a clearly closed north door and the four perimeter torch locations, changing their flames to the green fire from Image 2.
```

## Tier 3 — Gronk

- Monster reference: `frontend/public/monsters/orc-3-gronk.webp`
- Observed environment: monumental ruined ossuary, tall eroded pillars and broken arches, dense perimeter skull banks, distant skull-gate motifs, spectral green braziers, deep teal-green haze, and damp black-green stone.
- Generated source: `/Users/mikkelraaholt/.codex/generated_images/01a0aa22-2c53-72b0-bf06-957a47c7693c/exec-2100d7d1-7de8-411e-a971-b4edf35b92dc.png`
- Final asset: `frontend/public/dungeon/rooms/original/orc-3-gronk.webp`

### Exact prompt

```text
Use case: precise-object-edit
Asset type: 3:2 top-down/isometric dungeon room background for Delveworn
Input images: Image 1 is the strict edit target for camera, room footprint, layout, perspective, door, stairs, and playable geometry. Image 2 is the authoritative environment/style reference for tier-3 Orc Gronk; use only its background and never copy the orc character.
Primary request: redesign Image 1 as Gronk's room using the actual environment behind Gronk in Image 2: a monumental ruined ossuary hall of black-green wet stone, tall eroded pillars and broken arch fragments at the perimeter, dense skull and bone banks kept against the walls, distant skull-gate motifs, multiple sickly green braziers, damp moss, and deep teal-green haze.
Composition/framing: preserve Image 1's exact overhead/isometric camera, 3:2 framing, square room footprint, wall locations, north CLOSED door and inner aperture at logical x=407..493 y=10..77, centered south stairs, and open playable geometry. At logical 900x600 keep x=170..733 and y=190..505 unobstructed; only flat cracked walkable stone and a subtle worn ossuary seal may occupy it. Keep the left Kevin bay clear. Confine pillars, skull banks, bones, rubble, and braziers to outer walls and corners.
Style/lighting: match Image 2's deep charcoal, damp green-black stone, spectral green fire, ruined vertical masonry, heavy skull banks, low teal haze, and realistic highly detailed dark-fantasy raster painting. Keep the walkable floor readable with adequate contrast.
Constraints: no characters, orcs, silhouettes, creatures, text, UI, loot, merchant objects, open door, extra doorway, central stairs or dais, raised center, foreground obstruction, camera change, crop change, or altered south stair position. Preserve a clearly closed north door and the four perimeter torch locations, adapting them to Image 2's green braziers.
```

## Tier 4 — Meatwall

- Monster reference: `frontend/public/monsters/orc-4-meatwall.webp`
- Observed environment: oppressive orc throne-vault, spiked skull-and-tusk throne frame, deep red tattered banners, heavy chains, weapon palisades and skull standards, green fire, tarnished gold and chests at the far perimeter, and wet mossy stone.
- Initial generated source: `/Users/mikkelraaholt/.codex/generated_images/01a0aa22-2c53-72b0-bf06-957a47c7693c/exec-19a13d27-5502-4504-be2d-8e293580bf13.png`
- Final refined source: `/Users/mikkelraaholt/.codex/generated_images/01a0aa22-2c53-72b0-bf06-957a47c7693c/exec-e9559364-1111-4c41-ac27-eada521d92cc.png`
- Final asset: `frontend/public/dungeon/rooms/original/orc-4-meatwall.webp`

### Exact initial prompt

```text
Use case: precise-object-edit
Asset type: 3:2 top-down/isometric dungeon room background for Delveworn
Input images: Image 1 is the strict edit target for camera, room footprint, layout, perspective, door, stairs, and playable geometry. Image 2 is the authoritative environment/style reference for tier-4 Orc Meatwall; use only its background and never copy the crowned orc character.
Primary request: redesign Image 1 as Meatwall's room using the actual environment behind Meatwall in Image 2: an oppressive orc throne-vault with a spiked skull-and-tusk frame around the north door, deep red tattered war banners, massive hanging chains, green braziers, blackened weapon palisades, skull standards, and restrained heaps of tarnished gold and battered treasure chests only in the far perimeter corners.
Composition/framing: preserve Image 1's exact overhead/isometric camera, 3:2 framing, square room footprint, wall locations, north CLOSED door and inner aperture at logical x=407..493 y=10..77, centered south stairs, and open playable geometry. At logical 900x600 keep x=170..733 and y=190..505 unobstructed; only flat dark walkable stone and a worn crown/skull floor seal may occupy it. Keep the left Kevin bay clear. Confine every banner, chain, rack, skull, chest, coin heap, and throne-frame element tightly to outer walls and corners; no raised dais.
Style/lighting: match Image 2's black iron, tarnished bronze and gold, blood-dark red cloth, wet mossy stone, green flame, oppressive royal-orc heraldry, and realistic highly detailed dark-fantasy raster painting. Keep strong floor contrast for characters.
Constraints: no characters, orcs, kings, silhouettes, creatures, text, UI, loose collectible-looking loot in the playable area, merchant objects, open door, extra doorway, central throne, raised center, foreground obstruction, camera change, crop change, or altered south stair position. Preserve a clearly closed north door and the four perimeter torch locations, adapting them to Image 2's green fire.
```

### Exact refinement prompt

```text
Use case: precise-object-edit
Asset type: 3:2 top-down/isometric dungeon room background for Delveworn
Input image: the provided generated Meatwall throne-vault is the edit target.
Primary request: change only the lower-left corner dressing. Move and compact the lower-left battered chest, skull standards, coin heap, and weapon debris tightly against the far-left perimeter wall so no prop extends to the right of 17% of the image width within the lower half. Restore every newly cleared pixel with matching flat dark wet stone floor and existing green-fire lighting.
Critical invariant: keep the entire rest of the image unchanged in composition and appearance, including exact camera, 3:2 framing, closed north door and its skull/tusk frame, centered south stairs, floor seal, all four green torches, upper treasure piles, red banners, chains, right-side dressing, walls, perspective, palette, and detailed raster style.
Playable space: at logical 900x600 keep x=170..733 and y=190..505 completely clear except flat walkable floor and existing floor seal. Keep the left Kevin bay unobstructed.
Avoid: no characters, creatures, text, UI, new props, moved torches, open door, camera shift, crop change, zoom, or geometry changes.
```

The final Meatwall asset uses the refined source because the initial lower-left dressing extended too far into the reserved clear area.

## Output conversion

The generated PNG sources were converted without resizing to WebP at quality 90. No other raster edits were applied during conversion.
