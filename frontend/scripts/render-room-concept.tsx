/** Export the code-drawn scene as an illustration, without opening a browser.
 * This does not verify CSS layout, pointer controls or the interactive page.
 * Run: node --import tsx scripts/render-room-concept.tsx
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ConceptScene } from "../app/concept/scene";

async function main() {
  const output = path.resolve("../docs/phase-1-evidence");
  await mkdir(output, { recursive: true });
  // SVG rasterizers support embedded PNG more consistently than WebP.
  const relic = await sharp(await readFile("public/assets/relics/stormglass.webp")).png().toBuffer();
  for (const storm of [false, true]) {
    let svg = renderToStaticMarkup(<ConceptScene
      position={storm ? { x: 463, y: 356 } : { x: 345, y: 431 }} walking={false}
      inCombat={storm} cleared={false} ended={false} atDoor={false}
      cue={storm ? "storm" : null} turn={storm ? 1 : 0} damage={23} incoming={7}
      critical={false} healed={0} onFloor={() => undefined} onKeys={() => undefined}
      svgRef={{ current: null }}
    />);
    svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640" ')
      .replace('href="/assets/relics/stormglass.webp"', `href="data:image/png;base64,${relic.toString("base64")}"`);
    await sharp(Buffer.from(svg)).png().toFile(path.join(output, `concept-scene${storm ? "-storm" : ""}.png`));
  }
  process.stdout.write("Exported two static scene illustrations; browser layout remains unverified.\n");
}

void main().catch(error => { process.stderr.write(`${error}\n`); process.exitCode = 1; });
