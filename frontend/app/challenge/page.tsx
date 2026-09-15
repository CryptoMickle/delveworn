import { redirect } from "next/navigation";
import { challengeIdForDate } from "./core";

export const dynamic = "force-dynamic";

export default function CurrentChallengePage() {
  redirect(`/challenge/${challengeIdForDate()}`);
}
