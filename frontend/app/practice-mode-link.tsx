"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PracticeModeLink() {
  const pathname = usePathname();

  if (pathname === "/practice") return null;

  return (
    <Link
      href="/practice"
      className="practice-mode-link fixed right-2 top-2 z-[100] rounded-full border border-amber-700/80 bg-black/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200 shadow-xl shadow-black/40 backdrop-blur transition hover:border-amber-400 hover:bg-amber-950 sm:right-5 sm:top-5 sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.16em]"
    >
      Practice · No VRF
    </Link>
  );
}
