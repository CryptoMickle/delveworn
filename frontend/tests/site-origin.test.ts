import assert from "node:assert/strict";
import test from "node:test";
import { getSiteOrigin, SITE_ORIGIN, siteUrl } from "../app/site-origin";
import { practiceShareText } from "../app/practice/feedback";
import { EMPTY_GAME } from "../app/practice/engine";

test("RISE defaults to the new domain while Somnia keeps its separate canonical origin", () => {
  assert.equal(getSiteOrigin(undefined), "https://delveworn.app");
  assert.equal(getSiteOrigin("riseTestnet"), "https://delveworn.app");
  assert.equal(getSiteOrigin("somniaShannon"), "https://delveworn-somnia.vercel.app");
});

test("an explicit public site URL is normalized and invalid non-web origins fail", () => {
  assert.equal(getSiteOrigin("somniaShannon", "https://delveworn.app"), "https://delveworn.app");
  assert.equal(getSiteOrigin("riseTestnet", " https://preview.example.test/path/?query=1 "), "https://preview.example.test");
  assert.equal(getSiteOrigin("riseTestnet", "http://localhost:3100/"), "http://localhost:3100");
  assert.throws(() => getSiteOrigin("riseTestnet", "javascript:alert(1)"), /HTTP or HTTPS/);
  assert.throws(() => getSiteOrigin("riseTestnet", "not-a-url"));
});

test("shared Practice results point at the configured canonical deployment", () => {
  assert.equal(siteUrl("/onchain"), `${SITE_ORIGIN}/onchain`);
  assert.match(practiceShareText(EMPTY_GAME), /Browser-only simulation/);
  assert.ok(practiceShareText(EMPTY_GAME).endsWith(`${SITE_ORIGIN}/practice`));
});
