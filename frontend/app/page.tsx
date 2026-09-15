import type { Metadata } from "next";
import DungeonHome from "./dungeon-home";
import { isSomniaDeployment } from "./deployment";

const onchainNetwork = isSomniaDeployment(process.env.NEXT_PUBLIC_DEPLOYMENT) ? "Somnia Shannon Testnet" : "RISE Testnet";
const description = `Enter a dungeon of questionable management. Fight monsters, collect relics and learn when to risk it. Choose local Practice or a wallet-connected run on ${onchainNetwork}.`;

export const metadata: Metadata = {
  title: "Delveworn · Enter the dungeon",
  description,
  alternates: { canonical: "/" },
  openGraph: { title: "Delveworn · Enter the dungeon", description, url: "/" },
  twitter: { card: "summary_large_image", title: "Delveworn · Enter the dungeon", description },
};

export default function HomePage() {
  return <DungeonHome onchainNetwork={onchainNetwork} />;
}
