import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import MobileMetaMaskInstantPlayBridge from "./mobile-metamask-instant-play-bridge";
import PracticeModeLink from "./practice-mode-link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "A fully onchain dungeon crawler with wallet-signed actions, verifiable randomness and contract-backed progress.";

export const metadata: Metadata = {
  metadataBase: new URL("https://delveworn.vercel.app"),
  title: "Delveworn · Onchain Dungeon",
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
    title: "Delveworn · Onchain Dungeon",
    description,
    type: "website",
    siteName: "Delveworn",
    url: "/onchain",
  },
  twitter: {
    card: "summary_large_image",
    title: "Delveworn · Onchain Dungeon",
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
        <MobileMetaMaskInstantPlayBridge />
        <PracticeModeLink />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
