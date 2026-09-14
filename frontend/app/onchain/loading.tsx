import { GameLogo } from "../game-logo";

export default function LoadingOnchain() {
  return <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white"><div className="mx-auto max-w-lg"><GameLogo /><p role="status" className="mt-8 text-zinc-300">Preparing the onchain entrance…</p><p className="mt-3 text-sm text-zinc-500">Wallet options appear before a run begins.</p></div></main>;
}
