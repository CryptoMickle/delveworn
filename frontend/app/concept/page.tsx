import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConceptRoom from "./room";
import "./review.css";

export const metadata: Metadata = {
  title: "Delveworn · Room concept",
  description: "A one-room study preserving Delveworn's original monster artwork style.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/concept" },
};

export default function ConceptPage() {
  // Milestone B is a review artifact, not a published game mode.
  if (process.env.NODE_ENV !== "development") notFound();
  return <div className="concept-review">
    <header className="concept-review-header">
      <Image src="/assets/delveworn-logo-v1.png" alt="Delveworn" width={2172} height={724} unoptimized priority />
      <span>APPROVED DIRECTION · LOCAL BUILD</span>
    </header>
    <section className="concept-playable" aria-label="Current playable build"><Image src="/dungeon/adventurer.webp" alt="The updated androgynous adventurer with a plum hood and practical armor" width={110} height={114} /><div><p className="concept-review-kicker">THE FIRST DESCENT</p><h2>The rooms are now connected.</h2><p>The playable build uses the original monsters and the updated androgynous adventurer.</p><Link href="/play">Play the ten-room build →</Link></div></section>
    <section className="concept-review-direction" aria-labelledby="concept-review-title">
      <p className="concept-review-kicker">ORIGINAL MONSTER ARTWORK</p>
      <h1 id="concept-review-title">The same Delveworn. A world to walk through.</h1>
      <p>The original monsters define the look: expressive faces, detailed materials and dramatic dungeon lighting. The room, adventurer and relic effects will follow that style.</p>
      <div className="concept-originals" aria-label="Unchanged original artwork">
        {[
          { name: "Gary", src: "/monsters/goblin-1-gary.webp" },
          { name: "Grave Belle", src: "/monsters/zombie-1-grave-belle.webp" },
          { name: "Thud", src: "/monsters/orc-1-thud.webp" },
        ].map(monster => <figure key={monster.name}>
          <Image src={monster.src} alt={`${monster.name} — original Delveworn artwork`} width={766} height={431} unoptimized />
          <figcaption>{monster.name}<span>ORIGINAL</span></figcaption>
        </figure>)}
      </div>
    </section>
    <section className="concept-review-proposal" aria-labelledby="concept-revision-heading">
      <h2 id="concept-revision-heading">One-room visual revision</h2>
      <p>The approved concept illustration, retained for reference. The playable build above contains the later avatar refinement.</p>
      <Image className="concept-revision-image" src="/concept/original-style-revision.png" alt="Revised dungeon concept with the original Gary design, a visible adventurer and a floating Stormglass relic." width={1536} height={1024} unoptimized priority />
    </section>
    <details className="concept-layout-study">
      <summary>Try the movement and combat study <span>Temporary figures · earlier layout test</span></summary>
      <p className="concept-study-notice">This earlier test uses temporary vector figures. It demonstrates movement and existing Practice combat; its graphics are not the chosen art direction.</p>
      <ConceptRoom />
    </details>
  </div>;
}
