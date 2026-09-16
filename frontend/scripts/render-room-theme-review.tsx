/** Static art comparison only: this does not launch a browser or test gameplay. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdir, readFile } from "node:fs/promises";
import sharp, { type OverlayOptions } from "sharp";
import { EnemySprite, getEnemyArt } from "../app/dungeon/scene";
import { getRoomTheme } from "../app/dungeon/room-theme";

async function imageData(src: string) {
  return `data:image/png;base64,${(await sharp(await readFile(`public${src}`)).png().toBuffer()).toString("base64")}`;
}
const escape=(text:string)=>text.replaceAll("&","&amp;").replaceAll("<","&lt;");

async function main() {
  const output=process.argv[2] ?? "/tmp/delveworn-original-rooms";
  await mkdir(output,{recursive:true});
  for(const type of [0,1,2,3] as const) {
    const layers:OverlayOptions[]=[];
    for(const tier of [1,2,3,4]) {
      const room=(tier-1)*10+1, art=getEnemyArt(type,room), theme=getRoomTheme(type,room);
      const original=await imageData(art.src), background=await imageData(theme.backgroundSrc);
      let enemy=renderToStaticMarkup(<EnemySprite type={type} room={room} />);
      enemy=enemy.replace(`href="${art.src}"`,`href="${original}"`);
      const [, , cropWidth,cropHeight]=art.crop.split(" ").map(Number);
      const h=art.roomHeight,w=h*cropWidth/cropHeight;
      const roomSvg=(cleared:boolean)=>`<svg width="900" height="600" xmlns="http://www.w3.org/2000/svg">
        <image href="${background}" width="900" height="600"/>
        ${cleared ? `<path d="${theme.openDoorPath}" fill="#030205"/><path d="${theme.doorLightPath}" fill="#eac170" opacity=".12"/>` :
          `<ellipse cx="450" cy="233" rx="${w*.4}" ry="${h*.07}" fill="#000" opacity=".62"/><svg x="${450-w/2}" y="${236-h}" width="${w}" height="${h}">${enemy}</svg>`}
      </svg>`;
      const heading=Buffer.from(`<svg width="300" height="30" xmlns="http://www.w3.org/2000/svg"><text x="8" y="20" fill="#f3dfc2" font-family="serif" font-size="14">T${tier} · ${escape(art.name)}</text></svg>`);
      const panel=await sharp({create:{width:300,height:600,channels:3,background:"#17111b"}}).composite([
        {input:heading,left:0,top:0},
        {input:await sharp(await readFile(`public${art.src}`)).resize(300,169,{fit:"contain"}).png().toBuffer(),left:0,top:30},
        {input:await sharp(Buffer.from(roomSvg(false))).resize(300,200).png().toBuffer(),left:0,top:199},
        {input:await sharp(Buffer.from(roomSvg(true))).resize(300,200).png().toBuffer(),left:0,top:399},
      ]).png().toBuffer();
      layers.push({input:panel,left:(tier-1)*300,top:0});
    }
    const path=`${output}/${["zombie","goblin","orc","boss"][type]}.png`;
    await sharp({create:{width:1200,height:600,channels:3,background:"#17111b"}}).composite(layers).png().toFile(path);
    console.log(path);
  }
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
