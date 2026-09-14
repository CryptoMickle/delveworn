import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_ORIGIN } from "./site-origin";
import "./globals.css";
import "./game-logo.css";
import "./between-rooms.css";
import "./run-end.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const isSomniaDeployment =
  process.env.NEXT_PUBLIC_DEPLOYMENT === "somniaShannon";

const title = isSomniaDeployment
  ? "Delveworn · Somnia Verified Run"
  : "Delveworn · Onchain Dungeon";

const description = isSomniaDeployment
  ? "A Somnia Verified Run with contract-backed progress, popup-free sponsored actions and verifiable randomness."
  : "A fully onchain dungeon crawler with wallet-signed actions, verifiable randomness and contract-backed progress.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title,
  description,
  applicationName: "Delveworn",
  alternates: {
    canonical: "/onchain",
  },
  keywords: [
    "Delveworn",
    "dungeon crawler",
    "onchain game",
    "verifiable randomness",
    "testnet",
    "roguelite",
  ],
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "Delveworn",
    url: "/onchain",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
