# First Descent art provenance

Built-in ImageGen, 2026-09-15. Original monster files are unchanged and used in
both scene and portrait HUD. Scene presentation clips their original silhouettes;
no substitute monster designs. User approved original-style concept and then
requested a less gender-binary player. The selected avatar is androgynous with
face hidden, practical light armor, neutral proportions and plum cloak.

Selected outputs, resized and WebP encoded for delivery (no raster repainting):

- `frontend/public/dungeon/stone-room.webp` from `exec-ae6df860-8365-47b5-a042-17e0f43b019f.png`.
- `frontend/public/dungeon/adventurer.webp` from `exec-c81c7c17-ff88-419f-b4db-1e5d360a6f7c.png`.

Source outputs remain under the thread's `~/.codex/generated_images/` folder.
The initial avatar had a baked checkerboard, so it was rejected. A solid black
background was requested instead; the scene removes black at presentation time.
The later gender-expression correction is incorporated in the selected asset.

## roomAssetPrompt

Use case: stylized-concept. Asset type: production background plate for a top-down 2D dungeon game. Input image is the APPROVED Delveworn concept; match its detailed dimensional stone, plum shadows, bronze torchlight and sculpted fantasy rendering exactly. Create ONLY the empty room environment, no user interface, no characters, no words, no logos, no relics, no damage numbers. Landscape 3:2 composition. Camera looking down into ONE rectangular room, nearly overhead, small visible inner faces of walls. Dark weathered masonry encloses all four edges; north door centered at x50%, y16%; entry stairs at x50%, y93%. Playable flagstone floor extends from x16% to84%, y30% to84%. Subtle large circular worn rune engraving centered x50%,y58%. Simple mostly unobstructed walking floor, edge dressing of skulls, bones, barrel and plum banners. Four torches at edges. Closed dark timber north door with brass fittings. Keep room layout legible at mobile sizes and no objects in central walking lane. Lighting is consistent warm amber from edge torches, cool plum stone in shadows. This is a reusable asset with EMPTY floor for separately rendered original monsters and avatar; no figures anywhere.

## avatarAssetPrompt

Use case: stylized-concept. Asset type: ONE production avatar sprite for Delveworn top-down 2D dungeon. Reference image is the APPROVED scene. Draw ONLY its small adventurer, isolated full body, no scene no UI. Detailed dimensional fantasy rendering with sculpted forms and worn leather/bronze, matching the approved original monster art. Rear three-quarter view facing upper right; camera elevated looking down about 35 degrees. Compact dark plum hooded cloak, bronze shoulder armor, leather boots; short sword in right hand angled to upper right. Single figure centered, entire silhouette visible with generous padding. Legs slightly separated, standing idle. No floating relics (those are separate runtime layers), no detached items, no text. Transparent background with REAL alpha channel, never draw a checkerboard. If alpha is not supported use perfectly solid pure black #000000 backdrop, with no ground plane or shadows, so the silhouette can be displayed cleanly. Avatar body fills 75% of image height. Preserve the approved purple adventurer style, avoid cartoon vector, pixel art or flat shapes.

## avatarBlackPrompt

Use case: precise-object-edit. Change ONLY the checkerboard behind this avatar to perfectly uniform solid PURE BLACK (#000000). Preserve the adventurer's exact pixel appearance, pose, plum cloak, bronze armor, sword, framing and size. Also replace all checkerboard visible in gaps between legs, arm and sword with the same solid black. Output must be an opaque image with black background, NO transparency simulation, NO checkerboard, NO floor, NO shadow, NO gradients in the backdrop. It will be composited on dark stone in the game.

## avatarAndrogynousPrompt

Use case: precise-object-edit. Asset type: Delveworn production player avatar. User correction: make the adventurer more androgynous, less binary in gender expression. Edit the attached avatar to have an average, gently slender, gender-ambiguous build with less broad shoulders, modest practical shoulder armor, straight relaxed torso and comfortable loose trousers. Keep face fully hidden in the hood; gender is unspecified. No exaggerated gender-coded body features, no sexualization. Preserve the exact detailed dimensional fantasy rendering, worn plum hooded cloak, bronze-and-leather materials, rear three-quarter elevated camera, fullbody standing pose, short sword, centered composition. Keep a perfectly solid PURE BLACK #000000 background with no checkerboard, no floor, no ground shadow, no gradients, no text, no relic. Clothing remains practical dungeon gear. One figure only.
