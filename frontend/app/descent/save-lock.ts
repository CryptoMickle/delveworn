import { DESCENT_SAVE_KEY } from "./storage";

export type SaveWriteResult = "saved" | "conflict" | "unavailable";
export type ExclusiveSaveResult = SaveWriteResult | "busy";

export type SaveLocks = {
  request: (
    name: string,
    options: { ifAvailable: true },
    callback: (lock: unknown | null) => ExclusiveSaveResult,
  ) => Promise<ExclusiveSaveResult>;
};

function browserLocks(): SaveLocks | null {
  if (typeof navigator === "undefined" || !navigator.locks) return null;
  return {
    request: (name, options, callback) => navigator.locks.request(name, options, callback),
  };
}

/** A save never waits behind a suspended tab. The caller can safely retry when
 * the shared lock is busy because the write callback has not run. */
export async function exclusiveSave(
  write: () => SaveWriteResult,
  locks: SaveLocks | null = browserLocks(),
): Promise<ExclusiveSaveResult> {
  try {
    if (!locks) return write();
    return await locks.request(
      DESCENT_SAVE_KEY,
      { ifAvailable: true },
      lock => lock ? write() : "busy",
    );
  } catch {
    return "unavailable";
  }
}
