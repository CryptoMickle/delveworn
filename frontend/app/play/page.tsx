import type { Metadata } from "next";
import DescentGame from "../descent/game";

export const metadata: Metadata = {
  title: "Delveworn · The First Descent",
  description: "Ten rooms. One very questionable employer. Enter the dungeon and earn your loot. Play without a wallet.",
  alternates: { canonical: "/play" },
};

export default function PlayPage() { return <DescentGame />; }
