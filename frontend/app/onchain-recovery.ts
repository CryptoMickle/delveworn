type ErrorLike = Readonly<{
  code?: unknown;
  name?: unknown;
  message?: unknown;
  cause?: unknown;
}>;

/** Only an explicit wallet rejection proves that no transaction was sent. */
export function isExplicitWalletRejection(error: unknown) {
  const seen = new Set<unknown>();
  let current = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const nested = current as ErrorLike;
    if (nested.code === 4001 || nested.name === "UserRejectedRequestError") {
      return true;
    }
    if (
      typeof nested.message === "string" &&
      /user (?:rejected|denied|cancelled)|rejected by (?:the )?user/i.test(
        nested.message
      )
    ) {
      return true;
    }
    current = nested.cause;
  }

  return false;
}

export async function pollForCanonicalRecovery<State>({
  readCanonical,
  isRecovered,
  wait,
  now,
  deadline,
  isActive = () => true,
  onReadError,
}: Readonly<{
  readCanonical: () => Promise<State>;
  isRecovered: (state: State) => boolean;
  wait: () => Promise<unknown>;
  now: () => number;
  deadline: number;
  isActive?: () => boolean;
  onReadError?: (error: unknown) => void;
}>) {
  while (isActive() && now() < deadline) {
    await wait();
    if (!isActive()) return null;
    try {
      const state = await readCanonical();
      if (!isActive()) return null;
      if (isRecovered(state)) return state;
    } catch (error) {
      onReadError?.(error);
    }
  }
  return null;
}
