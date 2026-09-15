import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ChallengeClient from "../challenge-client";
import { getChallengeDefinition } from "../core";
import { isSomniaDeployment } from "../../deployment";

type ChallengePageProps = {
  params: Promise<{ challengeId: string }>;
  searchParams: Promise<{ r?: string | string[]; ref?: string | string[] }>;
};

export async function generateMetadata({ params }: ChallengePageProps): Promise<Metadata> {
  const { challengeId } = await params;
  const challenge = getChallengeDefinition(challengeId);
  if (!challenge) return { title: "Challenge not found · Delveworn" };
  const description = `Play Delveworn ${challenge.id}: the same 10-room seed for everyone, with a result verified by deterministic replay.`;
  return {
    title: `${challenge.id} Weekly Verified Challenge · Delveworn`,
    description,
    alternates: { canonical: `/challenge/${challenge.id}` },
    openGraph: {
      title: `${challenge.id} Weekly Verified Challenge · Delveworn`,
      description,
      type: "website",
      url: `/challenge/${challenge.id}`,
    },
    twitter: { card: "summary_large_image", title: `${challenge.id} Weekly Challenge`, description },
  };
}

export default async function ChallengePage({ params, searchParams }: ChallengePageProps) {
  const [{ challengeId }, query] = await Promise.all([params, searchParams]);
  const definition = getChallengeDefinition(challengeId);
  if (!definition) notFound();
  return (
    <ChallengeClient
      key={definition.id}
      definition={definition}
      resultProof={typeof query.r === "string" ? query.r : null}
      referral={typeof query.ref === "string" ? query.ref : null}
      onchainNetwork={isSomniaDeployment(process.env.NEXT_PUBLIC_DEPLOYMENT) ? "Somnia Shannon Testnet" : null}
    />
  );
}
