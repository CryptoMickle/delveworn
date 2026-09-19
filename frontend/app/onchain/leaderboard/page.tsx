import type { Metadata } from "next";
import Link from "next/link";
import { isAddress } from "viem";
import { DesktopNavigation } from "../../desktop-navigation";
import { GameLogo } from "../../game-logo";
import { activeDeployment } from "../../chain-config";
import { OnchainLeaderboard } from "../../onchain-leaderboard/onchain-leaderboard";
import "../../descent/game.css";
import "../../onchain-leaderboard/leaderboard.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Somnia Deepest Descent leaderboard · Delveworn",
  description: "Contract-derived standings for Delveworn on Somnia Shannon Testnet.",
  alternates: { canonical: "/onchain/leaderboard" },
  openGraph: {
    title: "Somnia Deepest Descent leaderboard · Delveworn",
    description: "Contract-derived standings for Delveworn on Somnia Shannon Testnet.",
    type: "website",
    url: "/onchain/leaderboard",
  },
};

type PageProps = {
  searchParams: Promise<{ player?: string | string[] }>;
};

export default async function OnchainLeaderboardPage({ searchParams }: PageProps) {
  const rawPlayer = (await searchParams).player;
  const playerValue = Array.isArray(rawPlayer) ? rawPlayer[0] : rawPlayer;
  const player = playerValue && isAddress(playerValue) ? playerValue : null;

  return <main className="descent-shell onchain-leaderboard-page">
    <header className="descent-header">
      <DesktopNavigation />
      <GameLogo />
      <span className="descent-edition onchain-leaderboard-edition">SOMNIA STANDINGS · V1</span>
    </header>

    <div className="onchain-leaderboard-page-main">
      <section className="onchain-leaderboard-intro" aria-labelledby="somnia-standings-heading">
        <p className="descent-kicker">LIVE TESTNET · CHAIN ID {activeDeployment.chain.id}</p>
        <h1 id="somnia-standings-heading">Deepest Descent</h1>
        <p>Every placement comes from the active Delveworn contract. No score form, nickname or extra transaction is required.</p>
      </section>

      <nav className="onchain-leaderboard-page-nav" aria-label="Onchain leaderboard navigation">
        <Link href="/onchain">Play onchain</Link>
        <a href={`${activeDeployment.explorerUrl.replace(/\/+$/, "")}/address/${activeDeployment.dungeonAddress}`} target="_blank" rel="noreferrer">View contract ↗</a>
      </nav>

      <div className="onchain-leaderboard-page-card">
        <OnchainLeaderboard explorerUrl={activeDeployment.explorerUrl} player={player} />
      </div>
    </div>

    <footer className="descent-footer onchain-leaderboard-footer">
      <span>Canonical contract events · one best depth per gameplay account</span>
      <Link href="/onchain">Return to Somnia Verified Run</Link>
    </footer>
  </main>;
}
