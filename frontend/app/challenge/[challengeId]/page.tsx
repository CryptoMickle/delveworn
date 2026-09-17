import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChallengeClient from "../challenge-client";
import { getChallengeDefinition, verifyChallengeProof } from "../core";
import { currentWeeklyChallengeHref, parseChallengeRoute, type ChallengeSearchParams } from "../routing";
import WeeklyDescentClient from "../../descent/weekly-challenge";
import { getWeeklyDescentDefinition, verifyWeeklyDescentProof } from "../../descent/weekly";
import { isSomniaDeployment } from "../../deployment";

type ChallengePageProps = {
  params: Promise<{ challengeId: string }>;
  searchParams: Promise<ChallengeSearchParams>;
};

export async function generateMetadata({ params, searchParams }: ChallengePageProps): Promise<Metadata> {
  const [{ challengeId }, query] = await Promise.all([params, searchParams]);
  const route = parseChallengeRoute(query);
  if (!route) notFound();
  if (route.version === 2) {
    const weekly = getWeeklyDescentDefinition(challengeId);
    if (!weekly) return { title: "Challenge not found · Delveworn" };
    const title = `${weekly.id} Weekly Challenge: The First Descent · Delveworn`;
    let previewScore: number | null = null;
    let previewRooms: number | null = null;
    if (route.resultProof) {
      try {
        const verified = await verifyWeeklyDescentProof(weekly.id, route.resultProof);
        previewScore = verified.result.score;
        previewRooms = verified.result.roomsCleared;
      } catch {
        // Invalid shared results keep generic metadata and never publish a claimed score.
      }
    }
    const score = previewScore === null ? null : previewScore.toLocaleString("en-US");
    const description = score === null
      ? `Play Delveworn ${weekly.id}: a fixed 10-room First Descent with a result verified by deterministic replay.`
      : `Verified result: ${score} points and ${previewRooms}/10 rooms in Delveworn ${weekly.id}. Replay the same First Descent.`;
    const url = `/challenge/${weekly.id}?v=2`;
    const previewTitle = score === null ? title : `${score} points · ${weekly.id} First Descent · Delveworn`;
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: { title: previewTitle, description, type: "website", url: score !== null && route.resultProof ? `${url}&r=${encodeURIComponent(route.resultProof)}` : url },
      twitter: { card: "summary_large_image", title: previewTitle, description },
    };
  }

  const challenge = getChallengeDefinition(challengeId);
  if (!challenge) return { title: "Challenge not found · Delveworn" };
  let previewScore: number | null = null;
  let previewRooms: number | null = null;
  if (route.resultProof) {
    try {
      const verified = await verifyChallengeProof(challenge.id, route.resultProof);
      previewScore = verified.result.score;
      previewRooms = verified.result.roomsCleared;
    } catch {
      // Invalid shared results keep generic metadata and never publish a claimed score.
    }
  }
  const score = previewScore === null ? null : previewScore.toLocaleString("en-US");
  const description = score === null
    ? `Play Delveworn ${challenge.id}: the same 10-room seed for everyone, with a result verified by deterministic replay.`
    : `Verified result: ${score} points and ${previewRooms}/10 rooms in the preserved Delveworn ${challenge.id} challenge.`;
  const title = `${challenge.id} Weekly Verified Challenge · Delveworn`;
  const previewTitle = score === null ? title : `${score} points · ${challenge.id} Weekly Verified Challenge · Delveworn`;
  return {
    title,
    description,
    alternates: { canonical: `/challenge/${challenge.id}` },
    openGraph: {
      title: previewTitle,
      description,
      type: "website",
      url: score !== null && route.resultProof ? `/challenge/${challenge.id}?r=${encodeURIComponent(route.resultProof)}` : `/challenge/${challenge.id}`,
    },
    twitter: { card: "summary_large_image", title: previewTitle, description },
  };
}

export default async function ChallengePage({ params, searchParams }: ChallengePageProps) {
  const [{ challengeId }, query] = await Promise.all([params, searchParams]);
  const route = parseChallengeRoute(query);
  if (!route) notFound();
  const onchainNetwork = isSomniaDeployment(process.env.NEXT_PUBLIC_DEPLOYMENT) ? "Somnia Shannon Testnet" : null;

  if (route.version === 2) {
    const definition = getWeeklyDescentDefinition(challengeId);
    if (!definition) notFound();
    return (
      <WeeklyDescentClient
        key={JSON.stringify([definition.id, route.resultProof, route.referral])}
        definition={definition}
        resultProof={route.resultProof}
        referral={route.referral}
        onchainNetwork={onchainNetwork}
      />
    );
  }

  const definition = getChallengeDefinition(challengeId);
  if (!definition) notFound();
  return (
    <>
      <div className="bg-[#090909] px-4 pt-3 text-center text-xs text-zinc-400">
        This is the preserved original weekly challenge. <Link href={currentWeeklyChallengeHref()} className="font-bold text-violet-300 underline underline-offset-4 hover:text-violet-200">Play the current First Descent</Link>
      </div>
      <ChallengeClient
        key={definition.id}
        definition={definition}
        resultProof={route.resultProof}
        referral={route.referral}
        onchainNetwork={onchainNetwork}
      />
    </>
  );
}
