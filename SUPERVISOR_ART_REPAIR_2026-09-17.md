# Gary's Supervisor: face and crown repair

The previous `goblin-4-garys-supervisor-crown-fixed.webp` put a replacement crown over the eyes. This was an image error, not animation or CSS scaling.

- Source reference: `frontend/public/monsters/goblin-4-garys-supervisor.webp`.
- Final room sprite: `frontend/public/monsters/goblin-4-garys-supervisor-sprite-v2.webp`.
- Tool: built-in image generation/editing; transparent PNG converted to WebP (quality 92, alpha quality 100), without changing dimensions or cutting out additional parts.
- Dimensions: 1672 × 941; SVG frame: `240 80 1226 746`.
- Portraits retain the original painting. The transparent room sprite uses its own frame without the old silhouette mask. Room width and click target use that same frame.

## Prompt set

### Original-image edit

> Use case: background-extraction / precise-object-edit. Edit target: the supplied ORIGINAL painting of Gary's Supervisor for the existing Delveworn game. Produce a faithful transparent-background sprite of this EXACT goblin king and all of his equipment. Preserve the ORIGINAL face, large round eyes, eyebrows, nose, grin, ears, skin, body, pose, purple cape, fur, mace and goblet without redesigning them. CRITICAL: the crown's existing band MUST STAY ABOVE THE EYEBROWS at its original height, completely clear of the eyes. Do not add a second crown, do not move or enlarge the crown down onto the face. Extend the canvas UPWARD to reveal and complete ONLY the few tiny missing crown and mace spike tips at the top frame edge. Give the whole figure a little clear transparent padding on all sides; no clipped crown, ears, weapon or feet. Preserve the original wide squat proportions and realistic detailed painterly rendering. Remove the entire dungeon background and all floor; actual transparent alpha, no checkerboard painting, no matte, no glow, no text. Whole full-body character, left mace to right purple cloak entirely in view.

### Padding revision

> Precise layout edit only: retain this exact transparent character, exact face, crown ABOVE eyebrows, pose, rendering, equipment and proportions unchanged. The crown tips and mace spike touch the top canvas edge: move the complete character away from ALL four edges by scaling it down uniformly to 88% within the same wide canvas, centered, leaving AT LEAST 40 completely transparent pixels above the highest crown/mace tip and 40 transparent pixels below feet and cape. Do not crop any part. Background MUST remain real transparent alpha. Do not repaint, redesign or add anything to the character. Only fit the complete existing sprite safely inside the frame with transparent margin around it.

## Validation

- Visually inspected the finished sprite in the actual room component at desktop and 375px mobile width, using temporary local fixtures with no save mutations. Fixtures removed before publication.
- Asset test checks transparent space around the subject, including the crown; SVG regression checks that the old clip mask is not applied.
- Separately fixed equipped-relic visibility across exploration/combat and tested Weekly-to-Practice save/restore. No balance values changed in this repair.
