import assert from "node:assert/strict";
import test from "node:test";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OnchainWalletControls, type OnchainWalletControlsProps } from "../app/onchain-wallet-controls";

type Button = ReactElement<{ children?: ReactNode; disabled?: boolean; onClick: () => void }>;
function buttons(node: ReactNode): Button[] {
  const found: Button[] = [];
  Children.forEach(node, child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;
    if (child.type === "button") found.push(child as Button);
    else found.push(...buttons(child.props.children));
  });
  return found;
}

function controls(overrides: Partial<OnchainWalletControlsProps> = {}) {
  const called: string[] = [];
  const props: OnchainWalletControlsProps = {
    mode: "standard", supportsSomniaSession: true, busy: false,
    onEnableSomniaSession: () => called.push("session"),
    onDisconnect: () => called.push("disconnect"),
    onRevoke: () => called.push("revoke"),
    ...overrides,
  };
  const element = OnchainWalletControls(props);
  return { called, buttons: buttons(element), markup: renderToStaticMarkup(element) };
}

test("a connected standard player can choose popup-free play with explicit progress-preservation copy", () => {
  const ui = controls();
  assert.match(ui.markup, /data-wallet-controls="true"/);
  assert.match(ui.markup, /aria-label="Wallet and play mode"/);
  assert.match(ui.markup, /METAMASK · STANDARD PLAY/);
  assert.match(ui.markup, /Your current run stays onchain/);
  assert.match(ui.markup, /separate player; your MetaMask progress is kept/);
  assert.deepEqual(ui.buttons.map(button => button.props.children), ["USE POPUP-FREE PLAY", "Disconnect"]);
  ui.buttons[0].props.onClick();
  assert.deepEqual(ui.called, ["session"]);
  ui.buttons[1].props.onClick();
  assert.deepEqual(ui.called, ["session", "disconnect"]);
  assert.doesNotMatch(ui.markup, /RESET|BEGIN NEW RUN|START GAME/);
});

test("disabled Somnia sessions and active session modes expose only their applicable wallet actions", () => {
  const standard = controls({ supportsSomniaSession: false });
  assert.deepEqual(standard.buttons.map(button => button.props.children), ["Disconnect"]);
  assert.doesNotMatch(standard.markup, /POPUP-FREE/);
  for (const mode of ["somnia-session", "rise-session"] as const) {
    const active = controls({ mode });
    assert.deepEqual(active.buttons.map(button => button.props.children), ["Revoke session", "Disconnect"]);
    assert.match(active.markup, mode === "somnia-session" ? /POPUP-FREE PLAY ACTIVE/ : /INSTANT PLAY ACTIVE/);
    assert.match(active.markup, /Disconnect keeps your onchain progress/);
    assert.match(active.markup, /Revoke ends this temporary session/);
    active.buttons[0].props.onClick();
    active.buttons[1].props.onClick();
    assert.deepEqual(active.called, ["revoke", "disconnect"]);
  }
});

test("pending gameplay or session work disables wallet controls and suppresses callbacks", () => {
  for (const mode of ["standard", "somnia-session", "rise-session"] as const) {
    const pending = controls({ mode, busy: true });
    assert.match(pending.markup, /role="status"/);
    assert.match(pending.markup, /Waiting for the current action/);
    for (const button of pending.buttons) {
      assert.equal(button.props.disabled, true);
      // Verify the handler guard too, independent of native disabled behavior.
      button.props.onClick();
    }
    assert.deepEqual(pending.called, []);
  }
});
