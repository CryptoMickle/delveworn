import { expect, test, type Page } from "@playwright/test";
import { createDescent, phase, transition, type Descent } from "../../app/descent/model";
import { DESCENT_SAVE_KEY } from "../../app/descent/storage";
import { informedPolicy } from "../helpers/descent-policy";

const saved = (page: Page): Promise<Descent> => page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),DESCENT_SAVE_KEY);
async function seed(page: Page,run=createDescent("warden",12345,"browser-test")) {
  await page.addInitScript(({key,run})=>{
    if (!sessionStorage.getItem("descent-fixture")) {
      localStorage.setItem(key,JSON.stringify(run)); sessionStorage.setItem("descent-fixture","1");
    }
  },{key:DESCENT_SAVE_KEY,run});
  await page.goto("/play");
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase",phase(run));
}

test("a newcomer can choose a visible relic and start without wallet or RPC",async({page,isMobile})=>{
  const forbidden:string[]=[];
  page.on("request",r=>{ if (/somnia|thirdweb|walletconnect|eth_(call|send)/i.test(r.url()+String(r.postData()))) forbidden.push(r.url()); });
  await page.goto("/");
  await page.getByRole("link",{name:/Play The First Descent/}).click();
  await page.getByRole("button",{name:/Enter as Stormcaller/}).click();
  await expect(page.locator("[data-avatar-relic]")).toHaveAttribute("data-avatar-relic","6");
  await expect(page.getByRole("region",{name:"Equipped relic"})).toContainText("Stormglass");
  expect((await saved(page)).game.equippedRelic).toBe(6);
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
  await page.getByRole("button",{name:/Attack/}).evaluate((button:HTMLButtonElement)=>{button.click();button.click();button.click();});
  await expect.poll(async()=>(await saved(page)).turns).toBe(before.turns+1);
  await expect(page.getByRole("group",{name:"Combat actions"})).toHaveAttribute("aria-busy","false");
  expect(await saved(page)).toEqual(transition(before,"attack"));
  await page.reload();
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","combat");
  expect(await saved(page)).toEqual(transition(before,"attack"));
});

test("the whole descent plays through doors, supplies, camp, boss and reward",async({page},testInfo)=>{
  test.setTimeout(150_000);
  await seed(page);
  let run=await saved(page);
  const reloaded=new Set<number>();
  for (let n=0;n<180 && !["won","lost"].includes(phase(run));n++) {
    const action=informedPolicy(run), expected=transition(run,action);
    const names={engage:/Approach/,enter:/Walk to room/,attack:/Attack/,storm:/Storm/,potion:/Potion/,claim:/Collect relic/,"supply-bandage":/^Bandage/,"supply-potion":/^Potion/,"camp-rest":/^Rest/,"camp-potion":/^Potion/,"camp-weapon":/^Weapon \+1/,"camp-armor":/^Armor \+1/};
    const scope=action.includes("-") ? page.getByRole("region",{name:"Kevin's shop"}) : ["attack","storm","potion"].includes(action) ? page.getByRole("group",{name:"Combat actions"}) : page;
    await scope.getByRole("button",{name:names[action]}).click();
    await expect.poll(async()=>(await saved(page)).revision).toBe(expected.revision);
    expect(await saved(page)).toEqual(expected);
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

test("responsive room, controls and intention remain readable with reduced motion",async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await seed(page,transition(createDescent("stormcaller",42,"layout"),"engage"));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  const scene=page.locator("[data-room-scene]");
  const box=await scene.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(300);
  for (const button of await page.getByRole("group",{name:"Combat actions"}).getByRole("button").all()) {
    await button.scrollIntoViewIfNeeded(); const b=await button.boundingBox();
    expect(b!.height).toBeGreaterThanOrEqual(44); expect(b!.width).toBeGreaterThanOrEqual(44);
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
  await page.getByRole("button",{name:/Enter as Warden/}).click();
  await expect(page.locator("[data-descent-phase]")).toHaveAttribute("data-descent-phase","explore");
  await expect(page.getByText(/This run lasts for this visit only/)).toBeVisible();
});
