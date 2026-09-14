"use client";

import { GameLogo } from "../game-logo";
import Link from "next/link";

export default function OnchainError({ retry }: { retry: () => void }) {
  return <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white"><div className="mx-auto max-w-lg"><GameLogo /><h1 className="mt-8 text-2xl font-bold">The onchain entrance is unavailable</h1><p role="alert" className="mt-3 text-sm leading-relaxed text-zinc-300">The wallet or network connection could not load. Your onchain run remains in the contract. Returning home does not cancel an already submitted transaction.</p><button onClick={retry} className="mt-6 min-h-11 rounded-lg bg-orange-500 px-5 font-bold text-black">Try loading again</button><Link href="/" className="ml-5 inline-block py-4 text-sm underline">Back home</Link></div></main>;
}
