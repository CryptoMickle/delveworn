"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trackChallenge } from "./challenge/analytics";
import { loadWeeklyDescent } from "./descent/weekly-storage";
import { weeklyDescentIdForDate } from "./descent/weekly";
import { DesktopNavigation } from "./desktop-navigation";
import { GameLogo } from "./game-logo";
import { useGameAudio } from "./use-game-audio";
import styles from "./home.module.css";

type DungeonMode = "weekly" | "practice" | "living-dungeon" | "onchain";

export default function DungeonHome({ onchainNetwork }: { onchainNetwork: string }) {
  const [mode, setMode] = useState<DungeonMode>("weekly");
  const [weeklyResumable, setWeeklyResumable] = useState(false);
  const router = useRouter();
  const audio = useGameAudio();
  const networkBrand = onchainNetwork.split(" ")[0];
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const challengeId = weeklyDescentIdForDate();
      setWeeklyResumable(loadWeeklyDescent(() => window.localStorage, challengeId).status === "restored");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const content = mode === "weekly" ? {
    eyebrow: "WEEKLY CHALLENGE · NO WALLET NEEDED",
    title: "The First Descent starts here.",
    intro: "Take on this week’s fixed 10-room descent. Everyone faces the same dungeon, while your decisions determine how the story ends.",
    points: ["A new controlled dungeon opens each week.", "Finish the run, earn a replay-verified score and share your result."],
    facts: ["No wallet", "10 rooms", "Replay verified"],
    resume: "Your run for this week resumes on this browser when available.",
    cta: weeklyResumable ? "RESUME WEEKLY RUN" : "PLAY FREE",
    note: "Local deterministic play. No transaction, token, NFT or onchain reward.",
  } : mode === "practice" ? {
    eyebrow: "ENDLESS PRACTICE · NO WALLET NEEDED",
    title: "Find your feet. Then keep going.",
    intro: "Fight monsters, upgrade your equipment and collect boss relics. Learn the dungeon at your own pace and see how deep you can go.",
    points: ["Attack for a steadier hit, risk a Storm or use a potion. Survivors hit back.", "Visit Kevin between rooms. Every tenth room brings a boss."],
    facts: ["Local play", "No wallet", "Endless rooms"],
    resume: "A saved local run will resume when you enter Endless Practice.",
    cta: "PLAY / RESUME LOCAL",
    note: "Local simulation. Progress is saved in this browser when available. No transactions or onchain rewards.",
  } : mode === "living-dungeon" ? {
    eyebrow: "THE LIVING DUNGEON · EXPERIMENTAL",
    title: "Teach the relic. Deceive the dungeon.",
    intro: "The Mind Beneath is learning who you are. Teach your relic in private, choose what witnesses see and face an echo built from the stories that reach the dark.",
    points: ["Build a plan on the dungeon floor. See its movements, cost and witnesses before you commit.", "Preserve your own maneuvers, correct the relic and carry what you learn beyond the first Echo."],
    facts: ["A learning relic", "A fallible dungeon", "Persistent expedition"],
    resume: "Your expedition resumes with its memories, relationships and unfinished plans in this browser.",
    cta: "ENTER THE LIVING DUNGEON",
    note: "Local, wallet-free play. Optional text interpretation uses OpenAI. The expedition continues when AI is unavailable.",
  } : {
    eyebrow: `WALLET · ${onchainNetwork.toUpperCase()}`,
    title: "Enter the dungeon onchain.",
    intro: `Play classic Delveworn on ${onchainNetwork}. Your wallet authorizes your actions, and the contract keeps your progress.`,
    points: ["Connect your wallet and review the network before starting.", "Return with the same wallet to continue your onchain player."],
    facts: [onchainNetwork, "Wallet required", "Onchain progress"],
    resume: "Wallet connection comes next. Choosing a mode sends no transaction.",
    cta: "CONTINUE TO WALLET",
    note: "Testnet play. Actions require wallet authorization and network confirmation.",
  };
  const soundLabel = !audio.available ? "Sound unavailable" : audio.enabled && audio.paused ? "Resume sound" : audio.enabled ? "Mute sound" : "Enable sound";
  const enterDungeon = () => {
    if (mode === "weekly") {
      const challengeId = weeklyDescentIdForDate();
      const resumed = loadWeeklyDescent(() => window.localStorage, challengeId).status === "restored";
      trackChallenge("challenge_home_started", challengeId, { rules_version: 2, resumed });
      router.push(`/challenge/${challengeId}?v=2`);
      return;
    }
    router.push(mode === "living-dungeon" ? "/living-dungeon?entry=home" : `/${mode}`);
  };

  return (
    <main className={styles.home}>
      <DesktopNavigation />
      <button type="button" className={styles.sound} onClick={audio.toggleSound} aria-label={soundLabel} aria-pressed={audio.enabled} disabled={!audio.available} data-keyboard-exclude>
        <span aria-hidden="true">{audio.enabled ? "🔊" : "🔇"}</span>
        {!audio.available ? "UNAVAILABLE" : audio.enabled && audio.paused ? "RESUME" : audio.enabled ? "SOUND ON" : "SOUND OFF"}
      </button>
      <div className={styles.frame}>
        <header className={styles.header} data-keyboard-exclude>
          <GameLogo onHome={() => { setMode("weekly"); window.scrollTo({ top: 0, behavior: "instant" }); }} />
          <h1>Your call. Your way in.</h1>
          <p>Fight the monsters. Face the boss. Live with your choices.</p>
        </header>
        <div data-keyboard-actions>
          <div className={styles.modes} role="group" aria-label="Choose your dungeon">
            {(["weekly", "practice", "living-dungeon", "onchain"] as const).map(value => (
              <button key={value} type="button" className={styles.mode} aria-pressed={mode === value} aria-controls="dungeon-details" data-keyboard-default={value === "weekly" ? "true" : undefined} onClick={() => setMode(value)}>
                {value === "weekly" ? "Weekly Challenge: The First Descent" : value === "practice" ? "Endless Practice" : value === "living-dungeon" ? "The Living Dungeon · Experimental" : `${networkBrand} Onchain`}
              </button>
            ))}
          </div>
          <section id="dungeon-details" className={styles.details} aria-label="Selected dungeon">
            <div className={styles.art} data-home-art>
              <Image src="/assets/delveworn-tier2-party-hero.webp" alt="Grave Belle, Gary and Meatwall waiting in the dungeon" fill priority unoptimized sizes="(max-width: 800px) 100vw, 560px" />
              <div><span>WELCOME TO DELVEWORN</span><strong>The dungeon has opinions.<br />Now you get one too.</strong></div>
            </div>
            <div className={styles.copy} data-home-copy>
              <div className={styles.explanation} aria-live="polite" aria-atomic="true">
                <p className={styles.eyebrow}>{content.eyebrow}</p>
                <h2>{content.title}</h2>
                <p className={styles.intro}>{content.intro}</p>
                <ul>{content.points.map(point => <li key={point}>{point}</li>)}</ul>
              </div>
              <div className={styles.formatSlot}>
                <div className={styles.facts}>{content.facts.map(fact => <span key={fact}>{fact}</span>)}</div>
              </div>
              <div className={styles.entry}>
                <p className={styles.resume}>{content.resume}</p>
                <button type="button" className={styles.enter} onClick={enterDungeon}>
                  {content.cta}<span aria-hidden="true">→</span>
                </button>
                <p className={styles.note}>{content.note}</p>
              </div>
            </div>
          </section>
        </div>
        <footer className={styles.footer}><span>DELVEWORN · WEEKLY · PRACTICE · LIVING DUNGEON · {onchainNetwork.toUpperCase()}</span><span>Dungeon management accepts no responsibility.</span></footer>
      </div>
    </main>
  );
}
