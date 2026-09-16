import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getRoomTheme } from "../app/dungeon/room-theme";
import { DungeonScene, getEnemyArt, type RoomView } from "../app/dungeon/scene";
import type { MonsterType } from "../app/practice/engine";

const actions={approach(){},enter(){}};
const base:RoomView={room:1,seed:12,enemy:0,enemyName:"Grave Belle",enemyHp:30,hp:100,relic:0,weapon:0,armor:0,
  phase:"combat",pending:false,cue:null,cueId:0,damage:0,incoming:0};

test("all 16 original monster paintings have a matching available room", () => {
  const backgrounds=new Set<string>();
  for(const enemy of [0,1,2,3] as const) for(const room of [1,11,21,31]) {
    const theme=getRoomTheme(enemy,room), art=getEnemyArt(enemy,room);
    assert.equal(theme.referenceSrc,art.src);
    assert.equal(theme.backgroundSrc,art.src.replace("/monsters/","/dungeon/rooms/original/"));
    assert.equal(existsSync(join(process.cwd(),"public",theme.backgroundSrc)),true,`${theme.backgroundSrc} exists`);
    backgrounds.add(theme.backgroundSrc);
  }
  assert.equal(backgrounds.size,16);
});

test("room backgrounds follow the same tier boundaries as the monster illustration", () => {
  for(const enemy of [0,1,2,3] as const) for(const room of [1,10,11,20,21,30,31,40,41,50,101,1001]) {
    const theme=getRoomTheme(enemy,room);
    assert.equal(theme.referenceSrc,getEnemyArt(enemy,room).src,`enemy ${enemy}, room ${room}`);
    assert.equal(theme.artTier,Math.min(4,Math.ceil(room/10)));
  }
});

test("the real scene renders every themed room on the same fixed floor geometry", () => {
  for(const enemy of [0,1,2,3] as const satisfies readonly MonsterType[]) for(const room of [1,11,21,31]) {
    const theme=getRoomTheme(enemy,room);
    const markup=renderToStaticMarkup(createElement(DungeonScene,{view:{...base,enemy,room},actions}));
    assert.match(markup,new RegExp(`data-room-theme="${theme.id}"`));
    assert.match(markup,new RegExp(`data-room-art-tier="${theme.artTier}"`));
    assert.match(markup,/viewBox="0 0 900 600"/);
    assert.ok(markup.includes(`href="${theme.backgroundSrc}"`));
  }
});

test("attacks and victory keep the matching tier room through loot and recovery", () => {
  const enemy=2, room=21, theme=getRoomTheme(enemy,room);
  for(const phase of ["explore","combat","loot","recovery"] as const) {
    const markup=renderToStaticMarkup(createElement(DungeonScene,{view:{...base,enemy,room,phase,
      enemyHp:phase === "loot" || phase === "recovery" ? 0 : 30,
      loot:{type:2,amount:9,gold:9,relicId:0},cue:phase === "combat" ? "attack" : null,cueId:2},actions}));
    assert.match(markup,new RegExp(`data-room-theme="${theme.id}"`));
    assert.ok(markup.includes(`href="${theme.backgroundSrc}"`));
  }
});
