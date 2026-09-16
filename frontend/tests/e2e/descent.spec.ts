import { expect, test, type Locator, type Page } from "@playwright/test";
import { createDescent, phase, transition, type Descent } from "../../app/descent/model";
import { DESCENT_SAVE_KEY } from "../../app/descent/storage";
import { informedPolicy } from "../helpers/descent-policy";

const saved = (page: Page): Promise<Descent> => page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),DESCENT_SAVE_KEY);
const playerHud = (page: Page) => page.locator(".dungeon-original-hud .practice-hud:visible");
const safePotion = (page: Page) => page.locator(".dungeon-recovery-controls > button.dungeon-inventory-potions:visible");
type RoomPoint = { x: number; y: number };
type FloorFrame = { a: number; b: number; c: number; d: number; e: number; f: number; x: number; y: number; width: number; height: number };

function roomPoint(value: string | null): RoomPoint {
  const [x,y]=(value ?? "").split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Invalid room point: ${value}`);
  return {x,y};
}
const distance = (a: RoomPoint,b: RoomPoint) => Math.hypot(a.x-b.x,a.y-b.y);
function distanceToSegment(point:RoomPoint,start:RoomPoint,end:RoomPoint) {
  const dx=end.x-start.x,dy=end.y-start.y;
  const fraction=Math.max(0,Math.min(1,((point.x-start.x)*dx+(point.y-start.y)*dy)/(dx*dx+dy*dy)));
  return distance(point,{x:start.x+fraction*dx,y:start.y+fraction*dy});
}
const avatarPoint = async(page:Page) => roomPoint(await page.locator("[data-avatar-position]").getAttribute("data-avatar-position"));

async function floorFrame(floor:Locator):Promise<FloorFrame> {
  return floor.evaluate(element=>{
    const svg=element as SVGSVGElement, matrix=svg.getScreenCTM(), rect=svg.getBoundingClientRect();
    if (!matrix) throw new Error("Room floor has no screen transform");
    return {a:matrix.a,b:matrix.b,c:matrix.c,d:matrix.d,e:matrix.e,f:matrix.f,x:rect.x,y:rect.y,width:rect.width,height:rect.height};
  });
}

function expectStableFloor(before:FloorFrame,after:FloorFrame) {
  for (const key of ["a","b","c","d"] as const)
    expect(Math.abs(after[key]-before[key]),`${key} changed during the combat state update`).toBeLessThanOrEqual(.001);
  for (const key of ["e","f","x","y","width","height"] as const)
    expect(Math.abs(after[key]-before[key]),`${key} changed during the combat state update`).toBeLessThanOrEqual(.75);
}

function expectFloorScaleMatchesBox(frame:FloorFrame) {
  const expected=Math.max(frame.width/900,frame.height/600);
  expect(Math.abs(frame.a-expected)).toBeLessThanOrEqual(.01);
  expect(Math.abs(frame.d-expected)).toBeLessThanOrEqual(.01);
  expect(Math.abs(frame.b)).toBeLessThanOrEqual(.01);
  expect(Math.abs(frame.c)).toBeLessThanOrEqual(.01);
}

async function tapRoomPoint(page:Page,floor:Locator,point:RoomPoint,isMobile:boolean) {
  const client=await floor.evaluate((element,target)=>{
    const matrix=(element as SVGSVGElement).getScreenCTM();
    if (!matrix) throw new Error("Room floor has no screen transform");
    return {x:matrix.a*target.x+matrix.c*target.y+matrix.e,y:matrix.b*target.x+matrix.d*target.y+matrix.f};
  },point);
  if (isMobile) await page.touchscreen.tap(client.x,client.y); else await page.mouse.click(client.x,client.y);
}

async function dispatchRoomPoint(floor:Locator,point:RoomPoint) {
  await floor.evaluate((element,target)=>{
    const matrix=(element as SVGSVGElement).getScreenCTM();
    if(!matrix) throw new Error("Room floor has no screen transform");
    const init={bubbles:true,clientX:matrix.a*target.x+matrix.c*target.y+matrix.e,clientY:matrix.b*target.x+matrix.d*target.y+matrix.f,pointerId:1,isPrimary:true};
    element.dispatchEvent(new PointerEvent("pointerdown",init));
    element.dispatchEvent(new PointerEvent("pointerup",init));
  },point);
}

async function renderedLootPoint(page:Page):Promise<RoomPoint> {
  return roomPoint(await page.locator("[data-loot-position]").getAttribute("data-loot-position"));
}

async function stableRenderedLootPoint(page:Page):Promise<RoomPoint> {
  let previous:string|null=null, stableReads=0;
  await expect.poll(async()=>{
    const current=await page.locator("[data-loot-position]").getAttribute("data-loot-position");
    stableReads=current === previous ? stableReads+1 : 0; previous=current;
    return stableReads;
  }).toBeGreaterThanOrEqual(2);
  return roomPoint(previous);
}

function recoveryAtRoom(room:number):Descent {
  let run=createDescent(0,`kevin-room-${room}`);
  for(let action=0;action<250;action++) {
    if(phase(run) === "recovery" && run.game.roomsCleared === room) return run;
    const next=transition(run,informedPolicy(run));
    if(next === run) throw new Error(`Could not advance the Kevin fixture from ${phase(run)} in room ${run.game.roomsCleared}`);
    run=next;
  }
  throw new Error(`Could not reach recovery in room ${room}`);
}

function wasdToward(start:RoomPoint,target:RoomPoint) {
  const dx=target.x-start.x,dy=target.y-start.y;
  return Math.abs(dx)>Math.abs(dy) ? dx<0 ? "a" : "d" : dy<0 ? "w" : "s";
}

async function walkToLootWithKeyboard(page:Page,target:RoomPoint) {
  for (let step=0;step<32 && await page.locator("[data-descent-phase='loot']").count();step++) {
    const before=await avatarPoint(page), key=wasdToward(before,target);
    await page.keyboard.down(key);
    try {
      await expect.poll(async()=>{
        if (!await page.locator("[data-descent-phase='loot']").count()) return true;
        return distance(await avatarPoint(page),before)>38;
      }).toBe(true);
    } finally { await page.keyboard.up(key); }
  }
}

async function traceApproach(approach:Locator) {
  return approach.evaluate(async button=>{
    const root=document.querySelector<HTMLElement>("[data-descent-phase]")!;
    const originalActor=document.querySelector<SVGGElement>("[data-avatar-position]")!;
    const originalAvatar=originalActor.querySelector<SVGGElement>(".dungeon-avatar")!;
    const positions:string[]=[];
    let sameActor=true, sameAvatar=true;
    const sample=()=>{
      const actor=document.querySelector<SVGGElement>("[data-avatar-position]");
      sameActor&&=actor === originalActor;
      sameAvatar&&=actor?.querySelector(".dungeon-avatar") === originalAvatar;
      const value=actor?.getAttribute("data-avatar-position");
      if (value && positions.at(-1) !== value) positions.push(value);
    };
    sample(); (button as HTMLButtonElement).click();
    for (let frame=0;frame<240 && root.dataset.descentPhase !== "combat";frame++) {
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())); sample();
    }
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())); sample();
    return {positions,sameActor,sameAvatar,phase:root.dataset.descentPhase};
  });
}

async function seed(page: Page,run=createDescent(12345,"browser-test")) {
  await page.addInitScript(({key,run})=>{
    if (!sessionStorage.getItem("descent-fixture")) {
      localStorage.setItem(key,JSON.stringify(run)); sessionStorage.setItem("descent-fixture","1");
    }
  },{key:DESCENT_SAVE_KEY,run});
  await page.goto("/play");
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase",phase(run));
}

test("a newcomer starts with the original kit and no wallet or RPC",async({page,isMobile})=>{
  const forbidden:string[]=[];
  page.on("request",r=>{ if (/somnia|thirdweb|walletconnect|eth_(call|send)/i.test(r.url()+String(r.postData()))) forbidden.push(r.url()); });
  await page.goto("/");
  await page.getByRole("link",{name:/Play The First Descent/}).click();
  await expect(page.getByRole("button",{name:/Start run/i})).toHaveCount(1);
  await expect(page.getByText("100 HP · 3 potions · no relic")).toBeVisible();
  await page.getByRole("button",{name:/Start run/i}).click();
  const started=await saved(page);
  expect({hp:started.game.hp,maxHp:started.game.maxHp,potions:started.game.potions,relic:started.game.equippedRelic}).toEqual({hp:100,maxHp:100,potions:3,relic:0});
  await expect(page.locator("[data-avatar-relic]")).toHaveCount(0);
  await expect(page.getByRole("region",{name:"Equipped relic"})).toHaveCount(0);
  const floor=page.getByRole("group",{name:/Room 1 floor/});
  await floor.scrollIntoViewIfNeeded();
  const box=(await floor.boundingBox())!, scale=Math.max(box.width/900,box.height/600);
  const x=box.x+(box.width-900*scale)/2+300*scale, y=box.y+(box.height-600*scale)/2+435*scale;
  if (isMobile) await page.touchscreen.tap(x,y); else await page.mouse.click(x,y);
  await expect(page.locator("[data-avatar-position]")).not.toHaveAttribute("data-avatar-position","420,496");
  expect((await saved(page)).turns).toBe(0);
  const approach=page.getByRole("button",{name:/Approach/});
  await expect(approach).toBeEnabled();
  const trace=await traceApproach(approach), points=trace.positions.map(roomPoint);
  expect(trace.phase).toBe("combat");
  expect(trace.sameActor).toBe(true);
  expect(trace.sameAvatar).toBe(true);
  expect(points.length,"approach should render at least one point between its start and destination").toBeGreaterThanOrEqual(3);
  expect(points.slice(1,-1).some(point=>distance(point,points[0])>1 && distance(point,points.at(-1)!)>1)).toBe(true);
  expect(forbidden).toEqual([]);
});

test("held WASD moves continuously, combines directions and stops on release or blur",async({page})=>{
  await seed(page);
  const actor=page.locator("[data-avatar-position]"), avatar=actor.locator(".dungeon-avatar"), art=actor.locator(".dungeon-avatar-art");
  const initial=await saved(page), start=await avatarPoint(page);
  expect(await page.evaluate(()=>document.activeElement?.closest("svg.dungeon-scene"))).toBeNull();

  // Walk across the entrance so this movement test cannot accidentally start
  // combat while assertions wait for frames on a slower browser.
  await page.keyboard.down("a");
  try {
    await expect.poll(async()=>(await avatarPoint(page)).x,{intervals:[16]}).toBeLessThan(start.x-10);
    const first=await avatarPoint(page);
    await expect.poll(async()=>(await avatarPoint(page)).x,{intervals:[16]}).toBeLessThan(first.x-10);

    const diagonalStart=await avatarPoint(page);
    await page.keyboard.down("w");
    await expect.poll(async()=>{
      const current=await avatarPoint(page);
      return diagonalStart.x-current.x>8 && diagonalStart.y-current.y>8;
    },{intervals:[16]}).toBe(true);
    await page.keyboard.up("w");

    const horizontalStart=await avatarPoint(page);
    await expect.poll(async()=>(await avatarPoint(page)).x,{intervals:[16]}).toBeLessThan(horizontalStart.x-8);
    const horizontalEnd=await avatarPoint(page);
    await page.waitForTimeout(120);
    expect(Math.abs((await avatarPoint(page)).y-horizontalEnd.y),"releasing W should leave only A moving").toBeLessThanOrEqual(2);
  } finally {
    await page.keyboard.up("a");
    await page.keyboard.up("w");
  }
  const released=await avatarPoint(page);
  await page.waitForTimeout(180);
  expect(distance(await avatarPoint(page),released),"keyup should stop movement without waiting for OS repeat").toBeLessThanOrEqual(2);

  await page.keyboard.down("d");
  try {
    await expect.poll(async()=>(await avatarPoint(page)).x,{intervals:[16]}).toBeGreaterThan(released.x+8);
    await page.evaluate(()=>window.dispatchEvent(new Event("blur")));
    await page.waitForTimeout(60);
    const blurred=await avatarPoint(page);
    await page.waitForTimeout(180);
    expect(distance(await avatarPoint(page),blurred),"window blur should clear held movement").toBeLessThanOrEqual(2);
  } finally { await page.keyboard.up("d"); }

  await expect(actor).toHaveAttribute("data-avatar-facing","right");
  const rightScale=await art.evaluate(element=>(element as SVGSVGElement).getScreenCTM()!.a);
  const beforeLeft=await avatarPoint(page);
  await page.keyboard.down("a");
  try { await expect.poll(async()=>(await avatarPoint(page)).x,{intervals:[16]}).toBeLessThan(beforeLeft.x-8); }
  finally { await page.keyboard.up("a"); }
  await expect(actor).toHaveAttribute("data-avatar-facing","left");
  const leftScale=await art.evaluate(element=>(element as SVGSVGElement).getScreenCTM()!.a);
  expect(leftScale*rightScale,"left and right facing should visually mirror the avatar").toBeLessThan(0);
  expect(await saved(page)).toEqual(initial);
  await expect(avatar).not.toHaveClass(/is-walking/);
});

test("walking up to the enemy starts combat and held Enter commits one selected turn",async({page})=>{
  const run=createDescent(12345,"walk-to-combat");
  await seed(page,run);
  await page.keyboard.down("w");
  try {
    await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","combat");
  } finally { await page.keyboard.up("w"); }
  expect(await saved(page)).toEqual(transition(run,"engage"));
  const before=await saved(page);
  const attack=page.getByRole("button",{name:/Attack/i});
  await expect(attack).toBeFocused();
  await page.keyboard.down("Enter");
  await expect.poll(async()=>(await saved(page)).revision).toBe(before.revision+1);
  await expect(page.getByRole("group",{name:"Combat actions"})).toHaveAttribute("aria-busy","false");
  const attacked=await saved(page);
  await page.keyboard.down("Enter");
  await page.waitForTimeout(350);
  expect(await saved(page),"a repeated keydown while Enter remains held must not attack twice").toEqual(attacked);
  await page.keyboard.up("Enter");
  for (const key of ["w","a","s","d"]) await page.keyboard.press(key);
  await page.waitForTimeout(180);
  expect(await saved(page),"WASD must never dispatch a battle action").toEqual(attacked);
  await page.reload();
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","combat");
  expect(await saved(page)).toEqual(attacked);
});

test("E approaches the enemy from page focus without focusing or clicking the floor",async({page})=>{
  const run=createDescent(2468,"keyboard-approach");
  await seed(page,run);
  expect(await page.evaluate(()=>document.activeElement?.closest("svg.dungeon-scene"))).toBeNull();
  await page.keyboard.press("e");
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","combat");
  expect(await saved(page)).toEqual(transition(run,"engage"));
});

test("the whole descent plays through doors, supplies, camp, boss and reward",async({page,isMobile},testInfo)=>{
  test.setTimeout(150_000);
  await seed(page);
  let run=await saved(page);
  const reloaded=new Set<number>();
  for (let n=0;n<180 && !["won","lost"].includes(phase(run));n++) {
    const currentPhase=phase(run), action=informedPolicy(run), expected=transition(run,action);
    const names={engage:/Approach/,enter:/Enter room/,"skip-loot":"Leave loot", collect:/Pick up loot/,attack:/Attack/i,storm:/Storm/i,potion:/Potion/i,claim:/Keep relic/,"claim-equip":/Equip relic/,"supply-bandage":/^Bandage/,"supply-potion":/^Potion/,"camp-rest":/^Rest/,"camp-potion":/^Potion/,"camp-weapon":/^Weapon \+1/,"camp-armor":/^Armor \+1/};
    const shopAction=action.startsWith("supply-") || action.startsWith("camp-");
    const safePotionAction=action === "potion" && (currentPhase === "loot" || currentPhase === "recovery");
    if (shopAction) await page.getByRole("button",{name:"Visit Kevin"}).click();
    const scope=shopAction ? page.locator(".descent-shop-dialog").getByRole("region",{name:"Kevin's shop"})
      : safePotionAction ? page.locator(".dungeon-recovery-controls:visible")
      : ["attack","storm","potion"].includes(action) ? page.getByRole("group",{name:"Combat actions"}) : page;
    if (currentPhase === "reward") await expect(page.getByRole("region",{name:"Boss relic reward"}).getByRole("button")).toHaveCount(2);
    if (action === "collect") {
      const floor=page.getByRole("group",{name:new RegExp(`Room ${run.game.roomsCleared} floor`)});
      await tapRoomPoint(page,floor,await renderedLootPoint(page),isMobile);
    } else await scope.getByRole("button",{name:names[action]}).click();
    await expect.poll(async()=>(await saved(page)).revision).toBe(expected.revision);
    expect(await saved(page)).toEqual(expected);
    if (shopAction) await page.getByRole("button",{name:"Close Kevin's shop"}).click();
    run=expected;
    if ([5,9,10].includes(run.game.roomsCleared) && !reloaded.has(run.game.roomsCleared)) {
      reloaded.add(run.game.roomsCleared); await page.reload();
      await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase",phase(run));
      expect(await saved(page)).toEqual(run);
    }
  }
  expect(phase(run)).toBe("won");
  await expect(page.getByRole("heading",{name:"You survived management."})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath("descent-finished.png"),fullPage:true});
});

test("random floor loot is credited automatically when keyboard or pointer movement reaches it",async({page,isMobile})=>{
  let run=createDescent(777,"loot-test");
  run=transition(run,"engage");
  while (phase(run) === "combat") run=transition(run,"attack");
  expect(phase(run)).toBe("loot");
  expect(run.pendingLoot).not.toBeNull();
  const before={gold:run.game.gold,potions:run.game.potions,weapon:run.game.weaponLevel,armor:run.game.armorLevel};
  await seed(page,run);
  await expect(page.getByRole("img",{name:/Loot on the floor/})).toBeVisible();
  await expect(page.getByRole("button",{name:/Enter room/})).toHaveCount(0);
  await expect(page.getByRole("button",{name:/Pick up loot|Leave loot/})).toHaveCount(0);
  await expect(page.getByRole("group",{name:/Room 1 floor/})).toHaveAttribute("aria-label",/E to use the door/);
  expect({gold:(await saved(page)).game.gold,potions:(await saved(page)).game.potions,weapon:(await saved(page)).game.weaponLevel,armor:(await saved(page)).game.armorLevel}).toEqual(before);

  const floor=page.getByRole("group",{name:/Room 1 floor/});
  const lootPoint=await stableRenderedLootPoint(page);
  expect(lootPoint.x).toBeGreaterThanOrEqual(170); expect(lootPoint.x).toBeLessThanOrEqual(733);
  expect(lootPoint.y).toBeGreaterThanOrEqual(194); expect(lootPoint.y).toBeLessThanOrEqual(505);
  expect(distance(lootPoint,{x:400,y:391}),"loot should require walking away from the combat anchor").toBeGreaterThan(32);
  await page.reload();
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","loot");
  expect(await stableRenderedLootPoint(page),"the run seed and room should reproduce the same presentation position").toEqual(lootPoint);

  if (isMobile) {
    await tapRoomPoint(page,floor,lootPoint,true);
    expect((await saved(page)).revision).toBe(run.revision);
  } else {
    const current=await avatarPoint(page), key=wasdToward(current,lootPoint);
    await page.keyboard.down(key);
    try { await expect.poll(async()=>distance(await avatarPoint(page),current)).toBeGreaterThan(10); }
    finally { await page.keyboard.up(key); }
    expect((await saved(page)).revision).toBe(run.revision);
    await walkToLootWithKeyboard(page,lootPoint);
  }
  await expect(page.locator("[data-avatar-position]")).not.toHaveAttribute("data-avatar-position","400,391");

  const collected=transition(run,"collect");
  await expect.poll(async()=>(await saved(page)).revision).toBe(collected.revision);
  expect(await saved(page)).toEqual(collected);
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","recovery");
  await expect(page.getByRole("button",{name:/Enter room 2/})).toHaveClass(/dungeon-enter-room/);
  const recoveryInventory=playerHud(page);
  await expect(recoveryInventory).toContainText(`${collected.game.hp}/${collected.game.maxHp}`);
  await expect(recoveryInventory).toContainText(`${collected.game.potions}/5`);
  await expect(recoveryInventory).toContainText(`Lv ${collected.game.weaponLevel} · +${collected.game.weaponLevel*2} damage`);
  await expect(recoveryInventory).toContainText(`Lv ${collected.game.armorLevel} · blocks up to ${collected.game.armorLevel}`);
  await expect(recoveryInventory).toContainText("ROOM 1");
  await expect(page.getByRole("button",{name:"Open relic collection"})).toHaveCount(0);
  const recoveryPotion=safePotion(page);
  await expect(recoveryPotion).toHaveAccessibleName(/Use potion/);
});

test("selected safe potion heals before and after WASD loot pickup without spending a turn",async({page})=>{
  const combat=transition(createDescent(199,"keyboard-safe-potion"),"engage");
  const loot=transition({...combat,game:{...combat.game,hp:40,monsterHp:1}},"attack");
  expect(phase(loot)).toBe("loot");
  await seed(page,loot);

  await safePotion(page).focus();
  await page.keyboard.press("Enter");
  const healedBeforePickup=transition(loot,"potion");
  await expect.poll(async()=>(await saved(page)).revision).toBe(healedBeforePickup.revision);
  expect(await saved(page)).toEqual(healedBeforePickup);
  expect(healedBeforePickup.pendingLoot).toEqual(loot.pendingLoot);
  expect(healedBeforePickup.turns).toBe(loot.turns);
  expect(healedBeforePickup.rngState).toBe(loot.rngState);

  const target=await stableRenderedLootPoint(page);
  await walkToLootWithKeyboard(page,target);
  const collected=transition(healedBeforePickup,"collect");
  await expect.poll(async()=>(await saved(page)).revision).toBe(collected.revision);
  expect(await saved(page)).toEqual(collected);
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","recovery");

  await safePotion(page).focus();
  await page.keyboard.press("Enter");
  const healedAfterPickup=transition(collected,"potion");
  await expect.poll(async()=>(await saved(page)).revision).toBe(healedAfterPickup.revision);
  expect(await saved(page)).toEqual(healedAfterPickup);
  expect(healedAfterPickup.turns).toBe(collected.turns);
  expect(healedAfterPickup.rngState).toBe(collected.rngState);
});

test("the safe potion below the room heals with loot waiting and the door can still leave that loot",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  const combat=transition(createDescent(99,"loot-inventory-potion"),"engage");
  const run=transition({...combat,game:{...combat.game,hp:40,monsterHp:1}},"attack");
  expect(phase(run)).toBe("loot");
  expect(run.pendingLoot).not.toBeNull();
  await seed(page,run);

  const inventory=playerHud(page);
  await expect(inventory).toContainText(`${run.game.hp}/${run.game.maxHp}`);
  await expect(inventory).toContainText(`${run.game.potions}/5`);
  await expect(inventory.getByRole("button",{name:/Use potion/})).toHaveCount(0);
  const potion=safePotion(page);
  await expect(potion).toBeVisible();
  await expect(potion).toContainText(`POTION · ${run.game.potions}/5`);
  await expect(potion).toContainText("+25 HP · No enemy retaliation");

  await potion.focus();
  await page.keyboard.press("Enter");
  const healed=transition(run,"potion");
  await expect.poll(async()=>(await saved(page)).revision).toBe(healed.revision);
  expect(await saved(page)).toEqual(healed);
  expect(healed.pendingLoot).toEqual(run.pendingLoot);
  expect(healed.rngState).toBe(run.rngState);
  expect(healed.turns).toBe(run.turns);
  await expect(inventory).toContainText(`${healed.game.hp}/${healed.game.maxHp}`);
  await expect(inventory).toContainText(`${healed.game.potions}/5`);
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","loot");
  await expect(page.getByRole("img",{name:/Loot on the floor/})).toBeVisible();
  await expect(potion).toBeEnabled();

  await page.keyboard.press("e");
  const entered=transition(healed,"enter");
  await expect.poll(async()=>(await saved(page)).revision).toBe(entered.revision);
  expect(await saved(page)).toEqual(entered);
  expect(entered.game.gold).toBe(healed.game.gold);
  expect(entered.game.potions).toBe(healed.game.potions);
  expect(entered.game.weaponLevel).toBe(healed.game.weaponLevel);
  expect(entered.game.armorLevel).toBe(healed.game.armorLevel);
});

test("the safe potion below the room stays discoverable but disabled at full health",async({page})=>{
  const combat=transition(createDescent(99,"full-inventory-potion"),"engage");
  const run=transition({...combat,game:{...combat.game,monsterHp:1}},"attack");
  expect(phase(run)).toBe("loot");
  expect(run.game.hp).toBe(run.game.maxHp);
  await seed(page,run);

  const inventory=playerHud(page);
  await expect(inventory).toContainText(`${run.game.hp}/${run.game.maxHp}`);
  await expect(inventory).toContainText(`${run.game.potions}/5`);
  await expect(inventory.getByRole("button",{name:/Use potion/})).toHaveCount(0);
  const potion=safePotion(page);
  await expect(potion).toHaveAccessibleName(/HP is already full/);
  await expect(potion).toBeVisible();
  await expect(potion).toBeDisabled();
  await expect(potion).toContainText(`POTION · ${run.game.potions}/5`);
  expect(await saved(page)).toEqual(run);
  await expect(page.getByRole("img",{name:/Loot on the floor/})).toBeVisible();
});

test("empty floor clicks move and retarget freely before and during combat without spending a turn",async({page,isMobile})=>{
  for(const combat of [false,true]) {
    const initial=createDescent(12345,`free-floor-${combat}`);
    const run=combat ? transition(initial,"engage") : initial;
    await seed(page,run);
    const floor=page.getByRole("group",{name:/Room 1 floor/});
    const before=await avatarPoint(page);
    await tapRoomPoint(page,floor,{x:450,y:430},isMobile);
    await expect.poll(async()=>distance(await avatarPoint(page),before)).toBeGreaterThan(1);
    await tapRoomPoint(page,floor,{x:400,y:470},isMobile);
    await expect.poll(async()=>distance(await avatarPoint(page),{x:400,y:470})).toBeLessThan(2);
    await expect(page.locator(".dungeon-avatar")).not.toHaveClass(/is-walking/);
    expect(await saved(page),"floor navigation does not consume HP, turns, rewards or RNG").toEqual(run);
    if (!combat) await expect(page.getByRole("button",{name:/Approach Grave Belle/})).toBeEnabled();
  }
});

test("opening a dialog cancels pointer walking and closing it does not resume the trip",async({page,isMobile})=>{
  const run=transition(createDescent(12345,"dialog-stops-pointer-walk"),"engage");
  await seed(page,run);
  const floor=page.getByRole("group",{name:/Room 1 floor/});
  const start=await avatarPoint(page);
  await tapRoomPoint(page,floor,{x:400,y:500},isMobile);
  await expect(page.locator(".dungeon-avatar")).toHaveClass(/is-walking/);
  await expect.poll(async()=>distance(await avatarPoint(page),start)).toBeGreaterThan(2);

  await page.getByRole("button",{name:"Open dungeon log"}).click();
  const dialog=page.getByRole("dialog",{name:"Dungeon log"});
  await expect(dialog).toBeVisible();
  await expect(page.locator(".dungeon-avatar")).not.toHaveClass(/is-walking/);
  const stopped=await avatarPoint(page);
  await page.waitForTimeout(250);
  expect(distance(await avatarPoint(page),stopped),"the pointer trip must stop behind the dialog").toBeLessThanOrEqual(2);

  await dialog.getByRole("button",{name:"Close dungeon log"}).click();
  await expect(dialog).not.toBeVisible();
  await page.waitForTimeout(250);
  expect(distance(await avatarPoint(page),stopped),"closing a dialog cannot revive the cancelled trip").toBeLessThanOrEqual(2);
  await expect(page.locator(".dungeon-avatar")).not.toHaveClass(/is-walking/);
  expect(await saved(page)).toEqual(run);
});

test("walking turns north and south, alternates legs and respects reduced motion",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  const run=transition(createDescent(12345,"avatar-walk"),"engage");
  await seed(page,run);
  const art=page.locator(".dungeon-avatar-art");
  await page.keyboard.down("s");
  try {
    await expect(art).toHaveAttribute("data-avatar-orientation","south");
    const front=art.locator('[data-avatar-part="front-leg"]');
    const back=art.locator('[data-avatar-part="back-leg"]');
    const first=await front.evaluate(element=>getComputedStyle(element).transform);
    await expect.poll(()=>front.evaluate(element=>getComputedStyle(element).transform)).not.toBe(first);
    expect(await front.evaluate(element=>getComputedStyle(element).transform))
      .not.toBe(await back.evaluate(element=>getComputedStyle(element).transform));
  } finally { await page.keyboard.up("s"); }
  await expect(art).toHaveAttribute("data-avatar-walking","false");
  await expect(art.locator('[data-avatar-part="front-leg"]')).toHaveCount(0);

  await page.emulateMedia({reducedMotion:"reduce"});
  await page.keyboard.down("w");
  try {
    await expect(art).toHaveAttribute("data-avatar-orientation","north");
    for (const part of ["front-leg","back-leg"]) {
      expect(await art.locator(`[data-avatar-part="${part}"]`).evaluate(element=>getComputedStyle(element).animationName)).toBe("none");
    }
  } finally { await page.keyboard.up("w"); }
  expect(await saved(page)).toEqual(run);
});

test("held W crosses the cleared doorway after healing and enters exactly one room",async({page})=>{
  const recovered=recoveryAtRoom(1);
  const run=transition(recovered,"potion");
  await seed(page,run);
  await expect(page.getByRole("button",{name:/Enter room 2/})).toBeEnabled();
  await page.keyboard.down("w");
  try {
    await expect(page.getByRole("group",{name:/Room 2 floor/})).toBeVisible();
    await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","explore");
    await page.waitForTimeout(250);
    expect(await saved(page)).toEqual(transition(run,"enter"));
  } finally { await page.keyboard.up("w"); }
});

test("Kevin is a reachable room figure in both merchant recoveries and opens the shop only on arrival",async({page})=>{
  const rooms=[5,9];
  for(const [index,room] of rooms.entries()) {
    const run=recoveryAtRoom(room);
    if(index === 0) await seed(page,run);
    else {
      await page.evaluate(({key,run})=>localStorage.setItem(key,JSON.stringify(run)),{key:DESCENT_SAVE_KEY,run});
      await page.reload();
      await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","recovery");
    }
    const floor=page.getByRole("group",{name:new RegExp(`Room ${room} floor`)});
    const kevin=page.getByRole("img",{name:"Quartermaster Kevin. Walk here to trade."});
    await expect(kevin).toBeVisible();
    await expect(kevin.locator("image").first()).toHaveAttribute("href","/characters/merchant-quartermaster-kevin.webp");
    await expect(kevin).toHaveAttribute("data-merchant-arrived","true",{timeout:7000});
    const merchant=roomPoint(await kevin.getAttribute("data-merchant-position"));
    const merchantFacing="right", avatarFacing="left";
    await expect(kevin).toHaveAttribute("data-merchant-facing",merchantFacing);
    expect(merchant.y,"Kevin parks near the north side in both rooms").toBeLessThan(300);
    const wagon=floor.locator('[data-merchant-part="wagon"]');
    await expect(wagon).toHaveAttribute("data-wagon-facing","right");
    const [wagonBox,figureBox]=await Promise.all([
      wagon.boundingBox(),
      kevin.boundingBox(),
    ]);
    expect(wagonBox!.x+wagonBox!.width/2,"the wagon is on Kevin's outer-left side")
      .toBeLessThan(figureBox!.x+figureBox!.width/2);
    const [floorBox,kevinBox]=await Promise.all([floor.boundingBox(),kevin.boundingBox()]);
    expect(kevinBox!.x).toBeGreaterThanOrEqual(floorBox!.x-1);
    expect(kevinBox!.x+kevinBox!.width).toBeLessThanOrEqual(floorBox!.x+floorBox!.width+1);
    expect(kevinBox!.x).toBeLessThan(floorBox!.x+floorBox!.width/2);
    expect(wagonBox!.x).toBeGreaterThanOrEqual(floorBox!.x-1);
    expect(wagonBox!.x+wagonBox!.width).toBeLessThanOrEqual(floorBox!.x+floorBox!.width+1);
    expect(wagonBox!.x-floorBox!.x,"the wagon parks against the visible left wall").toBeLessThanOrEqual(70);
    const shop=page.locator(".descent-shop-dialog").getByRole("region",{name:"Kevin's shop"});
    await expect(shop).not.toBeVisible();

    await floor.evaluate((element,target)=>{
      const floor=element as SVGSVGElement, matrix=floor.getScreenCTM();
      if(!matrix) throw new Error("Room floor has no screen transform");
      const init={bubbles:true,clientX:matrix.a*target.x+matrix.c*target.y+matrix.e,clientY:matrix.b*target.x+matrix.d*target.y+matrix.f,pointerId:1,isPrimary:true};
      floor.dispatchEvent(new PointerEvent("pointerdown",init));
      floor.dispatchEvent(new PointerEvent("pointerup",init));
    },{x:merchant.x+60,y:merchant.y});
    expect(await saved(page),"walking to Kevin does not spend gold or advance the run").toEqual(run);
    await expect(page.locator(".dungeon-avatar")).toHaveClass(/is-walking/);
    await expect(shop).not.toBeVisible();

    await expect(page.locator(".dungeon-avatar")).not.toHaveClass(/is-walking/);
    const arrived=await avatarPoint(page);
    expect(distance(arrived,merchant),"the avatar must stand beside the figure before trade opens").toBeLessThanOrEqual(64);
    expect(arrived.x > merchant.x,"the avatar approaches Kevin from inside the room").toBe(true);
    await expect(page.locator("[data-avatar-facing]")).toHaveAttribute("data-avatar-facing",avatarFacing);
    await expect(shop).toBeVisible();
    await expect(page.getByRole("button",{name:"Close Kevin's shop"})).toBeFocused();
    await page.getByRole("button",{name:"Close Kevin's shop"}).click();
    await page.keyboard.down("d");
    await expect.poll(async()=>(await avatarPoint(page)).x).toBeGreaterThan(arrived.x+12);
    await page.keyboard.up("d");
    expect(await saved(page)).toEqual(run);
  }
});

test("a door tap walks past visible loot and enters once when animation frames stall",async({page})=>{
  let run=transition(createDescent(159,"stalled-loot-exit"),"engage");
  while (phase(run) === "combat") run=transition(run,"attack");
  expect(phase(run)).toBe("loot");
  expect(run.pendingLoot).not.toBeNull();
  await seed(page,run);
  const floor=page.getByRole("group",{name:/Room 1 floor/});
  const lootPoint=await stableRenderedLootPoint(page);
  expect(distanceToSegment(lootPoint,{x:400,y:391},{x:450,y:92}),"fixture loot must lie on the direct door path at every supported viewport").toBeLessThanOrEqual(32);
  await expect(page.getByRole("img",{name:/Loot on the floor/})).toBeVisible();
  await expect(page.getByRole("button",{name:/Pick up loot|Leave loot|Enter room/})).toHaveCount(0);

  // Accept animation work without ever delivering a frame. The timer clock
  // must still walk through this seed's loot position to the door and commit
  // the explicit leave-on-arrival transition exactly once.
  await page.evaluate(()=>{
    const request=window.requestAnimationFrame, cancel=window.cancelAnimationFrame;
    let next=0;
    const frames=new Map<number,FrameRequestCallback>(), canceled:FrameRequestCallback[]=[];
    Object.assign(window,{
      requestAnimationFrame:(callback:FrameRequestCallback)=>{ const id=++next; frames.set(id,callback); return id; },
      cancelAnimationFrame:(id:number)=>{ const callback=frames.get(id); if(callback) canceled.push(callback); frames.delete(id); },
      __descentFrames:{count:()=>frames.size,fireCanceled:()=>{
        const callbacks=canceled.splice(0); for(const callback of callbacks) callback(performance.now()+10_000);
      },restore:()=>{
        window.requestAnimationFrame=request; window.cancelAnimationFrame=cancel;
      }},
    });
  });
  try {
    expect(await saved(page)).toEqual(run);
    await dispatchRoomPoint(floor,{x:450,y:65});
    await dispatchRoomPoint(floor,{x:450,y:65});
    expect(await saved(page),"tapping the door starts a walk without discarding the floor loot").toEqual(run);
    await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","loot");
    await expect(page.locator(".dungeon-avatar")).toHaveClass(/is-walking/);
    await page.waitForTimeout(650);
    expect((await avatarPoint(page)).y,"the fallback walk should already have passed the drop").toBeLessThan(lootPoint.y);
    expect(await saved(page),"passing within pickup range with door intent must preserve the loot").toEqual(run);
    await expect(page.getByRole("img",{name:/Loot on the floor/})).toBeVisible();
    const entered=transition(run,"enter");
    await expect.poll(async()=>(await saved(page)).revision).toBe(entered.revision);
    expect(await saved(page)).toEqual(entered);
    await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","explore");
    await expect(page.getByRole("group",{name:/Room 2 floor/})).toBeVisible();
    await expect(page.locator(".dungeon-avatar")).not.toHaveClass(/is-walking/);
    await page.evaluate(()=>{
      (window as Window & {__descentFrames?:{fireCanceled:()=>void}}).__descentFrames?.fireCanceled();
    });
    await page.waitForTimeout(400);
    expect(await saved(page),"the canceled first tap and stale clocks cannot enter twice").toEqual(entered);
    expect(await page.evaluate(()=>{
      return (window as Window & {__descentFrames?:{count:()=>number}}).__descentFrames?.count();
    })).toBe(0);
  } finally {
    await page.evaluate(()=>{
      const fixture=window as Window & {__descentFrames?:{restore:()=>void}};
      fixture.__descentFrames?.restore(); delete fixture.__descentFrames;
    });
  }
  await page.reload();
  expect(await saved(page)).toEqual(transition(run,"enter"));
});

test("retargeting a loot-room door walk leaves the drop and cannot advance the room",async({page})=>{
  let run=transition(createDescent(159,"cancel-loot-exit"),"engage");
  while (phase(run) === "combat") run=transition(run,"attack");
  expect(phase(run)).toBe("loot");
  expect(run.pendingLoot).not.toBeNull();
  await seed(page,run);
  await page.evaluate(()=>{
    const request=window.requestAnimationFrame, cancel=window.cancelAnimationFrame;
    let next=0;
    const live=new Map<number,FrameRequestCallback>(), canceled:FrameRequestCallback[]=[];
    Object.assign(window,{
      requestAnimationFrame:(callback:FrameRequestCallback)=>{ const id=++next; live.set(id,callback); return id; },
      cancelAnimationFrame:(id:number)=>{ const callback=live.get(id); if(callback) canceled.push(callback); live.delete(id); },
      __descentFrames:{restore:()=>{window.requestAnimationFrame=request;window.cancelAnimationFrame=cancel;},fireCanceled:()=>{
        const callbacks=canceled.splice(0); for(const callback of callbacks) callback(performance.now()+10_000);
      }},
    });
  });
  try {
    const floor=page.getByRole("group",{name:/Room 1 floor/});
    await dispatchRoomPoint(floor,{x:450,y:65});
    expect(await saved(page)).toEqual(run);
    await expect(page.locator(".dungeon-avatar")).toHaveClass(/is-walking/);
    await dispatchRoomPoint(floor,{x:450,y:435});
    await page.evaluate(()=>{
      (window as Window & {__descentFrames?:{fireCanceled:()=>void}}).__descentFrames?.fireCanceled();
    });
    await expect(page.locator(".dungeon-avatar")).not.toHaveClass(/is-walking/);
    await expect(page.locator("[data-avatar-position]")).toHaveAttribute("data-avatar-position","450,435");
    await page.waitForTimeout(1_400);
    expect(await saved(page),"neither the canceled frame nor fallback timer may discard loot or deliver the old door arrival").toEqual(run);
    await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","loot");
    await expect(page.getByRole("img",{name:/Loot on the floor/})).toBeVisible();
  } finally {
    await page.evaluate(()=>{
      const fixture=window as Window & {__descentFrames?:{restore:()=>void}};
      fixture.__descentFrames?.restore(); delete fixture.__descentFrames;
    });
  }
});

test("free movement, retargeting, approach and loot still finish without animation frames",async({page})=>{
  await seed(page,createDescent(777,"fallback-walk"));
  const initial=await saved(page);
  await page.evaluate(()=>{
    // Keep timers running; simulate a browser that accepts RAF but never paints.
    let frame=0;
    window.requestAnimationFrame=()=>++frame;
    window.cancelAnimationFrame=()=>{};
  });
  await page.keyboard.down("a");
  await expect.poll(async()=>(await avatarPoint(page)).x).toBeLessThan(420);
  await page.keyboard.up("a");
  await page.keyboard.down("d");
  await expect(page.locator("[data-avatar-facing]")).toHaveAttribute("data-avatar-facing","right");
  await expect.poll(async()=>(await avatarPoint(page)).x).toBeGreaterThan(400);
  await page.keyboard.up("d");
  await expect(page.locator(".dungeon-avatar")).not.toHaveClass(/is-walking/);
  expect(await saved(page)).toEqual(initial);
  await page.getByRole("button",{name:/Approach/}).evaluate((element:HTMLButtonElement)=>element.click());
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","combat");
  for(let hits=0;hits<12 && phase(await saved(page)) === "combat";hits++) {
    const attack=page.getByRole("button",{name:/ATTACK/i});
    await expect(attack).toBeEnabled();
    const before=await saved(page);
    await attack.evaluate((element:HTMLButtonElement)=>element.click());
    await expect.poll(async()=>(await saved(page)).revision).toBe(before.revision+1);
  }
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","loot");
  const killed=await saved(page);
  await expect(page.getByRole("button",{name:/Pick up loot/})).toBeEnabled();
  await page.getByRole("button",{name:/Pick up loot/}).evaluate((element:HTMLButtonElement)=>element.click());
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","recovery");
  const recovered=transition(killed,"collect");
  expect(await saved(page)).toEqual(recovered);
  const enter=page.getByRole("button",{name:/Enter room 2/});
  await expect(enter).toBeEnabled();
  await enter.evaluate((element:HTMLButtonElement)=>element.click());
  expect(await saved(page),"the fallback door walk must arrive before it advances").toEqual(recovered);
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","recovery");
  await expect(page.locator(".dungeon-avatar")).toHaveClass(/is-walking/);
  await expect(page.getByRole("group",{name:/Room 2 floor/})).toBeVisible();
  expect(await saved(page)).toEqual(transition(recovered,"enter"));
  // Reload restores the native frame scheduler and exact committed progress.
  const entered=await saved(page);
  await page.reload();
  expect(await saved(page)).toEqual(entered);
});

test("responsive room keeps compact combat controls in their active presentation",async({page,isMobile},testInfo)=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await seed(page,transition(createDescent(42,"layout"),"engage"));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  const scene=page.locator("[data-room-scene]");
  const box=await scene.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(300);
  if (isMobile) {
    const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight}));
    expect(box!.y).toBe(0); expect(box!.x).toBe(0);
    expect(Math.abs(box!.height-viewport.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(box!.width-viewport.width)).toBeLessThanOrEqual(1);
    expect(viewport.scroll).toBeLessThanOrEqual(viewport.height+1);
    await expect(scene.getByText("Room 1 / 10",{exact:true})).toBeVisible();
    const compactHud=scene.locator(".descent-mobile-top .practice-hud");
    await expect(compactHud).toBeInViewport();
    await expect(compactHud).toContainText("100/100");
    await expect(compactHud).toContainText("3/5");
    const gear=compactHud.getByRole("button",{name:"Gear details: weapon 0, armor 0"});
    await gear.click();
    const gearDialog=page.getByRole("dialog",{name:"Gear details"});
    await expect(gearDialog).toContainText("Weapon level 0: +0 damage");
    await gearDialog.getByRole("button",{name:"Close gear details"}).click();
    await page.getByText("Menu",{exact:true}).click();
    await expect(scene.getByRole("heading",{name:"Dungeon menu"})).toBeVisible();
    await page.getByText("Menu",{exact:true}).click();
  }
  const actions=page.getByRole("group",{name:"Combat actions"});
  await expect(actions).toHaveCount(1);
  await actions.scrollIntoViewIfNeeded();
  await expect(actions).toBeInViewport();
  await expect(actions.getByRole("progressbar",{name:"Player health"})).toBeVisible();
  await expect(actions.getByRole("button",{name:/POTION.*3\/5/})).toBeVisible();
  const enemyHealth=page.getByRole("progressbar",{name:"Enemy health",exact:true});
  await expect(enemyHealth).toBeVisible();
  await expect(enemyHealth).toHaveAttribute("aria-valuenow",String((await saved(page)).game.monsterHp));
  await expect(actions.locator(".practice-combat-vitals")).toContainText("ENEMY HP");
  await expect(actions.locator(".practice-combat-vitals")).toContainText(`${(await saved(page)).game.monsterHp}/${(await saved(page)).game.monsterMaxHp}`);
  if (isMobile) {
    await expect(scene.locator(".descent-enemy-status")).toBeInViewport();
    const size=await scene.locator(".descent-enemy-status-heading b").evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(15);
  } else {
    const status=page.locator(".descent-sidebar .descent-enemy-status");
    await expect(status).toBeVisible();
    await expect(status).toContainText("RETALIATION");
    await expect(status).toContainText("IF IT SURVIVES");
  }
  const stormBox=(await actions.getByRole("button",{name:/Storm/i}).boundingBox())!;
  const attackBox=(await actions.getByRole("button",{name:/Attack/i}).boundingBox())!;
  const potionBox=(await actions.getByRole("button",{name:/Potion/i}).boundingBox())!;
  expect(attackBox.x).toBeGreaterThan(stormBox.x);
  if (isMobile && (await page.evaluate(()=>innerHeight)) <= 700) {
    expect(potionBox.x).toBeGreaterThan(stormBox.x);
    expect(potionBox.x).toBeLessThan(attackBox.x);
    expect(Math.abs(attackBox.y-potionBox.y)).toBeLessThanOrEqual(1);
  } else {
    expect(potionBox.y).toBeGreaterThanOrEqual(stormBox.y+stormBox.height);
  }
  const dock=await actions.evaluate(element=>{
    const rect=element.getBoundingClientRect();
    const room=element.closest("[data-room-scene]")?.getBoundingClientRect();
    const enemy=element.closest(".descent-sidebar")?.querySelector(".descent-enemy-card")?.getBoundingClientRect();
    return {left:rect.left,width:rect.width,top:rect.top,bottom:rect.bottom,roomTop:room?.top,roomBottom:room?.bottom,
      enemyLeft:enemy?.left,enemyWidth:enemy?.width,enemyBottom:enemy?.bottom,inside:Boolean(element.closest(".dungeon-scene-overlay"))};
  });
  if (isMobile) {
    expect(dock.inside).toBe(true);
    expect(dock.top).toBeGreaterThanOrEqual(dock.roomTop!);
    expect(dock.bottom).toBeLessThanOrEqual(dock.roomBottom!+1);
  } else {
    expect(dock.inside).toBe(false);
    expect(Math.abs(dock.left-dock.enemyLeft!)).toBeLessThanOrEqual(1);
    expect(Math.abs(dock.width-dock.enemyWidth!)).toBeLessThanOrEqual(1);
    expect(dock.top).toBeGreaterThanOrEqual(dock.enemyBottom!);
  }
  for (const button of await actions.getByRole("button").all()) {
    await button.scrollIntoViewIfNeeded(); const b=await button.boundingBox();
    expect(b!.height).toBeGreaterThanOrEqual(44); expect(b!.width).toBeGreaterThanOrEqual(44);
  }
  const backgrounds=await page.evaluate(()=>{
    const descent=getComputedStyle(document.querySelector(".descent-shell")!).backgroundImage;
    const reference=document.createElement("main"); reference.className="practice-shell"; document.body.append(reference);
    const practice=getComputedStyle(reference).backgroundImage; reference.remove(); return {descent,practice};
  });
  expect(backgrounds.descent).toBe(backgrounds.practice);
  const scrollBefore=await page.evaluate(()=>scrollY);
  const floor=scene.locator("svg.dungeon-scene"), frameBeforeAttack=await floorFrame(floor);
  expectFloorScaleMatchesBox(frameBeforeAttack);
  await actions.getByRole("button",{name:/Attack/i}).click();
  await expect(actions).toHaveAttribute("aria-busy","true");
  expectStableFloor(frameBeforeAttack,await floorFrame(floor));
  await expect(actions).toHaveAttribute("aria-busy","false");
  expectStableFloor(frameBeforeAttack,await floorFrame(floor));
  expect(await page.evaluate(()=>scrollY)).toBe(scrollBefore);
  const afterAttack=await saved(page);
  await expect(enemyHealth).toHaveAttribute("aria-valuenow",String(afterAttack.game.monsterHp));
  await expect(actions.getByRole("status",{name:"Last combat exchange"})).toContainText(`TOOK ${afterAttack.game.lastMonsterDamage} HP`);
  await expect(actions.getByRole("status",{name:"Last combat exchange"})).toContainText(`${afterAttack.game.lastPlayerDamage} HP`);
  await page.getByRole("button",{name:"Open dungeon log"}).click();
  await expect(page.getByRole("dialog",{name:"Dungeon log"})).toBeVisible();
  await page.keyboard.press("k");
  expect(await saved(page)).toEqual(afterAttack);
  await page.getByRole("button",{name:"Close dungeon log"}).click();
  if (testInfo.project.name === "iphone-11-pro-webkit") {
    const beforeResize=await saved(page);
    for (const height of [812,635,568]) {
      await page.setViewportSize({width:375,height});
      await expect.poll(async()=>Math.round((await scene.boundingBox())!.height)).toBe(height);
      const resizedFrame=await floorFrame(floor);
      expectFloorScaleMatchesBox(resizedFrame);
      await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
      expectStableFloor(resizedFrame,await floorFrame(floor));
      const layout=await page.evaluate(()=>{
        const button=document.querySelector('.descent-practice-controls .practice-attack-action')!.getBoundingClientRect();
        return {bottom:button.bottom,scroll:document.documentElement.scrollHeight,height:innerHeight};
      });
      expect(layout.bottom).toBeLessThanOrEqual(height);
      expect(layout.scroll).toBeLessThanOrEqual(layout.height+1);
      expect(await saved(page)).toEqual(beforeResize);
    }
  }
  await page.screenshot({path:testInfo.outputPath("descent-combat.png"),fullPage:true});
});

test("unknown saves are preserved and denied storage still allows a session",async({page})=>{
  await page.addInitScript(key=>localStorage.setItem(key,'{"rules":"future"}'),DESCENT_SAVE_KEY);
  await page.goto("/play");
  await expect(page.getByText(/saved descent cannot be read/)).toBeVisible();
  expect(await page.evaluate(key=>localStorage.getItem(key),DESCENT_SAVE_KEY)).toBe('{"rules":"future"}');
  await page.addInitScript(()=>Object.defineProperty(window,"localStorage",{get:()=>{throw Error("Unavailable");}}));
  await page.reload();
  await page.getByRole("button",{name:/Start run/i}).click();
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","explore");
  await expect(page.getByRole("status").filter({hasText:/This run lasts for this visit only/})).toBeVisible();
});
