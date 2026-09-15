import assert from "node:assert/strict";
import test from "node:test";
import { onchainMetadataCopy, somniaTimingCopy } from "../app/deployment-copy";
import { DEFAULT_PUBLIC_DEPLOYMENT, isSomniaDeployment } from "../app/deployment";

test("Somnia is the public default while RISE remains an explicit legacy selection", () => {
  assert.equal(DEFAULT_PUBLIC_DEPLOYMENT, "somniaShannon");
  assert.equal(isSomniaDeployment(undefined), true);
  assert.equal(isSomniaDeployment("somniaShannon"), true);
  assert.equal(isSomniaDeployment("riseTestnet"), false);
});

test("Somnia standard play describes MetaMask approval without sponsored or popup-free promises", () => {
  const copy = onchainMetadataCopy("somniaShannon", false);
  assert.match(copy.description, /Somnia Shannon Testnet/);
  assert.match(copy.description, /MetaMask-confirmed actions/);
  assert.doesNotMatch(copy.description, /sponsor|popup-free|gasless/i);
  const details = somniaTimingCopy(false);
  assert.match(details.heading, /TRANSACTIONS \+ VRF/);
  assert.match(details.description, /MetaMask confirms each action/);
  assert.doesNotMatch(details.description, /Thirdweb|bundler|sponsor|popup-free/i);
  assert.deepEqual(onchainMetadataCopy(undefined, false), copy);
});

test("Somnia session copy retains sponsored metadata and the active session's bundler details", () => {
  assert.match(onchainMetadataCopy("somniaShannon", true).description, /popup-free sponsored actions/);
  assert.match(somniaTimingCopy(true).heading, /BUNDLER \+ VRF/);
  assert.match(somniaTimingCopy(true).description, /Thirdweb's ERC-4337 bundler/);
});

test("the separate RISE build keeps its existing title and wallet-signed description", () => {
  const expected = {
    title: "Delveworn · Onchain Dungeon",
    description: "A fully onchain dungeon crawler with wallet-signed actions, verifiable randomness and contract-backed progress.",
  };
  assert.deepEqual(onchainMetadataCopy("riseTestnet", false), expected);
  assert.deepEqual(onchainMetadataCopy("riseTestnet", true), expected);
});
