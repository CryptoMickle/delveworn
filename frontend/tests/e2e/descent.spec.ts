import { expect, test, type Page } from "@playwright/test";
import { createDescent, phase, transition, type Descent } from "../../app/descent/model";
import { DESCENT_SAVE_KEY } from "../../app/descent/storage";
import { informedPolicy } from "../helpers/descent-policy";

const saved = (page: Page): Promise<Descent> => page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),DESCENT_SAVE_KEY);
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
  if (isMobile) await approach.tap(); else await approach.click();
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","combat");
  expect(forbidden).toEqual([]);
});

test("keyboard and floor input move the avatar; repeated combat input commits one turn",async({page})=>{
  await seed(page);
  const floor=page.getByRole("group",{name:/Room 1 floor/});
  await floor.focus(); await floor.press("ArrowLeft");
  await expect(page.locator("[data-avatar-position]")).not.toHaveAttribute("data-avatar-position","420,496");
  expect((await saved(page)).turns).toBe(0);
  await floor.press("e");
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","combat");
  await expect(page.getByRole("group",{name:"Combat actions"})).toHaveAttribute("aria-busy","false");
  const before=await saved(page);
  await page.getByRole("button",{name:/Attack/i}).evaluate((button:HTMLButtonElement)=>{button.click();button.click();button.click();});
  await expect.poll(async()=>(await saved(page)).turns).toBe(before.turns+1);
  await expect(page.getByRole("group",{name:"Combat actions"})).toHaveAttribute("aria-busy","false");
  expect(await saved(page)).toEqual(transition(before,"attack"));
  await page.reload();
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","combat");
  expect(await saved(page)).toEqual(transition(before,"attack"));
});

test("the whole descent plays through doors, supplies, camp, boss and reward",async({page,isMobile},testInfo)=>{
  test.setTimeout(150_000);
  await seed(page);
  let run=await saved(page);
  const reloaded=new Set<number>();
  for (let n=0;n<180 && !["won","lost"].includes(phase(run));n++) {
    const currentPhase=phase(run), action=informedPolicy(run), expected=transition(run,action);
    const names={engage:/Approach/,enter:/Walk to room/,collect:/Pick up loot/,attack:/Attack/i,storm:/Storm/i,potion:/Potion/i,claim:/Keep relic/,"claim-equip":/Equip relic/,"supply-bandage":/^Bandage/,"supply-potion":/^Potion/,"camp-rest":/^Rest/,"camp-potion":/^Potion/,"camp-weapon":/^Weapon \+1/,"camp-armor":/^Armor \+1/};
    const shopAction=action.startsWith("supply-") || action.startsWith("camp-");
    if (isMobile && shopAction) await page.getByRole("button",{name:"Visit Kevin"}).click();
    const scope=shopAction ? page.getByRole("region",{name:"Kevin's shop"})
      : action === "potion" && currentPhase === "recovery" ? page.locator(isMobile ? ".descent-mobile-health" : ".descent-recovery-potion")
      : ["attack","storm","potion"].includes(action) ? page.getByRole("group",{name:"Combat actions"}) : page;
    if (currentPhase === "reward") await expect(page.getByRole("region",{name:"Boss relic reward"}).getByRole("button")).toHaveCount(2);
    await scope.getByRole("button",{name:names[action]}).click();
    await expect.poll(async()=>(await saved(page)).revision).toBe(expected.revision);
    expect(await saved(page)).toEqual(expected);
    if (isMobile && shopAction) await page.getByRole("button",{name:"Close Kevin's shop"}).click();
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

test("loot is credited only after the avatar reaches it, and the door routes to pickup first",async({page,isMobile})=>{
  let run=createDescent(777,"loot-test");
  run=transition(run,"engage");
  while (phase(run) === "combat") run=transition(run,"attack");
  expect(phase(run)).toBe("loot");
  expect(run.pendingLoot).not.toBeNull();
  const before={gold:run.game.gold,potions:run.game.potions,weapon:run.game.weaponLevel,armor:run.game.armorLevel};
  await seed(page,run);
  await expect(page.getByRole("img",{name:/Loot on the floor/})).toBeVisible();
  await expect(page.getByRole("button",{name:/Walk to room/})).toHaveCount(0);
  expect({gold:(await saved(page)).game.gold,potions:(await saved(page)).game.potions,weapon:(await saved(page)).game.weaponLevel,armor:(await saved(page)).game.armorLevel}).toEqual(before);

  const floor=page.getByRole("group",{name:/Room 1 floor/});
  const box=(await floor.boundingBox())!, scale=Math.max(box.width/900,box.height/600);
  const x=box.x+(box.width-900*scale)/2+450*scale, y=box.y+(box.height-600*scale)/2+90*scale;
  if (isMobile) await page.touchscreen.tap(x,y); else await page.mouse.click(x,y);
  await expect(page.locator("[data-avatar-position]")).not.toHaveAttribute("data-avatar-position","400,391");
  expect((await saved(page)).revision).toBe(run.revision);

  const collected=transition(run,"collect");
  await expect.poll(async()=>(await saved(page)).revision).toBe(collected.revision);
  expect(await saved(page)).toEqual(collected);
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","recovery");
  await expect(page.getByRole("button",{name:/Walk to room 2/})).toBeVisible();
});

test("responsive room keeps compact combat controls inside the scene",async({page,isMobile},testInfo)=>{
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
    await expect(scene.locator(".descent-mobile-inventory")).toBeInViewport();
    await page.getByText("Menu",{exact:true}).click();
    await expect(scene.getByRole("heading",{name:"Dungeon menu"})).toBeVisible();
    await page.getByText("Menu",{exact:true}).click();
  }
  const actions=page.getByRole("group",{name:"Combat actions"});
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
  const dock=await actions.evaluate(element=>{const rect=element.getBoundingClientRect(),room=element.closest("[data-room-scene]")!.getBoundingClientRect();return {height:rect.height,top:rect.top,bottom:rect.bottom,roomTop:room.top,roomBottom:room.bottom,inside:Boolean(element.closest(".dungeon-scene-overlay"))};});
  expect(dock.inside).toBe(true);
  if (isMobile) { expect(dock.top).toBeGreaterThanOrEqual(dock.roomTop); expect(dock.bottom).toBeLessThanOrEqual(dock.roomBottom+1); }
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
  await actions.getByRole("button",{name:/Attack/i}).click();
  await expect(actions).toHaveAttribute("aria-busy","false");
  expect(await page.evaluate(()=>scrollY)).toBe(scrollBefore);
  const afterAttack=await saved(page);
  await expect(enemyHealth).toHaveAttribute("aria-valuenow",String(afterAttack.game.monsterHp));
  await expect(actions.getByRole("status",{name:"Last combat exchange"})).toContainText(`TOOK ${afterAttack.game.lastMonsterDamage} HP`);
  await expect(actions.getByRole("status",{name:"Last combat exchange"})).toContainText(`${afterAttack.game.lastPlayerDamage} HP`);
  await page.getByRole("button",{name:"Open dungeon log"}).click();
  await expect(page.getByRole("dialog",{name:"Dungeon log"})).toBeVisible();
  await page.keyboard.press("1");
  expect(await saved(page)).toEqual(afterAttack);
  await page.getByRole("button",{name:"Close dungeon log"}).click();
  if (testInfo.project.name === "iphone-11-pro-webkit") {
    const beforeResize=await saved(page);
    for (const height of [812,635,568]) {
      await page.setViewportSize({width:375,height});
      await expect.poll(async()=>Math.round((await scene.boundingBox())!.height)).toBe(height);
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
