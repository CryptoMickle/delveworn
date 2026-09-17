/**
 * A completion event can arrive late from an earlier same-kind action. The
 * current action resolves only after its request was observed or state changed.
 */
export function canResolveVrfState(
  pendingRequestId: bigint,
  sawPendingRequest: boolean,
  stateChanged: boolean
) {
  return pendingRequestId === BigInt(0) && (
    sawPendingRequest || stateChanged
  );
}

/** Canonical state distinguishes a landed call from a pre-submission failure. */
export function canonicalStateShowsSubmittedAction(
  pendingRequestId: bigint,
  stateChanged: boolean
) {
  return pendingRequestId > BigInt(0) || stateChanged;
}
