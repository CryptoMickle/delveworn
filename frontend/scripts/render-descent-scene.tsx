/** Static illustration export from the scene component. This is not a browser
 * screenshot and does not validate controls, responsive CSS or app navigation. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { DungeonScene } from "../app/dungeon/scene";

async function main() {
const out = "../docs/phase-1-evidence";
await mkdir(out,{recursive:true});
for (const enemy of [0,1,2,3] as const) {
  const markup = renderToStaticMarkup(<DungeonScene view={{room:enemy === 3 ? 10 : 1,enemy,enemyName:"",enemyHp:40,hp:76,relic:6,weapon:1,armor:0,phase:"combat",pending:false,cue:null,cueId:0,damage:0,incoming:0}} actions={{approach:()=>{},enter:()=>{}}} />);
  let svg = markup.slice(markup.indexOf("<svg"),markup.lastIndexOf("</svg>")+6).replace("<svg ",'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" ');
  const css = await readFile("app/dungeon/scene.css","utf8");
  svg = svg.replace(/(<svg[^>]*>)/,`$1<style>${css}</style>`);
  const paths = [...new Set([...svg.matchAll(/href="(\/[^\"]+)"/g)].map(m=>m[1]))];
  for (const path of paths) {
    const png = await sharp(await readFile("public"+path)).png().toBuffer();
    svg = svg.replaceAll(`href="${path}"`,`href="data:image/png;base64,${png.toString("base64")}"`);
  }
  await sharp(Buffer.from(svg)).png().toFile(`${out}/descent-scene-${enemy}.png`);
}
console.log("Exported four static scene illustrations. Browser interaction remains unverified.");
}
void main().catch(error => { console.error(error); process.exitCode=1; });
