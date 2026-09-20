# The Mind Beneath — painted world assets

Created 20 September 2026. Only Living Dungeon presentation consumes this new art. Shared source paintings, other modes, simulation and observation rules are unchanged. The accompanying English release upgrades saves to v3 with validated replay of the Norwegian v2 rules; see `app/living-dungeon/mind/legacy-v2/README.md`.

## Reused Delveworn artwork

- The original burgundy-cloaked adventurer, both orientations, through `app/dungeon/avatar-art.tsx`. The Echo uses an enlarged, tinted version of the same adventurer.
- Existing orc and zombie cutouts through `EnemySprite` in `app/dungeon/scene.tsx` for the kiln, bridge, garden and reservoir guardians.
- Eight existing room paintings: `dungeon/stone-room.webp`; and `dungeon/rooms/original/{orc-2-brutus, boss-2-senior-dungeon-lord, orc-1-thud, zombie-3-velvet-rot, boss-1-dungeon-lord, zombie-2-miss-morgue, boss-4-chairman-below}.webp`.
- The original Delveworn logo, Echo Lens, Stormheart, Iron Shell, Black Mirror, weapon and potion paintings in the interface.
- Stone masonry sampled at render time from the original room painting. Mechanical walls and all gameplay targets remain derived from the real grid. The background's decorative south stair is sealed visually; only the marked exit entity is an actual exit.

`app/living-dungeon/mind/art.tsx` records the family mappings, atlas viewports and shared components. `board.tsx` renders art, observations, routes and effects from the same room state. The new pointer rectangles have fixed bounds independent of the decorative SVG image bounds.

## New artwork

Final project asset: [`mind-atlas-v1.webp`](mind-atlas-v1.webp), 1536 × 1024, 281,332 bytes. It contains the masked warden, cartographer, witness scribe, bell, brazier, reporting stone, hiding niche and exit stair. The sheet is downloaded once and reused for board figures and inspection portraits. Other scenario mechanisms use native SVG brass wheels and organ pipes.

Generated with the **built-in ImageGen tool**, not the CLI/API fallback. The first result retained a colored backdrop, so a second ImageGen edit replaced it with solid black. Rendering uses the same black-key SVG technique as Delveworn's existing adventurer; the file does not claim an alpha channel. Sharp converted the selected PNG to WebP at quality 92 without cropping or recoloring. Sprite selection happens through SVG viewports.

Source outputs (preserved at the generator's original location):

- Initial: `exec-d6a36408-e24c-4181-90dc-14cc198841fd.png`.
- Selected: `exec-5cbc9bad-0b76-4bc1-9cc3-412a5d20a0b9.png`.

## Generation prompt

```text
Use case: stylized-concept. Asset type: a single production game sprite atlas for The Living Dungeon, an extension of Delveworn. Input images are STYLE REFERENCES ONLY: reference 1 establishes richly painted, worn stone, brass, torch-lit dark fantasy materials; reference 2 establishes the detailed hand-painted miniature character style. Create ONE landscape 1536x1024 sprite sheet, exactly FOUR columns by TWO rows of equally sized 384x512 cells, no cell borders or labels. Genuine transparent background, clean separated silhouettes, no scenery, no opaque rectangular backgrounds, no floor planes. Each sprite is centered in its own cell with at least 45px padding on every side, entire sprite visible, same elevated slightly front-facing camera as the reference character; soft tiny contact shadow only. TOP ROW left to right: (1) tall ominous masked dungeon warden in blackened bronze armor, aged bone mask with narrow eye slits, weathered burgundy cape, holding a short polearm; (2) Ilyr the imprisoned cartographer, a weary adult human in a worn warm ivory travelling coat, teal scarf, leather map satchel and rolled parchment, standing upright, empty hands, no chains baked into sprite; (3) hooded witness scribe wearing muted plum robes, angular brass bird mask, clutching a vellum report and feather quill, standing; (4) a heavy tarnished bronze dungeon bell suspended in a freestanding small dark-iron frame. BOTTOM ROW left to right: (1) a low ornate iron brazier with a small warm amber flame; (2) a violet-veined ancient dark stone reporting monolith with a carved luminous eye-shaped slit, narrow upright silhouette; (3) a heavy square ruined stone niche/arch with a pitch-dark hollow center, usable hiding place; (4) a compact stone stairwell descending into darkness, three visible steps within a carved stone arch, restrained pale teal reflection inside. High visual fidelity and readable silhouettes at 64px game size. Use rich textured materials, weathered brass, plum cloth, charcoal stone, subtle teal and violet accents, consistent light from upper left. This is a sprite atlas, not a finished screenshot or moodboard. No text, lettering, interface, logo, watermark, grid, frame around sheet, extra objects, gore, cartoon outlines, flat vector artwork. Keep sprites strictly within their eight separate cells; nothing overlaps neighboring cells.
```

References: `public/dungeon/stone-room.webp` and `public/dungeon/adventurer.webp`.

## Final background edit prompt

```text
Use case: background-extraction. Edit target: this eight-sprite Delveworn game atlas. Change ONLY the background behind the eight objects to perfectly uniform solid RGB #000000 black, with no glow, no cast shadows, no gradient, no ground plane, no haze. This pure black is the game's runtime transparency key. Preserve the exact 1536x1024 canvas, all eight subjects at their EXACT original coordinates, scale, pose, sharp contours, colors, detailed paintwork and material texture. Do NOT shift or resize any sprite. Preserve the flame shape but remove the orange glow from empty space around it. Preserve the teal-lit stairs and violet-veined monolith. Preserve the warden's polearm, cartographer's ivory coat, plum witness robes, bronze bell, stone arch. All pixels that are not part of one of the eight sprites must be uniform #000000 black. No text, no labels, no borders, no checkerboard. Output exactly the same atlas with only the background removed to flat pure black.
```

## Motion and delivery

No idle animation loop, continuous particles, video or WebGL. Movement uses existing bounded transitions; attack, Storm and interaction flashes finish after 650 ms. Reduced-motion mode disables those flashes and transitions. Static health bars, protection, hidden-state rings, chains, line-of-sight and report routes remain available. No additional OpenAI request is needed to display the graphics. Built-in image generation charges are not exposed by the tool and have not been estimated as API usage.
