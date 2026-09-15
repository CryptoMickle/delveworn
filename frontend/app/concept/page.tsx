import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ConceptRoom from "./room";

export const metadata: Metadata = {
  title: "Delveworn · Room concept",
  description: "A local one-room art direction study for the first descent.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/concept" },
};

export default function ConceptPage() {
  // Milestone B is a review artifact, not a published game mode.
  if (process.env.NODE_ENV !== "development") notFound();
  return <ConceptRoom />;
}
