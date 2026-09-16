# Monster-family room backgrounds

Created 2026-09-16 with the built-in ImageGen edit tool, using the existing
`../stone-room.webp` as the composition and style reference. No CLI/API fallback.
Selected PNG outputs were converted to WebP quality 90 with Sharp, without
cropping or recoloring. The original crypt and monster paintings are unchanged.

| Monster family | Asset |
| --- | --- |
| Zombie | `../stone-room.webp` (original crypt) |
| Goblin | `goblin-storeroom.webp` |
| Orc | `orc-armory.webp` |
| Boss | `boss-hall.webp` |

The three generated assets are 1536×1024 (3:2). `app/dungeon/room-theme.ts`
selects the background from the confirmed monster family. This is presentation
only: no randomness, engine rules, wallet calls, movement bounds or collision
changes. The open doorway illustration is fitted to each painting while the
door interaction target stays fixed. The same image fills the mobile backdrop.
Assets remain constant through attacks, loot and recovery.

## Review limits

The generated images were inspected against the original, including the clear
floor, centered doorway, stairs and merchant bay. Static SVG room renders check
the open door. These are image checks, not browser or physical-device tests.

## Goblin prompt

Generated source: `exec-ef5e241f-6ba4-4bd0-9fb4-1ed68d8c8bd8.png`.

```text
Use case: precise-object-edit.
Asset type: production background for Delveworn's fixed-camera top-down dungeon game.
Edit target: the attached original stone-room.webp. Create the GOBLIN STOREROOM variant.
Preserve the existing detailed dark-fantasy painted game-art style. Preserve EXACTLY the camera, perspective, 3:2 landscape framing, room outline, wall positions, north door centered at x50%, south stairs at x50%, all four torch positions, stone floor geometry and central engraved circular medallion. Keep the north door CLOSED.
Change only perimeter environmental dressing: a cluttered goblin storeroom with uneven stacks of weathered crates, torn sacks, scrap-metal tools and a few greenish glass jars, hung rags and scavenged small shields against the walls. Restrained mossy olive and amber light, original purple/plum traces in hanging cloth. Visually distinct from the original crypt, but equally detailed and natural to this world.
Strict playability: maintain the entire central walkable stone floor unobstructed, including the area corresponding to x170..733 y190..505 in a 900x600 room. Props only along the perimeter walls, no crates or large objects protruding into that area. Keep the upper-left interior bay open for a visiting merchant and cart. Central medallion remains readable, floor brightness sufficient to see actors.
No monsters, people, creatures, merchant, loot piles, coins, treasure chest on floor, text, signs, interface, labels, black margins, inset panels or new doorways. Do not redraw the architecture or add stairs. Output one complete opaque room-background image, same aspect ratio as input.
```

## Boss prompt

Generated source: `exec-1afc0bf7-9833-42c6-aa33-c3a67d345e6a.png`.

```text
Use case: precise-object-edit
Asset type: 3:2 game-room background for Delveworn boss encounters
Input image: the supplied stone-room.webp is the edit target and strict composition reference.
Primary request: transform only the room's perimeter decoration into a more imposing boss and management hall.
Style/medium: preserve the original detailed painterly dark-fantasy game art, stone textures, lighting model, material detail, and visual fidelity.
Composition/framing invariants: preserve the exact same camera, top-down oblique perspective, crop, 3:2 ratio, room geometry, wall positions, centered closed north doorway, four fire sources, south stairs, central floor medallion, and open playable center. Keep all walkable floor from logical x=170..733 and y=190..505 unobstructed. Keep the left-side merchant/Kevin bay open and usable.
Requested perimeter changes: add taller dark red and black hanging banners against the perimeter walls; carved skull reliefs symmetrically flanking the north doorway; richer aged-brass trim around the doorway and wall details; a heavier black-stone border integrated into the perimeter walls. Make this unmistakably a boss/management hall while remaining part of the same dungeon.
Lighting/mood: ominous executive boss chamber, warm torchlight, deep black and dark crimson accents, restrained aged brass.
Constraints: the north doorway must remain closed, centered, and the same size and position. The south stairs and every torch/brazier remain in exactly the same positions. Preserve the central medallion completely visible and the center floor clear. Decorations stay against walls and perimeter only.
Avoid: no throne, no dais in the walkway, no red carpet over the medallion, no furniture or props in the playable center, no characters, monsters, merchant, wagon, text, letters, logos, UI, loot, watermark, new doorway, open doorway, changed perspective, changed framing, changed stair geometry.
```

## Orc prompts

Generated sources: `exec-5e1adde7-e48e-4c92-8474-c07c86e61689.png` (first pass)
and `exec-0d22951b-1343-4227-a27d-8126f77be7d5.png` (selected refinement).

```text
Use case: precise-object-edit
Asset type: 3:2 raster background for a top-down/isometric dark fantasy dungeon game room
Input image: the provided stone-room.webp is the edit target and strict composition reference.
Primary request: transform only the perimeter environmental dressing into an orc armory while preserving the exact room architecture, camera, layout, framing, perspective, and navigable floor geometry.
Scene/backdrop: the same square stone chamber. Keep the closed doorway exactly centered on the north wall, the south stairs exactly centered, the circular floor medallion in the same position and scale, all four torch positions, the surrounding walls, and the open playable center.
Environmental dressing: along the perimeter only, add battered iron weapon racks, dented armor pieces, heavy chains, and restrained tusk heraldry. Use earthy charcoal, blackened iron, aged leather, and restrained warm ember light. Detailed, grounded, worn, threatening orc craftsmanship.
Style/medium: preserve the reference's exact Delveworn warm, highly detailed dark fantasy painted raster style, texture density, lighting, and realism; cohesive with the existing game art, never cartoony.
Composition/framing: strict 3:2 landscape. Treat the reference as locked geometry. At logical 900x600, keep the walkable area x=170..733 and y=190..505 clear except for the flat stone floor and the existing floor medallion. Keep the left-side Kevin bay clear and unobstructed. All new props must hug the outer walls and corners and must not project into the walkable center.
Constraints: preserve the exact perspective, wall footprint, centered north door, south stairs, central floor medallion, torch locations, and empty playable center. No characters, creatures, text, labels, symbols with writing, UI, loot, coins, chests, potions, merchant cart, or foreground obstruction. No camera change, crop change, zoom, added doorway, raised platform, or altered floor elevation.
```

Refinement, using the first generated orc room as the edit target:

```text
Use case: precise-object-edit
Asset type: 3:2 raster background for a top-down/isometric dark fantasy dungeon game room
Input image: the provided generated orc armory is the edit target.
Primary request: change only the lower-left corner dressing. Move and compact the lower-left weapon rack, shield, armor pile, and spikes tightly against the far-left perimeter wall so no prop extends to the right of 17% of the image width within the lower half of the room. Restore every newly cleared pixel with matching flat stone floor and its existing warm torch light.
Critical invariant: keep the entire rest of the image unchanged in composition and appearance, including exact camera, 3:2 framing, north centered closed door, south centered stairs, floor medallion, all four torches, upper-left racks, right-side armory dressing, banners, walls, perspective, lighting, and dark fantasy raster style.
Playable space: at logical 900x600 keep x=170..733 and y=190..505 completely clear except flat stone floor and the existing floor medallion. Keep the left-side Kevin bay unobstructed.
Avoid: no characters, creatures, text, UI, loot, new props, camera shift, crop change, zoom, or geometry changes.
```
