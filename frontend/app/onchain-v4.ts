import { keccak256, toHex, type AbiParameter, type Address } from "viem";
import type { LootType } from "./practice/engine";

export const V4_SESSION_FUNCTION_SIGNATURES = [
  "collectLoot()",
  "discardLoot()",
] as const;

export const V4_SNAPSHOT_FUNCTION_SIGNATURE = "frontendSnapshotV4(address)";

export const DUNGEON_CUSTOM_ERROR_ABI = [
  { inputs: [], name: "BossLootPending", type: "error" },
  { inputs: [], name: "GameNotActive", type: "error" },
  { inputs: [], name: "InvalidCoordinator", type: "error" },
  { inputs: [], name: "InvalidRarity", type: "error" },
  { inputs: [], name: "InvalidRelic", type: "error" },
  { inputs: [], name: "InvalidRelicOffer", type: "error" },
  { inputs: [], name: "InvalidRequest", type: "error" },
  { inputs: [], name: "InvalidRoom", type: "error" },
  { inputs: [], name: "LootActionUnavailable", type: "error" },
  { inputs: [], name: "NoPendingRandomness", type: "error" },
  { inputs: [], name: "OnlyCoordinator", type: "error" },
  { inputs: [], name: "RandomnessPending", type: "error" },
  { inputs: [], name: "RequestMismatch", type: "error" },
  { inputs: [], name: "UnknownRequest", type: "error" },
  { inputs: [], name: "VrfRequestNotTimedOut", type: "error" },
  { inputs: [], name: "WrongRandomNumberCount", type: "error" },
] as const;

export type V4LootAction = "collectLoot" | "discardLoot";

export const V4_SESSION_SIGNATURE_BY_ACTION: Readonly<Record<V4LootAction, typeof V4_SESSION_FUNCTION_SIGNATURES[number]>> = {
  collectLoot: "collectLoot()",
  discardLoot: "discardLoot()",
};

export type PendingRoomLootState = Readonly<{
  available: boolean;
  room: number;
  gold: number;
  lootType: LootType;
  lootAmount: number;
}>;

export const EMPTY_PENDING_ROOM_LOOT: PendingRoomLootState = {
  available: false,
  room: 0,
  gold: 0,
  lootType: 0,
  lootAmount: 0,
};

export const PENDING_ROOM_LOOT_ABI_PARAMETER = {
  name: "pendingLoot",
  type: "tuple",
  components: [
    { name: "available", type: "bool" },
    { name: "room", type: "uint256" },
    { name: "gold", type: "uint256" },
    { name: "lootType", type: "uint8" },
    { name: "lootAmount", type: "uint256" },
  ],
} as const;

/** Preserve the exact nested V3 tuple in FrontendSnapshotV4. */
export function createFrontendSnapshotV4AbiParameter<
  const Components extends readonly AbiParameter[]
>(frontendSnapshotV3Components: Components) {
  return {
    name: "snapshot",
    type: "tuple",
    components: [
      {
        name: "base",
        type: "tuple",
        components: frontendSnapshotV3Components,
      },
      PENDING_ROOM_LOOT_ABI_PARAMETER,
    ],
  } as const;
}

type FrontendSnapshotV4Input = Readonly<{
  base: Readonly<{
    base: unknown;
  }>;
  pendingLoot: Readonly<{
    available: unknown;
    room: unknown;
    gold: unknown;
    lootType: unknown;
    lootAmount: unknown;
  }>;
}>;

/** Keep the nested V3 base intact and normalize only the new V4 fields. */
export function parseFrontendSnapshotV4(snapshot: FrontendSnapshotV4Input) {
  const pending = snapshot.pendingLoot;
  return {
    baseSnapshot: snapshot.base.base,
    relicSnapshot: snapshot.base,
    pendingLoot: {
      available: Boolean(pending.available),
      room: Number(pending.room),
      gold: Number(pending.gold),
      lootType: Number(pending.lootType) as LootType,
      lootAmount: Number(pending.lootAmount),
    } satisfies PendingRoomLootState,
  };
}

export function potionInventoryWithPendingLoot(
  potions: number,
  pendingLoot: PendingRoomLootState
) {
  return potions + (
    pendingLoot.available && pendingLoot.lootType === 1
      ? pendingLoot.lootAmount
      : 0
  );
}

/** A receipt waiter may fail after inclusion, so always reconcile once. */
export async function executePendingLootAction<
  State extends Readonly<{ pendingLoot: Readonly<{ available: boolean }> }>
>
(
  send: () => Promise<unknown>,
  readCanonical: () => Promise<State>
) {
  let sendError: unknown;
  try {
    await send();
  } catch (error) {
    sendError = error;
  }

  try {
    const state = await readCanonical();
    if (!state.pendingLoot.available) return state;
  } catch (readError) {
    throw sendError ?? readError;
  }

  if (sendError) throw sendError;
  throw new Error("The loot settlement is not visible in confirmed state yet.");
}

export type SnapshotCapability = {
  supported: boolean | null;
  retryAfter: number;
};

export type SnapshotCapabilitiesBySource = Record<
  "realtime" | "canonical",
  SnapshotCapability
>;

export function snapshotCapabilityScope(chainId: number, address: Address) {
  return `${chainId}:${address.toLowerCase()}`;
}

export function scopedSnapshotCapabilities(
  cache: Map<string, SnapshotCapabilitiesBySource>,
  chainId: number,
  address: Address
) {
  const scope = snapshotCapabilityScope(chainId, address);
  const existing = cache.get(scope);
  if (existing) return existing;

  const capabilities: SnapshotCapabilitiesBySource = {
    realtime: { supported: null, retryAfter: 0 },
    canonical: { supported: null, retryAfter: 0 },
  };
  cache.set(scope, capabilities);
  return capabilities;
}

export function shouldProbeSnapshotCapability(
  capability: SnapshotCapability,
  now: number
) {
  return capability.supported !== false || now >= capability.retryAfter;
}

export function markSnapshotCapabilitySupported(capability: SnapshotCapability) {
  capability.supported = true;
  capability.retryAfter = 0;
}

/** Share a proven V4 selector across canonical and pending-block readers. */
export function inheritSnapshotCapabilityProof(
  capability: SnapshotCapability,
  peers: readonly SnapshotCapability[]
) {
  if (peers.some((peer) => peer.supported === true)) {
    markSnapshotCapabilitySupported(capability);
  }
}

type NestedError = Readonly<{
  name?: unknown;
  message?: unknown;
  cause?: unknown;
  raw?: unknown;
  reason?: unknown;
  signature?: unknown;
}>;

/** Match only execution evidence consistent with a missing selector. */
export function isMissingSnapshotSelectorError(error: unknown) {
  const seen = new Set<unknown>();
  let current = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const nested = current as NestedError;
    if (nested.name === "ContractFunctionZeroDataError") return true;
    if (
      nested.name === "ContractFunctionRevertedError" &&
      (nested.raw === undefined || nested.raw === "0x") &&
      // Some RPCs report an empty revert with this generic message. It is
      // only a candidate: the caller must still prove the selector absent.
      (!nested.reason || nested.reason === "execution reverted") &&
      !nested.signature
    ) {
      return true;
    }
    if (
      typeof nested.message === "string" &&
      /returned no data \("0x"\)|function selector was not recognized|no fallback function/i.test(
        nested.message
      )
    ) {
      return true;
    }
    current = nested.cause;
  }

  return false;
}

/** Solidity's direct function dispatcher uses PUSH4 before this selector. */
export function bytecodeAdvertisesFunction(
  bytecode: string | null | undefined,
  signature: string
) {
  if (!bytecode || bytecode === "0x") return false;
  const selector = selectorForSessionSignature(signature).slice(2);
  return bytecode.toLowerCase().includes(`63${selector}`);
}

/**
 * Fall back only after the call error and deployed dispatcher both prove the
 * selector absent. Every ambiguous failure stays failed so loot cannot vanish.
 */
export function handleSnapshotCapabilityFailure(
  capability: SnapshotCapability,
  now: number,
  retryMs: number,
  error: unknown,
  selectorDefinitelyAbsent: boolean
) {
  if (capability.supported === true || !selectorDefinitelyAbsent) {
    throw error;
  }
  capability.supported = false;
  capability.retryAfter = now + retryMs;
}

export function selectorForSessionSignature(signature: string) {
  return keccak256(toHex(signature)).slice(0, 10).toLowerCase();
}

type SessionCallPermission = Readonly<{
  to?: string;
  signature?: string;
}>;

export type SessionPermission = Readonly<{
  permissions?: Readonly<{
    calls?: readonly SessionCallPermission[];
  }>;
}>;

/** True only when the active RISE grant covers this target and selector. */
export function sessionPermissionAllows(
  permission: SessionPermission | null | undefined,
  target: Address,
  signature: string
) {
  const selector = selectorForSessionSignature(signature);
  const targetLower = target.toLowerCase();
  return Boolean(permission?.permissions?.calls?.some((call) => {
    const targetAllowed = !call.to || call.to.toLowerCase() === targetLower;
    if (!targetAllowed) return false;
    if (!call.signature) return true;
    const granted = call.signature.toLowerCase();
    return granted === selector || granted === signature.toLowerCase();
  }));
}
