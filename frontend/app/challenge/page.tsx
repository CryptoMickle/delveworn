import { redirect } from "next/navigation";
import { currentWeeklyChallengeHref } from "./routing";

export const dynamic = "force-dynamic";

export default function CurrentChallengePage() {
  redirect(currentWeeklyChallengeHref());
}
