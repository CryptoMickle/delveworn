import type { Metadata, Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import DescentGame from "../descent/game";
import { currentWeeklyChallengeHref, parsePlayRoute } from "../challenge/routing";

const legacyMetadata: Metadata = {
  title: "Delveworn · The First Descent",
  description: "Ten rooms. One very questionable employer. Enter the dungeon and earn your loot. Play without a wallet.",
  alternates: { canonical: "/play?legacy=1" },
};

type PlayPageProps = {
  searchParams: Promise<{ legacy?: string | string[] }>;
};

export async function generateMetadata({ searchParams }: PlayPageProps): Promise<Metadata> {
  const route = parsePlayRoute((await searchParams).legacy);
  if (route === null) notFound();
  return route === "legacy"
    ? legacyMetadata
    : { title: "Weekly Challenge: The First Descent · Delveworn" };
}

export const viewport: Viewport = { width:"device-width", initialScale:1, viewportFit:"cover", themeColor:"#26182b" };

export default async function PlayPage({ searchParams }: PlayPageProps) {
  const route = parsePlayRoute((await searchParams).legacy);
  if (route === null) notFound();
  if (route === "weekly") redirect(currentWeeklyChallengeHref());
  return <DescentGame />;
}
