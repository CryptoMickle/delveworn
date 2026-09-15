"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DesktopNavigation } from "./desktop-navigation";
import { GameLogo } from "./game-logo";
import { useGameAudio } from "./use-game-audio";
import styles from "./home.module.css";

type DungeonMode = "practice" | "challenge" | "onchain";

export default function DungeonHome({ onchainNetwork }: { onchainNetwork: string }) {
  const [mode, setMode] = useState<DungeonMode | null>(null);
  const router = useRouter();
  const audio = useGameAudio();
  const content = mode === "practice" ? {
    eyebrow: "PRACTICE · NO WALLET NEEDED",
    title: "Find your feet. Then push your luck.",
    intro: "Fight monsters, upgrade your equipment and collect boss relics. Learn the dungeon at your own pace before taking your run onchain.",
    points: ["Attack for a steadier hit, risk a Storm or use a potion. Survivors hit back.", "Visit Kevin between rooms. Every tenth room brings a boss."],
    facts: ["Local play", "No wallet", "Endless rooms"],
    resume: "A saved local run will resume when you enter Practice.",
    note: "Local simulation. Progress is saved in this browser when available. No transactions or onchain rewards.",
  } : mode === "challenge" ? {
    eyebrow: "WEEKLY · SAME SEED FOR EVERYONE",
    title: "One dungeon. One week. Your decisions.",
    intro: "Take on a fixed 10-room challenge, earn a replay-verified score and share a link that sends friends into the same run.",
    points: ["Every player gets the same challenge ID and controlled seed.", "Shared results are rebuilt from the action trace before the score is shown."],
    facts: ["No wallet", "10 rooms", "Replay verified"],
    resume: "Your current weekly run resumes on this browser when available.",
    note: "Local deterministic play. No transaction, token, NFT or onchain reward.",
  } : mode === "onchain" ? {
    eyebrow: `WALLET · ${onchainNetwork.toUpperCase()}`,
    title: "Enter the dungeon onchain.",
    intro: `Play classic Delveworn on ${onchainNetwork}. Your wallet authorizes your actions, and the contract keeps your progress.`,
    points: ["Connect your wallet and review the network before starting.", "Return with the same wallet to continue your onchain player."],
    facts: [onchainNetwork, "Wallet required", "Onchain progress"],
    resume: "Wallet connection comes next. Choosing a mode sends no transaction.",
    note: "Testnet play. Actions require wallet authorization and network confirmation.",
  } : {
    eyebrow: "WELCOME TO DELVEWORN",
    title: "Choose your way into the dungeon.",
    intro: "Select a version above to see what you will play and how it works. Nothing starts until you press Enter Dungeon.",
    points: ["Take your time. You can compare the versions before entering.", "The Delveworn logo brings you back here whenever you need it."],
    facts: [],
    resume: "Choose a version, then enter when you are ready.",
    note: "Your adventure starts with your choice.",
  };
  const soundLabel = !audio.available ? "Sound unavailable" : audio.enabled && audio.paused ? "Resume sound" : audio.enabled ? "Mute sound" : "Enable sound";

  return (
    <main className={styles.home}>
      <DesktopNavigation />
      <button type="button" className={styles.sound} onClick={audio.toggleSound} aria-label={soundLabel} aria-pressed={audio.enabled} disabled={!audio.available} data-keyboard-exclude>
        <span aria-hidden="true">{audio.enabled ? "🔊" : "🔇"}</span>
        {!audio.available ? "UNAVAILABLE" : audio.enabled && audio.paused ? "RESUME" : audio.enabled ? "SOUND ON" : "SOUND OFF"}
      </button>
      <div className={styles.frame}>
        <header className={styles.header} data-keyboard-exclude>
          <GameLogo onHome={() => { setMode(null); window.scrollTo({ top: 0, behavior: "instant" }); }} />
          <h1>Your call. Your way in.</h1>
          <p>Fight the monsters. Face the boss. Live with your choices.</p>
        </header>
        <Link href="/play" className={styles.firstDescent}><span>NEW · NO WALLET NEEDED</span><strong>Play The First Descent</strong><span>Ten rooms · Three relic builds <b>↗</b></span></Link>
        <div data-keyboard-actions>
          <div className={styles.modes} role="group" aria-label="Choose your dungeon">
            {(["practice", "challenge", "onchain"] as const).map(value => (
              <button key={value} type="button" className={styles.mode} aria-pressed={mode === value} aria-controls="dungeon-details" data-keyboard-default={value === "practice" ? "true" : undefined} onClick={() => setMode(value)}>
                {value === "practice" ? "Practice" : value === "challenge" ? "Weekly Challenge" : "Onchain"}
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
                <button type="button" className={styles.enter} disabled={!mode} onClick={() => { if (mode) router.push(`/${mode}`); }}>
                  {mode ? "ENTER DUNGEON" : "CHOOSE A MODE"}<span aria-hidden="true">→</span>
                </button>
                <p className={styles.note}>{content.note}</p>
              </div>
            </div>
          </section>
        </div>
        <footer className={styles.footer}><span>DELVEWORN · WEEKLY · PRACTICE · {onchainNetwork.toUpperCase()}</span><span>Dungeon management accepts no responsibility.</span></footer>
      </div>
    </main>
  );
}
