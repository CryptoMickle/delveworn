# Transparent loot assets

Generated on 2026-09-15 with the built-in `image_gen` tool. The three existing 800×800 source assets were inspected before editing and remain unchanged. Final project assets were resized to 512×512 WebP with Sharp, preserving their generated alpha channels.

## Source and output paths

| Asset | Source / reference | Output |
| --- | --- | --- |
| Potion | `frontend/public/assets/loot/potion-v1.webp` | `frontend/public/dungeon/loot/potion.webp` |
| Weapon | `frontend/public/assets/loot/weapon-v1.webp` | `frontend/public/dungeon/loot/weapon.webp` |
| Armor / shield | `frontend/public/assets/loot/armor-v1.webp` | `frontend/public/dungeon/loot/armor.webp` |
| Boss relic pouch | `frontend/public/assets/loot/armor-v1.webp` (material/style reference); first pouch render used as the final background-extraction target | `frontend/public/dungeon/loot/pouch.webp` |

## Final prompts

### Potion

```text
Use case: background-extraction
Asset type: small fantasy game loot sprite
Input images: Image 1: edit target
Primary request: Remove the black background, floor, shadow, and exterior glow from Image 1. Preserve the exact potion unchanged. Deliver the potion alone on a genuinely transparent RGBA canvas.
Constraints: All four corners and all empty pixels outside the potion must have alpha 0. Keep the exact bottle silhouette, cork, bronze star band, green glass, liquid, bubbles, swirl, colors, materials, highlights, proportions, scale, and pose from Image 1. Tight transparent padding.
Avoid: no checkerboard graphic, no solid or colored backdrop, no shadow, no floor, no halo, no added or altered details, no text, no watermark.
```

### Weapon

```text
Use case: background-extraction
Asset type: Delveworn dungeon-room loot UI sprite
Input images: Image 1: edit target
Primary request: Extract the exact medieval longsword from Image 1 onto a genuinely transparent background.
Subject: Keep the identical long silver double-edged blade with central fuller, bronze angular crossguard and pommel, brown leather-wrapped grip, warm metal rim light, proportions, and lower-left to upper-right diagonal pose.
Composition/framing: Preserve the item's exact diagonal orientation and proportions; center it with tight, even transparent padding around the full silhouette, including the blade tip and pommel.
Constraints: Change only the background. Keep the sword design, silhouette, materials, colors, wear, texture, object lighting, and pose unchanged. Preserve crisp antialiased edges. The pixels outside the object must have a real alpha channel.
Avoid: black or colored backdrop, floor, cast shadow, ground reflection, exterior glow, halo, vignette, checkerboard pattern, new details, redesign, restyling, text, watermark.
```

### Armor / shield

```text
Use case: background-extraction
Asset type: Delveworn dungeon-room loot UI sprite
Input images: Image 1: edit target
Primary request: Extract the exact medieval kite shield from Image 1 onto a genuinely transparent background.
Subject: Keep the identical front-facing steel kite shield, bronze rim and rivets, dark leather side straps, central four-point bronze star boss, scratches, wear, proportions, and upright pose.
Composition/framing: Preserve the item's exact scale, straight-on orientation, symmetry, and proportions; center it with tight, even transparent padding around the silhouette.
Constraints: Change only the background. Keep the shield design, silhouette, materials, colors, texture, wear, object lighting, and pose unchanged. Preserve crisp antialiased edges and strap contours. The pixels outside the object must have a real alpha channel.
Avoid: black or colored backdrop, floor, cast shadow, ground reflection, exterior glow, halo, vignette, checkerboard pattern, new details, redesign, restyling, text, watermark.
```

### Boss relic pouch concept

```text
Use case: stylized-concept
Asset type: Delveworn dungeon-room loot UI sprite
Input images: Image 1: visual style and material reference only
Primary request: Create one small worn leather drawstring loot pouch used to hold an earned boss relic before reveal.
Subject: A compact closed brown leather pouch with gathered drawstring neck, subtle natural creases and scuffs, and one small tasteful gold diamond-shaped seal fixed to the front.
Style/medium: Detailed polished fantasy game loot render matching Image 1's realistic worn leather, warm antique gold, crisp silhouette, and dramatic object lighting.
Composition/framing: Single centered upright pouch, slight three-quarter dimensionality, tight even transparent padding, readable at 44–90 px.
Constraints: Genuinely transparent RGBA background with alpha 0 outside the pouch. Keep the design simple and iconic. No other objects.
Avoid: floor, cast shadow, ground reflection, exterior glow, halo, backdrop, checkerboard pattern, text, runes, watermark, coins, weapons, shield.
```

The concept render baked in a checker pattern, so the following targeted edit produced the final alpha-bearing pouch:

```text
Use case: background-extraction
Asset type: Delveworn loot UI sprite
Input images: Image 1: edit target
Primary request: Remove the visible gray-and-white checkerboard from Image 1 and return the exact leather loot pouch alone on a genuinely transparent RGBA canvas.
Constraints: Change only the background. Preserve the pouch design, silhouette, drawstrings, worn brown leather, gold diamond seal, materials, colors, highlights, proportions, front-facing pose, and every object detail unchanged. All pixels outside the pouch, including all four corners, must be alpha 0. Keep tight transparent padding and clean antialiased edges.
Avoid: no checkerboard graphic, no solid or colored backdrop, no floor, no cast shadow, no ground reflection, no exterior glow, no halo, no text, no watermark, no redesign.
```

## Alpha validation

Validation decoded each final WebP with Sharp and inspected the alpha byte for every pixel. All files report four channels and `hasAlpha: true`; all four corner pixels are fully transparent.

| Asset | Size | Bytes | Fully transparent pixels | Partially transparent pixels | Corner alpha (TL, TR, BL, BR) |
| --- | ---: | ---: | ---: | ---: | --- |
| `potion.webp` | 512×512 | 63,068 | 154,340 | 106,925 | `0, 0, 0, 0` |
| `weapon.webp` | 512×512 | 29,096 | 230,156 | 31,008 | `0, 0, 0, 0` |
| `armor.webp` | 512×512 | 58,022 | 162,305 | 99,034 | `0, 0, 0, 0` |
| `pouch.webp` | 512×512 | 67,996 | 139,585 | 121,169 | `0, 0, 0, 0` |

Each final asset was also visually inspected after WebP conversion for subject identity, pose, materials, padding, missing edges, background remnants, and cast shadows.
