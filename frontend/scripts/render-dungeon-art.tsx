/** Reproducible SVG art review. This does not run a browser or verify gameplay. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdir, readFile } from "node:fs/promises";
import sharp, { type OverlayOptions } from "sharp";
import { EnemySprite, getEnemyArt } from "../app/dungeon/scene";

async function main() {
  const cellWidth=300, cellHeight=500;
  const background="#51454d";
  const layers: OverlayOptions[]=[];
  for (const type of [0,1,2,3] as const) for (const tier of [0,1,2,3]) {
    const room=tier*10+1, art=getEnemyArt(type,room);
    const source=await sharp(await readFile(`public${art.src}`)).png().toBuffer();
    let sprite=renderToStaticMarkup(<EnemySprite type={type} room={room} />);
    sprite=sprite.replace(`href="${art.src}"`,`href="data:image/png;base64,${source.toString("base64")}"`);
    const escape=(text:string)=>text.replaceAll("&","&amp;").replaceAll("<","&lt;");
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${cellWidth}" height="${cellHeight}">
      <rect width="100%" height="100%" fill="${background}"/>
      <text x="12" y="23" fill="#fff1d6" font-size="15">T${tier+1} · ${escape(art.name)}</text>
      <svg x="8" y="35" width="284" height="300">${sprite}</svg>
      <svg x="8" y="${cellHeight-15-art.roomHeight*.65}" width="284" height="${art.roomHeight*.65}">${sprite}</svg>
    </svg>`;
    layers.push({input:await sharp(Buffer.from(svg)).png().toBuffer(),left:tier*cellWidth,top:type*cellHeight});
  }
  const output=process.argv[2] ?? "../docs/phase-1-evidence/monster-cutout-review.png";
  await mkdir(output.slice(0,output.lastIndexOf("/")) || ".",{recursive:true});
  await sharp({create:{width:cellWidth*4,height:cellHeight*4,channels:3,background}})
    .composite(layers).png().toFile(output);
  console.log(`Rendered 16 original monster cutouts, large and room-size: ${output}`);
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
