import type { Metadata, Viewport } from "next";
import DescentGame from "../descent/game";

export const metadata: Metadata = {
  title: "Delveworn · The First Descent",
  description: "Ten rooms. One very questionable employer. Enter the dungeon and earn your loot. Play without a wallet.",
  alternates: { canonical: "/play" },
};

export const viewport: Viewport = { width:"device-width", initialScale:1, viewportFit:"cover", themeColor:"#26182b" };

export default function PlayPage() { return <DescentGame />; }
