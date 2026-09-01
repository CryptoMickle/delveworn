"use client";

import {
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { activeDeployment } from "./chain-config";

const SESSION_RECORD_VERSION = 1;

export type SomniaSessionRecord = {
  version: typeof SESSION_RECORD_VERSION;
  ownerAddress: Address;
  smartAccountAddress: Address;
  sessionKeyAddress: Address;
  sessionPrivateKey: Hex;
  dungeonAddress: Address;
  expiresAt: number;
};

export function normalizeSomniaSessionRecord(
  record: SomniaSessionRecord
): SomniaSessionRecord {
  return {
    ...record,
    ownerAddress: getAddress(record.ownerAddress),
    smartAccountAddress: getAddress(record.smartAccountAddress),
    sessionKeyAddress: getAddress(record.sessionKeyAddress),
    dungeonAddress: getAddress(record.dungeonAddress),
  };
}

function isHexPrivateKey(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function somniaSessionStorageKey(ownerAddress: Address) {
  return `delveworn_${activeDeployment.key}_${activeDeployment.dungeonAddress.toLowerCase()}_${ownerAddress.toLowerCase()}_thirdweb_session_v${SESSION_RECORD_VERSION}`;
}

export function somniaSessionModeStorageKey(ownerAddress: Address) {
  return `delveworn_${activeDeployment.key}_${ownerAddress.toLowerCase()}_thirdweb_mode_v${SESSION_RECORD_VERSION}`;
}

export function readSomniaSessionRecord(
  ownerAddress: Address
): SomniaSessionRecord | null {
  const raw = localStorage.getItem(somniaSessionStorageKey(ownerAddress));

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SomniaSessionRecord>;

    if (
      parsed.version !== SESSION_RECORD_VERSION ||
      typeof parsed.ownerAddress !== "string" ||
      typeof parsed.smartAccountAddress !== "string" ||
      typeof parsed.sessionKeyAddress !== "string" ||
      !isHexPrivateKey(parsed.sessionPrivateKey) ||
      typeof parsed.dungeonAddress !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      throw new Error("Stored Somnia session has an invalid shape.");
    }

    const record = normalizeSomniaSessionRecord(
      parsed as SomniaSessionRecord
    );

    if (
      record.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase() ||
      record.dungeonAddress.toLowerCase() !==
        activeDeployment.dungeonAddress.toLowerCase() ||
      record.expiresAt <= Date.now()
    ) {
      clearSomniaSessionRecord(ownerAddress);
      return null;
    }

    return record;
  } catch {
    clearSomniaSessionRecord(ownerAddress);
    return null;
  }
}

export function writeSomniaSessionRecord(record: SomniaSessionRecord) {
  localStorage.setItem(
    somniaSessionStorageKey(record.ownerAddress),
    JSON.stringify(record)
  );
}

export function clearSomniaSessionRecord(ownerAddress: Address) {
  localStorage.removeItem(somniaSessionStorageKey(ownerAddress));
  sessionStorage.removeItem(somniaSessionModeStorageKey(ownerAddress));
}

export function setSomniaSessionMode(ownerAddress: Address, enabled: boolean) {
  const key = somniaSessionModeStorageKey(ownerAddress);

  if (enabled) {
    sessionStorage.setItem(key, "true");
  } else {
    sessionStorage.removeItem(key);
  }
}

export function wantsSomniaSessionMode(ownerAddress: Address) {
  return sessionStorage.getItem(somniaSessionModeStorageKey(ownerAddress)) === "true";
}
