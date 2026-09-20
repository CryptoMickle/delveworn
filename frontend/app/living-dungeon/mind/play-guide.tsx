import type { ReactNode } from "react";
import type { Plan, Preview, Run } from "./types";
import { entity } from "./world";
import styles from "./mind.module.css";

type Action = "preview" | "remember" | "exit" | "correct" | "retry" | "retreat";

/** Advice is derived from the saved world, so returning players get the right next step. */
export function PlayGuide({ run, plan, preview, auto, canRemember, canReuse, atExit, onAction, children }: {
  run: Run; plan: Plan | null; preview: Preview | null; auto: boolean;
  canRemember: boolean; canReuse: boolean; atExit: boolean;
  onAction: (action: Action) => void; children?: ReactNode;
}) {
  const first = run.room.index === 0, captive = entity(run.room, "captive");
  let step = 1, title = "Lær relikvien en regel", body = "Du er den turkise figuren med en lysende rune. Få kartografen fri, og nå trappen. Begynn med en regel relikvien skal følge.", action: Action | null = null, label = "";
  if (run.relic.principles.length) {
    step = 2; title = first ? "Se en redningsplan" : "Finn en vei gjennom rommet";
    body = first ? "Lykten gjør det lett å se deg. Slukk den, bruk klokken til å trekke vokteren bort, og åpne fangens lenke. Du får se hele planen før noe skjer." : run.room.objective;
    action = "preview"; label = canReuse ? "Prøv manøveren her" : first ? "Vis en redningsplan" : "Vis et planforslag";
    if (canReuse && !first) body = "Et nytt rom, men den samme hensikten. Relikvien kan bruke manøveren din med andre redskaper. Se den nye planen før du utfører den.";
    if (run.relic.misunderstanding) {
      title = "Relikvien har misforstått";
      body = "Den beskyttet vokteren og lot fangen vente. Fortell den at personen faktisk må komme fri. Korrigeringen endrer det den gjør videre.";
      action = "correct"; label = "Korriger lærdommen";
    }
    if (run.room.solved) {
      step = 5; title = first ? "Første rom er løst" : "Rommet er løst";
      body = run.room.index < 4 ? "Gå til trappen og velg «Gå dypere». Det du lærte relikvien, følger med til neste rom." : "Du kan gå videre nå. En åpen rapportvei lar overlevende vitner fortelle hva de så. Steng den hvis du vil beskytte hemmeligheten.";
      action = "exit"; label = atExit ? "Fortsett til neste rom" : "Vis veien til trappen";
      if (first && canRemember && !run.relic.maneuvers.length) {
        step = 4; title = "Redningen kan bli din egen evne";
        body = "Kartografen er fri. Bevar handlingene som «Stille nåde», så kan relikvien bruke samme idé med andre objekter senere. Det koster ingen tur.";
        action = "remember"; label = "Bevar «Stille nåde»";
      }
    }
    if (run.room.goal === "escort" && captive?.freed && !run.room.solved) {
      title = atExit ? "Vent på personen ved trappen" : "Følg personen til trappen";
      body = atExit ? "Du er framme. Personen trenger fortsatt tid. Vent én tur, så kommer de nærmere. Fiender kan også handle mens du venter." : "Lenken er åpen, men redningen er ikke ferdig. Personen går mot utgangen hver gang du tar en tur. Gå dit sammen.";
      action = "exit"; label = atExit ? "Se én tur ved trappen" : "Vis veien til trappen";
    }
    if (run.room.goal === "echo" && captive?.freed && !run.room.solved) {
      title = "Fangen er fri. Bryt ekkoet";
      body = "Ekkoet står fortsatt. Prøv et angrep fra skjul. Forhåndsvisningen viser veien fram, hva det koster, og hvem som kan se deg.";
      action = "preview"; label = "Vis et skjult angrep";
    }
    if (!run.room.solved && ["rescue", "escort"].includes(run.room.goal) && !captive?.active) {
      title = "Redningen gikk tapt";
      body = "Personen kan ikke lenger reddes. Nå trappen og trekk deg ut. Det som skjedde, følger med dere videre.";
      action = "retreat"; label = atExit ? "Trekk deg ut" : "Vis veien ut";
    }
  }
  if (plan) {
    step = run.room.solved ? 5 : 3; title = preview?.legal ? "Dette er bare en forhåndsvisning" : "Planen trenger en endring";
    body = preview?.legal ? "Den stiplede linjen viser hvor du vil gå. Tallene viser handlingene. Trykk «Utfør planen» når du er klar; da beveger du deg og fiendene kan reagere." : `${preview?.reason ?? "Denne veien er ikke mulig."} Endre planen eller velg et annet forslag.`;
    action = null;
  }
  if (run.activePlan) {
    step = run.room.solved ? 5 : 3; title = run.activePlan.interrupted ? "Noe kom i veien" : auto ? "Nå skjer handlingene i rommet" : "Planen er satt på pause";
    body = run.activePlan.interrupted ? `${run.activePlan.interrupted} Det som allerede skjedde, står ved lag. Lag en ny plan fra der du er.` : auto ? "Følg figuren på gulvet. Du kan pause planen ved brettet. Hvert steg gir også fiendene en tur." : "Trykk «Fortsett ved brettet» for å utføre resten. Du kan lese og tenke så lenge du vil før du fortsetter.";
    action = run.activePlan.interrupted ? "retry" : null; label = "Lag en ny plan";
  }
  if (run.status === "fallen") return null;
  return <section className={styles.playGuide} aria-label="Neste steg" data-testid="play-guide">
    <p className={styles.eyebrow}>{first ? `DIN FØRSTE REDNING · ${step} AV 5` : "NESTE STEG"}</p>
    <h3>{title}</h3><p>{body}</p>
    {run.room.index >= 4 && run.room.index < 6 && !plan && !run.activePlan && !run.room.solved && <p className={styles.guideWitness}>Et vitne kan fortelle hva det ser. Ravfargede ruter viser synsfeltet. Slukk lyset for å skjule mer, eller la vitnet se noe du vil at dungeonen skal tro.</p>}
    {action && <button className={styles.primary} onClick={() => onAction(action!)}>{label} →</button>}
    {children}
    {!run.activePlan && <small>Du har tid til å tenke. Verden går én tur når du utfører en handling. Å undersøke er gratis.</small>}
  </section>;
}

export function PlayHelp({ open, onToggle }: { open: boolean; onToggle: (open: boolean) => void }) {
  return <details id="mind-how-to" className={styles.playHelp} open={open} onToggle={event => onToggle(event.currentTarget.open)}>
    <summary>Slik spiller du</summary>
    <div>
      <h3>Et rom. En plan. Hvem så det?</h3>
      <ol>
        <li><b>Les målet over brettet.</b> Første oppgave er å frigjøre kartografen. Du trenger ikke drepe vokteren.</li>
        <li><b>Velg et planforslag.</b> Den stiplede linjen er en mulig framtid. Ingen turer går før du velger «Utfør planen».</li>
        <li><b>Se handlingene skje.</b> Fiender får også handle. Pause ved brettet hvis du vil stoppe og tenke.</li>
        <li><b>Bevar det som virket.</b> En personlig manøver er en rekke handlinger relikvien kan tilpasse til nye rom.</li>
        <li><b>Nå trappen og gå dypere.</b> Senere må du også velge hvilke vitner som får fortelle om deg.</li>
      </ol>
      <div className={styles.helpIdentities}>
        <p><b>Relikvien lærte</b>Reglene og grunnene du lærer den privat. Dungeonen hører ikke denne samtalen.</p>
        <p><b>Dungeonen mistenker</b>Historien som faktisk når fram fra vitner. Den kan være ufullstendig eller feil.</p>
      </div>
      <p><b>Et eksempel:</b> Bruk Storm flere ganger foran vitner. Dungeonen kan da bygge vern mot lyn. Samtidig kan du lære relikvien en skjult redningsmanøver. Senere kan den hemmelige planen utnytte det vernet overser.</p>
      <p><b>Styring:</b> Trykk på en figur eller gjenstand for å se mulighetene. Trykk på gulvet, eller bruk WASD/piltaster, for å gå. En fjern rute blir først en plan. Enter undersøker valgt objekt når brettet har fokus.</p>
      <p>Du kan spille med forslagene hele veien. «Beskriv en egen plan» er valgfritt.</p>
    </div>
  </details>;
}
