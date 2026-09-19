"use client";

export type OnchainWalletControlsProps = {
  mode: "standard" | "somnia-session" | "rise-session";
  supportsSomniaSession: boolean;
  busy: boolean;
  leaderboardHref?: string;
  onEnableSomniaSession: () => void;
  onDisconnect: () => void;
  onRevoke: () => void;
};

export function OnchainWalletControls({
  mode,
  supportsSomniaSession,
  busy,
  leaderboardHref,
  onEnableSomniaSession,
  onDisconnect,
  onRevoke,
}: OnchainWalletControlsProps) {
  const sessionActive = mode !== "standard";
  const canEnableSomnia = mode === "standard" && supportsSomniaSession;
  const status = mode === "somnia-session"
    ? "POPUP-FREE PLAY ACTIVE"
    : mode === "rise-session"
      ? "INSTANT PLAY ACTIVE"
      : "METAMASK · STANDARD PLAY";

  function whenReady(action: () => void) {
    if (!busy) action();
  }

  return (
    <section
      className="onchain-wallet-controls"
      data-wallet-controls
      data-mode={mode}
      aria-label="Wallet and play mode"
    >
      <p className="onchain-wallet-status">{status}</p>
      <div className="onchain-wallet-actions">
        {canEnableSomnia && (
          <button
            type="button"
            className="onchain-wallet-enable"
            disabled={busy}
            onClick={() => whenReady(onEnableSomniaSession)}
          >
            USE POPUP-FREE PLAY
          </button>
        )}
        {sessionActive && (
          <button type="button" disabled={busy} onClick={() => whenReady(onRevoke)}>
            Revoke session
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => whenReady(onDisconnect)}>
          Disconnect
        </button>
        {leaderboardHref && <a href={leaderboardHref}>Your rank</a>}
      </div>
      <p className="onchain-wallet-note">
        {canEnableSomnia
          ? "Your current run stays onchain. Popup-free play uses a separate player; your MetaMask progress is kept."
          : sessionActive
            ? "Disconnect keeps your onchain progress. Revoke ends this temporary session."
            : "Each action needs wallet confirmation. Disconnect keeps your onchain progress."}
      </p>
      {busy && (
        <p className="onchain-wallet-waiting" role="status">
          Waiting for the current action. Wallet controls unlock after confirmation.
        </p>
      )}
    </section>
  );
}
