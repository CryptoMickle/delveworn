import type { Metadata } from "next";
import type { ReactNode } from "react";

const description =
  "A browser-playable dungeon crawler for learning the rooms, testing builds and surviving questionable management decisions.";

export const metadata: Metadata = {
  title: "Delveworn · Local Practice Mode",
  description,
  alternates: {
    canonical: "/practice",
  },
  keywords: [
    "Delveworn",
    "dungeon crawler",
    "browser game",
    "practice mode",
    "roguelite",
  ],
  openGraph: {
    title: "Delveworn · Local Practice Mode",
    description,
    type: "website",
    siteName: "Delveworn",
    url: "/practice",
  },
  twitter: {
    card: "summary_large_image",
    title: "Delveworn · Local Practice Mode",
    description,
  },
};

export default function PracticeLayout({ children }: { children: ReactNode }) {
  return children;
}
