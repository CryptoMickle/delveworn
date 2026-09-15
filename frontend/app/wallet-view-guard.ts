export type WalletView = Readonly<{
  owner: string;
  mode: "standard" | "somnia-session";
  generation: number;
}>;

/** A new selection invalidates unfinished reads and restores from the previous view. */
export function createWalletViewGuard() {
  let current: WalletView | null = null;
  let generation = 0;
  return {
    select(owner: string, mode: WalletView["mode"]): WalletView {
      current = Object.freeze({ owner: owner.toLowerCase(), mode, generation: ++generation });
      return current;
    },
    capture() { return current; },
    isCurrent(view: WalletView | null) { return view !== null && view === current; },
    clear() { current = null; },
  };
}
