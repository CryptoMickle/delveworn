import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DesktopNavigation } from "../../../desktop-navigation";
import { GameLogo } from "../../../game-logo";
import { WeeklyLeaderboard } from "../../../leaderboard/weekly-leaderboard";
import {
  getWeeklyDescentDefinition,
  weeklyDescentIdForDate,
} from "../../../descent/weekly";
import "../../../descent/game.css";
import "../../../descent/weekly.css";

export const dynamic = "force-dynamic";

type WeeklyLeaderboardPageProps = {
  params: Promise<{ challengeId: string }>;
};

function definitionOrNotFound(challengeId: string) {
  const definition = getWeeklyDescentDefinition(challengeId);
  if (!definition || Date.parse(definition.startsAt) > Date.now()) notFound();
  return definition;
}

export async function generateMetadata({ params }: WeeklyLeaderboardPageProps): Promise<Metadata> {
  const { challengeId } = await params;
  const definition = definitionOrNotFound(challengeId);
  const title = `${definition.id} First Descent leaderboard · Delveworn`;
  const description = `Verified standings for Delveworn Weekly Challenge: The First Descent, ${definition.id}.`;
  const url = `/challenge/${definition.id}/leaderboard`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "website", url },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function WeeklyLeaderboardPage({ params }: WeeklyLeaderboardPageProps) {
  const { challengeId } = await params;
  const definition = definitionOrNotFound(challengeId);
  const now = new Date();
  const currentId = weeklyDescentIdForDate(now);
  const currentDefinition = definitionOrNotFound(currentId);
  const previousId = weeklyDescentIdForDate(new Date(Date.parse(definition.startsAt) - 1));
  const nextId = weeklyDescentIdForDate(new Date(definition.endsAt));
  const archived = Date.parse(definition.endsAt) <= now.getTime();
  const hasNewerArchive = archived
    && Date.parse(definition.endsAt) <= Date.parse(currentDefinition.startsAt);

  return <main className="descent-shell weekly-leaderboard-page">
    <header className="descent-header">
      <DesktopNavigation />
      <GameLogo />
      <span className="descent-edition weekly-edition">WEEKLY STANDINGS · V2</span>
    </header>

    <div className="weekly-leaderboard-page-main">
      <section className="weekly-leaderboard-page-intro" aria-labelledby="weekly-standings-heading">
        <p className="descent-kicker">{archived ? "FINAL ARCHIVE" : "CURRENT WEEK"} · {definition.id}</p>
        <h1 id="weekly-standings-heading">The First Descent leaderboard</h1>
        <p>Server-verified guest scores from the same fixed ten-room descent. Equal scores share a rank.</p>
      </section>

      <nav className="weekly-leaderboard-page-nav" aria-label="Weekly challenge navigation">
        <Link href={`/challenge/${currentId}?v=2`}>Play this week</Link>
        <Link href={`/challenge/${previousId}/leaderboard`}>← Previous week</Link>
        {hasNewerArchive && <Link href={`/challenge/${nextId}/leaderboard`}>
          {nextId === currentId ? "Current standings →" : "Next week →"}
        </Link>}
      </nav>

      <div className="weekly-leaderboard-page-card">
        <WeeklyLeaderboard challengeId={definition.id} />
      </div>
    </div>

    <footer className="descent-footer">
      <span>Informal standings · one best verified score per guest</span>
      <Link href={`/challenge/${currentId}?v=2`}>Return to Weekly Challenge</Link>
    </footer>
  </main>;
}
