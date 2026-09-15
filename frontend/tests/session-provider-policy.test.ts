import assert from "node:assert/strict";
import test from "node:test";
import type * as ChainConfig from "../app/chain-config";
import type * as Policy from "../app/session-provider-policy";
import { loadClientModule } from "./helpers/client-module";

function deployment(env: Record<string, string> = {}) {
  const config = loadClientModule<typeof ChainConfig>("chain-config", {}, {
    process: { env: { NEXT_PUBLIC_DEPLOYMENT: "somniaShannon", ...env } },
  }).module;
  const policy = loadClientModule<typeof Policy>("session-provider-policy", { "./chain-config": config }).module;
  return { config, policy };
}

test("Shannon requires explicit activation and a public Thirdweb client ID for sponsored session keys", () => {
  for (const value of [undefined, "false", "TRUE", "1"]) {
    const { config, policy } = deployment(value ? { NEXT_PUBLIC_SOMNIA_SESSION_KEYS_ENABLED: value } : {});
    assert.equal(config.activeDeployment.wallet.sessionKeys, false);
    assert.equal(config.activeDeployment.wallet.gaslessTransactions, false);
    assert.equal(policy.supportsThirdwebSessionKeys(), false);
    assert.equal(policy.supportsInstantPlay(), false);
    assert.equal(policy.isMetaMaskConnector({ id: "metaMaskSDK" }), true);
  }
  assert.throws(() => deployment({ NEXT_PUBLIC_SOMNIA_SESSION_KEYS_ENABLED: "true" }), /THIRDWEB_CLIENT_ID is required/);
  const { config, policy } = deployment({
    NEXT_PUBLIC_SOMNIA_SESSION_KEYS_ENABLED: "true", NEXT_PUBLIC_THIRDWEB_CLIENT_ID: "synthetic-public-test-client",
  });
  assert.equal(config.activeDeployment.chain.id, 50312);
  assert.equal(config.activeDeployment.wallet.gaslessTransactions, true);
  assert.equal(policy.activeInstantPlayProvider(), "thirdweb-erc4337");
  assert.equal(policy.supportsThirdwebSessionKeys(), true);
  assert.equal(policy.supportsInstantPlay(), true);
  assert.equal(policy.isRiseWalletConnector({ id: "com.risechain.wallet" }), false);
});

test("activating Shannon does not change the separate RISE provider or its wallet policy", () => {
  const { config, policy } = deployment({
    NEXT_PUBLIC_DEPLOYMENT: "riseTestnet",
    NEXT_PUBLIC_RISE_TESTNET_DUNGEON_ADDRESS: "0x1111111111111111111111111111111111111111",
    NEXT_PUBLIC_SOMNIA_SESSION_KEYS_ENABLED: "true", NEXT_PUBLIC_THIRDWEB_CLIENT_ID: "synthetic-public-test-client",
  });
  assert.equal(config.activeDeployment.chain.id, 11155931);
  assert.equal(policy.activeInstantPlayProvider(), "rise-wallet");
  assert.equal(policy.supportsThirdwebSessionKeys(), false);
  assert.equal(policy.isRiseWalletConnector({ id: "com.risechain.wallet" }), true);
  assert.equal(config.activeDeployment.wallet.gaslessTransactions, false);
});
