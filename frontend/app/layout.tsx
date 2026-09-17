import type { Metadata } from "next";
import { Geist, Geist_Mono, IM_Fell_English } from "next/font/google";
import { SITE_ORIGIN } from "./site-origin";
import { onchainMetadataCopy } from "./deployment-copy";
import { SafeAnalytics } from "./safe-analytics";
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

const parchmentFont = IM_Fell_English({
  variable: "--font-parchment",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const { title, description } = onchainMetadataCopy(
  process.env.NEXT_PUBLIC_DEPLOYMENT,
  process.env.NEXT_PUBLIC_SOMNIA_SESSION_KEYS_ENABLED === "true",
);

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
      className={`${geistSans.variable} ${geistMono.variable} ${parchmentFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SafeAnalytics />
      </body>
    </html>
  );
}
