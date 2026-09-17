import type { Metadata } from "next";
import DungeonHome from "./dungeon-home";
import { isSomniaDeployment } from "./deployment";

const onchainNetwork = isSomniaDeployment(process.env.NEXT_PUBLIC_DEPLOYMENT) ? "Somnia Shannon Testnet" : "RISE Testnet";
const description = `Play Weekly Challenge: The First Descent, explore Endless Practice, or take your run onchain on ${onchainNetwork}. Fight monsters, collect relics and live with your choices.`;

export const metadata: Metadata = {
  title: "Delveworn · Weekly Challenge: The First Descent",
  description,
  alternates: { canonical: "/" },
  openGraph: { title: "Delveworn · Weekly Challenge: The First Descent", description, url: "/" },
  twitter: { card: "summary_large_image", title: "Delveworn · Weekly Challenge: The First Descent", description },
};

export default function HomePage() {
  return <DungeonHome onchainNetwork={onchainNetwork} />;
}
