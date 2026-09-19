import type { Metadata } from "next";
import LivingDungeonClient from "./living-dungeon-client";
import "../descent/game.css";
import "../descent/combat-panel.css";
import "../dungeon/scene.css";
import "../dungeon/room-parchments.css";
import "./living-dungeon.css";

const description =
  "Forge a pact, leave witnesses and face what the dungeon thinks it knows in this experimental Delveworn story run.";

export const metadata: Metadata = {
  title: "The Living Dungeon · Delveworn",
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
  return <LivingDungeonClient />;
}
