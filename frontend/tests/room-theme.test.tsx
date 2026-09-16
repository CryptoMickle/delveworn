import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getRoomTheme } from "../app/dungeon/room-theme";
import { DungeonScene, type RoomView } from "../app/dungeon/scene";
import type { MonsterType } from "../app/practice/engine";

const actions={approach(){},enter(){}};
const base:RoomView={room:1,seed:12,enemy:0,enemyName:"Grave Belle",enemyHp:30,hp:100,relic:0,weapon:0,armor:0,
  phase:"combat",pending:false,cue:null,cueId:0,damage:0,incoming:0};

test("each monster family maps to one available room background", () => {
  const expected=[
    ["crypt","/dungeon/stone-room.webp"],
    ["goblin","/dungeon/rooms/goblin-storeroom.webp"],
    ["orc","/dungeon/rooms/orc-armory.webp"],
    ["boss","/dungeon/rooms/boss-hall.webp"],
  ];
  const themes=([0,1,2,3] as const).map(getRoomTheme);
  assert.deepEqual(themes.map(theme=>[theme.id,theme.backgroundSrc]),expected);
  assert.equal(new Set(themes.map(theme=>theme.id)).size,4);
  for(const theme of themes) assert.equal(existsSync(join(process.cwd(),"public",theme.backgroundSrc)),true,`${theme.backgroundSrc} exists`);
});

test("the real scene renders every themed room on the same fixed floor geometry", () => {
  for(const enemy of [0,1,2,3] as const satisfies readonly MonsterType[]) {
    const theme=getRoomTheme(enemy);
    const markup=renderToStaticMarkup(createElement(DungeonScene,{view:{...base,enemy},actions}));
    assert.match(markup,new RegExp(`data-room-theme="${theme.id}"`));
    assert.match(markup,/viewBox="0 0 900 600"/);
    assert.ok(markup.includes(`href="${theme.backgroundSrc}"`));
  }
});

test("defeating a monster keeps its room theme through loot", () => {
  const enemy=2, theme=getRoomTheme(enemy);
  const combat=renderToStaticMarkup(createElement(DungeonScene,{view:{...base,enemy},actions}));
  const loot=renderToStaticMarkup(createElement(DungeonScene,{view:{...base,enemy,enemyHp:0,phase:"loot",loot:{type:2,amount:9,gold:9,relicId:0}},actions}));
  for(const markup of [combat,loot]) {
    assert.match(markup,new RegExp(`data-room-theme="${theme.id}"`));
    assert.ok(markup.includes(`href="${theme.backgroundSrc}"`));
  }
});
