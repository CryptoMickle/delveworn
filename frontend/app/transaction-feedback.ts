/** Describe failures without suggesting an unconfirmed transaction can be cancelled. */
export function transactionFailureMessage(error: unknown, network: string): string {
  const seen = new Set<unknown>();
  let current = error;
  let message = "";
  for (let depth = 0; depth < 6 && current && typeof current === "object" && !seen.has(current); depth++) {
    seen.add(current);
    const item = current as { code?: unknown; message?: unknown; shortMessage?: unknown; cause?: unknown };
    if (item.code === 4001 || item.code === "ACTION_REJECTED") {
      return "Wallet request declined. No action was confirmed. You can try again when ready.";
    }
    message += ` ${typeof item.message === "string" ? item.message : ""} ${typeof item.shortMessage === "string" ? item.shortMessage : ""}`;
    current = item.cause;
  }
  if (/user rejected|user denied|request rejected/i.test(message)) return "Wallet request declined. No action was confirmed. You can try again when ready.";
  if (/insufficient funds/i.test(message)) return `Not enough testnet funds to send this action on ${network}. Check your wallet balance, then try again.`;
  if (/chain mismatch|wrong network|chain does not match/i.test(message)) return `Switch your wallet to ${network}, then try again.`;
  return `The action could not be confirmed. Check your wallet and connection to ${network}. Your displayed progress still comes from the contract.`;
}
