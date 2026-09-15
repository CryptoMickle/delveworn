import type { Metadata } from "next";
import DescentGame from "../descent/game";

export const metadata: Metadata = {
  title: "Delveworn · The First Descent",
  description: "Ten rooms. Three relic builds. One very questionable employer. Play without a wallet.",
  alternates: { canonical: "/play" },
};

export default function PlayPage() { return <DescentGame />; }
