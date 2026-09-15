export type WalletView = Readonly<{
  owner: string;
  mode: "standard" | "somnia-session";
}>;

/** A new selection invalidates unfinished reads and restores from the previous view. */
export function createWalletViewGuard() {
  let current: WalletView | null = null;
  return {
    select(owner: string, mode: WalletView["mode"]): WalletView {
      current = Object.freeze({ owner: owner.toLowerCase(), mode });
      return current;
    },
    capture() { return current; },
    isCurrent(view: WalletView | null) { return view !== null && view === current; },
    clear() { current = null; },
  };
}
