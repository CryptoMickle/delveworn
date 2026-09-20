import type { Metadata } from "next";
import MindBeneathClient from "./mind/client";

const description =
  "Teach the relic who you are. Convince the dungeon you are someone else. A persistent, tactical expedition beneath Delveworn.";

export const metadata: Metadata = {
  title: "The Mind Beneath · The Living Dungeon · Delveworn",
  description,
  alternates: { canonical: "/living-dungeon" },
  openGraph: {
    title: "The Living Dungeon · Delveworn",
    description,
    type: "website",
    siteName: "Delveworn",
    url: "/living-dungeon",
  },
  twitter: { card: "summary_large_image", title: "The Living Dungeon · Delveworn", description },
};

export default function LivingDungeonPage() {
  return <MindBeneathClient />;
}
