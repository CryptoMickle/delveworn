/** Static illustration export from the scene component. This is not a browser
 * screenshot and does not validate controls, responsive CSS or app navigation. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { DungeonScene, type RoomView } from "../app/dungeon/scene";

async function main() {
const out = "../docs/phase-1-evidence";
await mkdir(out,{recursive:true});
const base: RoomView = {room:1,enemy:0,enemyName:"Grave Belle",enemyHp:30,hp:76,relic:0,weapon:0,armor:0,phase:"combat",pending:false,cue:null,cueId:0,damage:0,incoming:0};
const scenes: {name:string;view:RoomView}[] = [
  ...([0,1,2,3] as const).map(enemy=>({name:`descent-scene-${enemy}`,view:{...base,room:enemy === 3 ? 10 : 1,enemy}})),
  ...([1,2,3,4] as const).map(type=>({name:`descent-loot-${type}`,view:{...base,enemyHp:0,phase:"loot" as const,loot:{type,amount:type === 2 ? 9 : 1,gold:type === 2 ? 14 : 5,relicId:0}}})),
  {name:"descent-loot-boss",view:{...base,room:10,enemy:3,enemyHp:0,phase:"loot",loot:{type:4,amount:1,gold:30,relicId:2}}},
];
for (const {name,view} of scenes) {
  const markup = renderToStaticMarkup(<DungeonScene view={view} actions={{approach:()=>{},enter:()=>{},collect:()=>{}}} />);
  let svg = markup.slice(markup.indexOf("<svg"),markup.lastIndexOf("</svg>")+6).replace("<svg ",'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" ');
  const css = await readFile("app/dungeon/scene.css","utf8");
  svg = svg.replace(/(<svg[^>]*>)/,`$1<style>${css}</style>`);
  const paths = [...new Set([...svg.matchAll(/href="(\/[^\"]+)"/g)].map(m=>m[1]))];
  for (const path of paths) {
    const png = await sharp(await readFile("public"+path)).png().toBuffer();
    svg = svg.replaceAll(`href="${path}"`,`href="data:image/png;base64,${png.toString("base64")}"`);
  }
  await sharp(Buffer.from(svg)).png().toFile(`${out}/${name}.png`);
}
console.log(`Exported ${scenes.length} static scene illustrations. Browser interaction remains unverified.`);
}
void main().catch(error => { console.error(error); process.exitCode=1; });
