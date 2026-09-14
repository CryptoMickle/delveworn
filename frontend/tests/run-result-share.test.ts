import assert from "node:assert/strict";
import { test } from "node:test";
import { copyResultToClipboard } from "../app/run-result-share";

test("result copying preserves the caller's exact mode and evidence limitations", async () => {
  const result = "Delveworn · Onchain testnet\n13 rooms cleared\nConfirmed contract snapshot; this text is not proof.\nContract: https://example.test/address/123";
  const copied: string[] = [];
  const success = await copyResultToClipboard(result, () => ({ async writeText(value) { copied.push(value); } }));
  assert.equal(success, true);
  assert.deepEqual(copied, [result]);
});

test("clipboard getter failure and rejected write both select fallback without throwing", async () => {
  assert.equal(await copyResultToClipboard("Local result", () => { throw new DOMException("Blocked", "SecurityError"); }), false);
  assert.equal(await copyResultToClipboard("Local result", () => ({ async writeText() { throw new DOMException("Denied", "NotAllowedError"); } })), false);
});
