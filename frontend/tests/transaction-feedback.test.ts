import assert from "node:assert/strict";
import { test } from "node:test";
import { transactionFailureMessage } from "../app/transaction-feedback";

test("wrapped user rejection gets a retryable message without fake confirmation", () => {
  assert.match(transactionFailureMessage({ cause: { code: 4001 } }, "Somnia"), /declined.*No action was confirmed/);
});
test("insufficient funds and network mismatch have actionable copy", () => {
  assert.match(transactionFailureMessage({ message: "insufficient funds" }, "RISE"), /testnet funds.*RISE/);
  assert.match(transactionFailureMessage({ cause: { message: "chain mismatch" } }, "Somnia"), /Switch your wallet to Somnia/);
});
test("cyclic or untrusted error causes are bounded and never render raw markup", () => {
  const error: { message: string; cause?: unknown } = { message: "<script>secret rpc url</script>" };
  error.cause = error;
  assert.doesNotMatch(transactionFailureMessage(error, "Somnia"), /script|secret/);
});
