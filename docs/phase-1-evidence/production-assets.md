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

## Directional avatar — 2026-09-16

The user requested that the avatar face its movement direction and visibly walk.
The original `frontend/public/dungeon/adventurer.webp` remains the north/rear
view. The added south/front view is saved as
`frontend/public/dungeon/adventurer-south.webp` (480×499, 28,602 bytes), encoded
from built-in ImageGen output `exec-1d71e0a4-0cb6-46bf-a4d7-84e5be416ec2.png`.
Both views retain the plum hood, hidden face, practical armor and original
androgynous identity. Left/right travel mirrors the appropriate view.

The first front output (`exec-6a5401ac-e7a7-4d0b-81bc-e4b60f9ab4e7.png`) drew an
opaque checkerboard instead of alpha and was not integrated. A built-in edit
replaced only its background with solid black. The room's existing SVG filter
removes that background at presentation time. No software raster repainting was
used. The selected output was resized and WebP-encoded for delivery.

Walking uses SVG clips and separately articulated legs; the idle bitmap is
unchanged. The game room and avatar position are not bounced or zoomed to fake
a stride. Reduced-motion users retain a still pose. These are presentation
changes, without changes to turns, game state or random outcomes.

### Front-view prompt (built-in ImageGen)

Use case: identity-preserve. Asset type: production directional sprite for the existing Delveworn top-down dungeon game. The input image is the approved character identity/reference. Create ONE matching full-body sprite of precisely this same androgynous hooded adventurer seen from FRONT THREE-QUARTER, facing toward the viewer and toward screen RIGHT (southeast in a dungeon). Keep the same plum/burgundy hood and ragged cloak, brown leather and bronze armor, plain practical proportions, gloved hands, exact style of boots and sword. Keep the face deep in hood shadow, neutral and non gendered. The cloak should be behind the body when viewed from front; both trouser legs and boots clearly separate below the tunic so they can be independently animated. Neutral relaxed standing pose, feet planted, sword held angled out to screen right with the same diagonal blade as original, no attack pose. Same elevated game camera, realistic richly detailed painted dark-fantasy material style, warm neutral lighting, exact same overall body proportions and framing as original; full hood, full cloak and entire sword and boots inside image. One character only. TRUE transparent alpha background, no ground, no pedestal, no rectangle, no checkerboard drawn into image, no cast ground shadow, no text. Do not redesign, beautify, masculinize or feminize the character. This is a direction turn of the existing figure for a game, not a new character.

### Final background correction prompt (built-in ImageGen)

Use case: precise-object-edit. The input is the edit target. Change ONLY the entire background: replace every checkerboard square and all folds in the background with perfectly uniform pure black RGB 0,0,0. The intended transparency failed, so this production sprite now requires a flat black background that the game's existing shader removes. Preserve the character pixel appearance, style, position, scale, pose, hidden face, sword, boots, cloak and all silhouette details exactly. Do not add any cast shadow, pedestal, glow or texture. Pure flat black all around the character and in the spaces between legs/arm/sword. Keep exact same framing and dimensions. Do not draw checkerboard anywhere. One identical character, only background replacement.
