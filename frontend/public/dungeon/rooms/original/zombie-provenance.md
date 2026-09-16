# Zombie room image provenance

Generated with the built-in ImageGen image-edit workflow on 2026-09-16. Each generation used the shared room as the strict composition reference and its matching original monster painting as the authoritative environment reference. Generated PNGs were converted with Sharp to WebP at quality 90 without resizing. Final assets are 1536 × 1024 pixels (3:2).

## Shared composition reference

- `frontend/public/dungeon/stone-room.webp`
- Visual findings: overhead/isometric rectangular room, centered closed north door, four fixed fire-source positions, centered south stairs, broad flat playable center, painterly dark-fantasy masonry.

## Zombie tier 1 — Grave Belle

- Environment reference: `frontend/public/monsters/zombie-1-grave-belle.webp`
- Visual findings: the sparsest of the four black-purple crypts; tall rounded arches and black recesses, violet flames, rough chipped masonry, heavy chains, modest skull and long-bone piles, and faint purple wisps around dark rectangular paving.
- Generated source: `/Users/mikkelraaholt/.codex/generated_images/01a0a95d-ae5b-73b2-bff4-873a5eec3e00/exec-7e1dcd8d-22f7-4094-ba1d-8e9f251c535e.png`
- Final asset: `frontend/public/dungeon/rooms/original/zombie-1-grave-belle.webp`
- Exact prompt:

```text
Use case: style-transfer
Asset type: 3:2 Delveworn game-room background for Grave Belle, zombie tier 1
Input images: Image 1 is the strict room geometry, camera, and layout edit target. Image 2 is the authoritative environmental reference only; do not copy its zombie character.
Primary request: rebuild Image 1 as the crypt shown behind Grave Belle in Image 2, using its real architectural language rather than a simple recolor.
Environmental findings to carry over from Image 2: deep charcoal and bruised-purple gothic crypt masonry; repeated tall rounded stone arches and recessed black alcoves; chunky square braziers with supernatural violet flames; heavy black iron chains; sparse skulls and long bones gathered along the edges; low purple miasma curling at the perimeter; irregular dark rectangular stone paving with restrained violet reflections.
Style/medium: preserve the original detailed painterly Delveworn dark-fantasy finish, sharp stone texture, readable floor values, and overhead/isometric room rendering.
Strict composition invariants: exact 3:2 frame and same overhead camera/perspective as Image 1; same rectangular room geometry; centered CLOSED north door with inner aperture at logical x=407..493, y=10..77 in a 900x600 room; same south-center stairs and same four fire-source positions. Preserve a broad, flat, unobstructed playable floor across logical x=170..733, y=190..505. Keep the upper-left/left perimeter Kevin merchant bay open. The floor medallion may be replaced with subtle irregular crypt paving derived from Image 2.
Placement: arches, chains, braziers, skulls, bones, rubble, and violet miasma stay against the perimeter walls only. Keep purple floor haze faint and edge-bound so avatars and loot have strong ground contrast.
Tier identity: this is the earliest and sparsest Grave Belle crypt—weathered, neglected, and ominous, with two dominant violet side braziers and modest bone piles, not regal or elaborate.
Avoid: no zombie, person, creature, silhouette, statue, merchant, wagon, throne, furniture, grave marker in the playable floor, carpet, raised dais, center obstacle, text, letters, numbers, logo, UI, loot, watermark, open door, extra doorway, changed stairs, changed framing, orange flames, red boss banners.
```

## Zombie tier 2 — Miss Morgue

- Environment reference: `frontend/public/monsters/zombie-2-miss-morgue.webp`
- Visual findings: a denser mortuary crypt with deeper repeated arches, thick hanging chains, stronger violet haze, purple-flame braziers, and larger perimeter drifts of bones and skulls; this tier has no spectral-skull centerpiece.
- Generated source: `/Users/mikkelraaholt/.codex/generated_images/01a0a95d-ae5b-73b2-bff4-873a5eec3e00/exec-45ad8346-8f96-427a-8656-1037908980dc.png`
- Final asset: `frontend/public/dungeon/rooms/original/zombie-2-miss-morgue.webp`
- Exact prompt:

```text
Use case: style-transfer
Asset type: 3:2 Delveworn game-room background for Miss Morgue, zombie tier 2
Input images: Image 1 is the strict room geometry, camera, and layout edit target. Image 2 is the authoritative environmental reference only; do not copy its zombie character.
Primary request: rebuild Image 1 as the mortuary crypt shown behind Miss Morgue in Image 2, using its actual architecture and props rather than merely recoloring the old room.
Environmental findings to carry over from Image 2: near-black charcoal masonry with bruised-purple illumination; repeated tall rounded crypt arches and deep recessed alcoves; chunky stone braziers burning supernatural violet flame; heavy hanging iron chains; denser drifts of skulls and long bones at the lower wall edges; purple ground haze pooling around the perimeter; uneven rectangular dark stone pavers with subtle violet reflections.
Style/medium: preserve the original detailed painterly Delveworn dark-fantasy finish, crisp readable stone texture, strong silhouette contrast, and overhead/isometric room rendering.
Strict composition invariants: exact 3:2 frame and same overhead camera/perspective as Image 1; same rectangular room geometry; centered CLOSED north door with inner aperture at logical x=407..493, y=10..77 in a 900x600 room; same south-center stairs and same four fire-source positions. Preserve a broad, flat, unobstructed playable floor across logical x=170..733, y=190..505. Keep the upper-left/left perimeter Kevin merchant bay open. The floor medallion may be replaced with the irregular crypt paving derived from Image 2.
Placement: arches, chains, braziers, skulls, bones, rubble, and violet miasma stay against the perimeter walls only. Keep floor haze faint and edge-bound so avatars and loot retain strong ground contrast.
Tier identity: more established and crowded than Grave Belle—a working mortuary corridor with deeper layered arches, denser perimeter bone deposits, and stronger violet haze, but still restrained rather than regal. Do not add a spectral skull motif absent from this source tier.
Avoid: no zombie, person, creature, silhouette, statue, merchant, wagon, throne, furniture, grave marker in the playable floor, carpet, raised dais, center obstacle, text, letters, numbers, logo, UI, loot, watermark, open door, extra doorway, changed stairs, changed framing, orange flames, red boss banners.
```

## Zombie tier 3 — Velvet Rot

- Environment reference: `frontend/public/monsters/zombie-3-velvet-rot.webp`
- Visual findings: a more elaborate ritual crypt with layered arches, brighter purple flame, heavier spectral haze, perimeter bones and chains, and a distinct floating violet skull motif in the painted environment.
- Generated source: `/Users/mikkelraaholt/.codex/generated_images/01a0a95d-ae5b-73b2-bff4-873a5eec3e00/exec-ce022858-9d59-489f-8a16-cb4f4389c157.png`
- Final asset: `frontend/public/dungeon/rooms/original/zombie-3-velvet-rot.webp`
- Exact prompt:

```text
Use case: style-transfer
Asset type: 3:2 Delveworn game-room background for Velvet Rot, zombie tier 3
Input images: Image 1 is the strict room geometry, camera, and layout edit target. Image 2 is the authoritative environmental reference only; do not copy its zombie character.
Primary request: rebuild Image 1 as the elaborate necromantic crypt shown behind Velvet Rot in Image 2, translating the source painting's actual arches, chains, bones, violet fire, and spectral atmosphere into this playable room rather than simply recoloring the old room.
Environmental findings to carry over from Image 2: black and purple gothic stonework; multiple deep rounded arch recesses; heavy hanging iron chains; square stone braziers with brilliant violet flame; skull and long-bone deposits against the walls; richer ribbons of violet ghost fog; a luminous spectral purple skull motif; rough dark rectangular crypt paving with controlled violet reflections.
Style/medium: preserve the original detailed painterly Delveworn dark-fantasy finish, tactile masonry, clear floor values, and overhead/isometric room rendering.
Strict composition invariants: exact 3:2 frame and same overhead camera/perspective as Image 1; same rectangular room geometry; centered CLOSED north door with inner aperture at logical x=407..493, y=10..77 in a 900x600 room; same south-center stairs and same four fire-source positions. Preserve a broad, flat, unobstructed playable floor across logical x=170..733, y=190..505. Keep the upper-left/left perimeter Kevin merchant bay open. The floor medallion may be replaced with the irregular crypt paving derived from Image 2.
Placement: arches, chains, braziers, skulls, bones, rubble, and violet miasma stay against the perimeter walls only. Integrate one spectral violet skull as a ghostly relief high in the north wall above or beside the closed door, never floating over the playable floor. Keep floor haze faint and edge-bound so avatars and loot retain strong ground contrast.
Tier identity: more ornate and supernaturally active than the first two crypts, with layered ritual arches, brighter violet fire, flowing ghost haze, and the source painting's spectral-skull signature, while remaining a functional open game room.
Avoid: no zombie, person, creature body, character silhouette, statue, merchant, wagon, throne, furniture, grave marker in the playable floor, carpet, raised dais, center obstacle, text, letters, numbers, logo, UI, loot, watermark, open door, extra doorway, changed stairs, changed framing, orange flames, red boss banners.
```

## Zombie tier 4 — Lady Decomposition

- Environment reference: `frontend/public/monsters/zombie-4-lady-decomposition.webp`
- Visual findings: the richest zombie environment, with deep black arch colonnades, intense violet fire and miasma, spectral skull imagery, dense perimeter bones and chains, richly worn paving, and restrained aged-metal detail.
- Generated source: `/Users/mikkelraaholt/.codex/generated_images/01a0a95d-ae5b-73b2-bff4-873a5eec3e00/exec-3084dfa7-9380-4821-ba48-a35ec7c6548d.png`
- Final asset: `frontend/public/dungeon/rooms/original/zombie-4-lady-decomposition.webp`
- Exact prompt:

```text
Use case: style-transfer
Asset type: 3:2 Delveworn game-room background for Lady Decomposition, zombie tier 4
Input images: Image 1 is the strict room geometry, camera, and layout edit target. Image 2 is the authoritative environmental reference only; do not copy its zombie character, crown, gown, or body.
Primary request: rebuild Image 1 as the imposing high-tier necromantic crypt shown behind Lady Decomposition in Image 2, translating the source painting's real architecture, violet fire, spectral fog, chains, bones, and dark stone into a playable room rather than merely recoloring the old room.
Environmental findings to carry over from Image 2: very dark charcoal and black gothic masonry; a deep colonnade of tall rounded crypt arches and recessed voids; heavy iron chains; intense supernatural violet braziers; dense skull and long-bone deposits at wall edges; luminous purple miasma; spectral skull imagery; richly weathered rectangular stone paving with violet reflections; restrained amethyst and aged-metal accents appropriate to a grand mortuary hall.
Style/medium: preserve the original detailed painterly Delveworn dark-fantasy finish, premium tactile stone and metal detail, strong readable floor contrast, and overhead/isometric room rendering.
Strict composition invariants: exact 3:2 frame and same overhead camera/perspective as Image 1; same rectangular room geometry; centered CLOSED north door with inner aperture at logical x=407..493, y=10..77 in a 900x600 room; same south-center stairs and same four fire-source positions. Preserve a broad, flat, unobstructed playable floor across logical x=170..733, y=190..505. Keep the upper-left/left perimeter Kevin merchant bay open. The floor medallion may be replaced with the irregular crypt paving derived from Image 2.
Placement: arches, chains, braziers, skulls, bones, rubble, and violet miasma stay against the perimeter walls only. Integrate one restrained spectral violet skull as a relief or apparition high in the north wall architecture, never over the playable floor. Keep floor haze edge-bound so avatars and loot retain strong ground contrast.
Tier identity: the richest and most supernaturally intense zombie crypt—a grand decayed mortuary hall with layered arches, bright violet flame, denser perimeter bones, and spectral detail. Express status through architecture and trim only; do not reproduce Lady Decomposition or her crown, costume, or silhouette.
Avoid: no zombie, person, creature body, character silhouette, statue, merchant, wagon, throne, furniture, grave marker in the playable floor, carpet, raised dais, center obstacle, text, letters, numbers, logo, UI, loot, watermark, open door, extra doorway, changed stairs, changed framing, orange flames, red boss banners.
```
