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
  "A browser-playable dungeon crawler for learning the rooms, testing builds and surviving questionable management decisions.";

export const metadata: Metadata = {
  metadataBase: new URL("https://delveworn.vercel.app"),
  title: "Delveworn · Local Practice Mode",
  description,
  applicationName: "Delveworn",
  alternates: {
    canonical: "/practice",
  },
  keywords: [
    "Delveworn",
    "dungeon crawler",
    "browser game",
    "practice mode",
    "roguelite",
  ],
  openGraph: {
    title: "Delveworn · Local Practice Mode",
    description,
    type: "website",
    siteName: "Delveworn",
    url: "/practice",
  },
  twitter: {
    card: "summary_large_image",
    title: "Delveworn · Local Practice Mode",
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
