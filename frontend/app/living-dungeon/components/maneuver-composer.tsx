"use client";

import { useId, type FormEvent } from "react";
import styles from "./intent-to-world.module.css";

export type ManeuverPreviewStep = Readonly<{
  id: string;
  title: string;
  detail?: string;
}>;

export type ManeuverPreviewCost = Readonly<{
  label: string;
  value: string;
}>;

export type ManeuverPreviewRisk = Readonly<{
  level: "low" | "medium" | "high";
  label: string;
  detail?: string;
}>;

export type ManeuverPreviewWatcher = Readonly<{
  name: string;
  observation: string;
  possibleBelief?: string;
}>;

export type CompiledManeuverPreview = Readonly<{
  title: string;
  summary?: string;
  steps: readonly ManeuverPreviewStep[];
  costs: readonly ManeuverPreviewCost[];
  risk: ManeuverPreviewRisk;
  watcher?: ManeuverPreviewWatcher | null;
}>;

export type AuthoredManeuverChoice = Readonly<{
  id: string;
  title: string;
  description: string;
}>;

export type ManeuverComposerProps = Readonly<{
  language?: "en" | "no";
  plan: string;
  preview?: CompiledManeuverPreview | null;
  compiling?: boolean;
  error?: string | null;
  maxLength?: number;
  disabled?: boolean;
  fallbackChoices?: readonly AuthoredManeuverChoice[];
  onPlanChange: (plan: string) => void;
  onCompile: (plan: string) => void | Promise<void>;
  onPlay: () => void | Promise<void>;
  onRevise: () => void;
  onFightNormally: () => void | Promise<void>;
  onFallbackChoice?: (choiceId: string) => void;
}>;

const COPY = {
  en: {
    eyebrow: "Turn intent into action",
    heading: "How will you make it happen?",
    intro: "Use the named objects in the room. The game will compile your idea into actions it actually supports.",
    label: "Describe your maneuver",
    placeholder: "I roll the loose barrel past the brazier, then move behind the guard while they watch the flames.",
    compile: "Preview the plan",
    compiling: "Checking the plan…",
    disclosure: "Your text is sent to OpenAI for interpretation. It is not stored in this expedition.",
    fight: "Fight normally",
    exact: "Exact compiled preview",
    trust: "Only the steps below will happen in the game.",
    cost: "Cost",
    noCost: "No resource cost",
    risk: "Success chance",
    watcher: "Watcher",
    belief: "Possible belief",
    play: "Play this maneuver",
    revise: "Revise",
    fallback: "Use an authored approach instead",
    characters: "characters left",
  },
  no: {
    eyebrow: "Gjør hensikt til handling",
    heading: "Hvordan vil du få det til?",
    intro: "Bruk de navngitte tingene i rommet. Spillet oversetter ideen til handlinger det faktisk støtter.",
    label: "Beskriv manøveren din",
    placeholder: "Jeg ruller den løse tønna forbi fyrfatet og går bak vakten mens den følger flammene.",
    compile: "Forhåndsvis planen",
    compiling: "Kontrollerer planen…",
    disclosure: "Teksten du skriver sendes til OpenAI for tolkning. Den lagres ikke i ekspedisjonen.",
    fight: "Slåss som normalt",
    exact: "Eksakt forhåndsvisning",
    trust: "Bare trinnene nedenfor skjer i spillet.",
    cost: "Kostnad",
    noCost: "Ingen ressurskostnad",
    risk: "Sjanse for å lykkes",
    watcher: "Vitne",
    belief: "Mulig oppfatning",
    play: "Utfør manøveren",
    revise: "Endre",
    fallback: "Bruk en håndskrevet løsning i stedet",
    characters: "tegn igjen",
  },
} as const;

export function ManeuverComposer({
  language = "en",
  plan,
  preview = null,
  compiling = false,
  error = null,
  maxLength = 320,
  disabled = false,
  fallbackChoices = [],
  onPlanChange,
  onCompile,
  onPlay,
  onRevise,
  onFightNormally,
  onFallbackChoice,
}: ManeuverComposerProps) {
  const copy = COPY[language];
  const headingId = useId();
  const inputId = useId();
  const statusId = useId();
  const disclosureId = useId();
  const remaining = maxLength - Array.from(plan).length;
  const unavailable = disabled || compiling;
  const canCompile = !unavailable && plan.trim().length > 0 && remaining >= 0;

  const compile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = plan.trim().replace(/\s+/gu, " ");
    if (canCompile && normalized) void onCompile(normalized);
  };

  return <section className={`${styles.surface} ${styles.maneuverCard}`} aria-labelledby={headingId}>
    <header className={styles.maneuverHeader}>
      <p className={styles.eyebrow}>{copy.eyebrow}</p>
      <h2 id={headingId}>{copy.heading}</h2>
      <p>{copy.intro}</p>
    </header>

    <form className={styles.planForm} onSubmit={compile} aria-busy={compiling} data-keyboard-actions>
      <label className={styles.planLabel} htmlFor={inputId}>{copy.label}</label>
      <textarea
        className={styles.planTextarea}
        id={inputId}
        value={plan}
        maxLength={maxLength}
        rows={4}
        placeholder={copy.placeholder}
        disabled={unavailable}
        aria-describedby={`${statusId} ${disclosureId}`}
        aria-invalid={Boolean(error)}
        onChange={event => onPlanChange(event.target.value)}
      />
      <p className={styles.aiDisclosure} id={disclosureId}>{copy.disclosure}</p>
      <div className={styles.composerMeta} id={statusId} aria-live="polite">
        <span className={error ? styles.errorText : compiling ? styles.loadingText : undefined}>
          {error || (compiling ? copy.compiling : "")}
        </span>
        <span>{Math.max(0, remaining)} {copy.characters}</span>
      </div>
      <div className={styles.formActions} data-keyboard-actions>
        <button className={styles.primaryButton} type="submit" disabled={!canCompile} data-keyboard-default={!preview && canCompile ? "true" : undefined}>{copy.compile}</button>
        <button className={styles.quietButton} type="button" disabled={unavailable} onClick={() => void onFightNormally()}>{copy.fight}</button>
      </div>
    </form>

    {preview && <article className={styles.preview} aria-labelledby={`${headingId}-preview`}>
      <p className={styles.previewTrust}>{copy.exact}</p>
      <h3 id={`${headingId}-preview`}>{preview.title}</h3>
      <p className={styles.previewSummary}>{copy.trust}{preview.summary ? ` ${preview.summary}` : ""}</p>

      <ol className={styles.stepList}>
        {preview.steps.map(step => <li key={step.id}>
          <div><strong>{step.title}</strong>{step.detail && <span>{step.detail}</span>}</div>
        </li>)}
      </ol>

      <div className={styles.consequenceGrid}>
        <section className={styles.consequence} aria-label={copy.cost}>
          <span className={styles.consequenceLabel}>{copy.cost}</span>
          {preview.costs.length > 0
            ? preview.costs.map(cost => <div key={`${cost.label}:${cost.value}`}><strong>{cost.value}</strong><p>{cost.label}</p></div>)
            : <strong>{copy.noCost}</strong>}
        </section>
        <section className={styles.consequence} data-risk={preview.risk.level} aria-label={copy.risk}>
          <span className={styles.consequenceLabel}>{copy.risk}</span>
          <strong>{preview.risk.label}</strong>
          {preview.risk.detail && <p>{preview.risk.detail}</p>}
        </section>
        <section className={styles.consequence} aria-label={copy.watcher}>
          <span className={styles.consequenceLabel}>{copy.watcher}</span>
          <strong>{preview.watcher?.name ?? "—"}</strong>
          {preview.watcher?.observation && <p>{preview.watcher.observation}</p>}
        </section>
      </div>

      {preview.watcher?.possibleBelief && <aside className={styles.beliefBox}>
        <strong>{copy.belief}:</strong> {preview.watcher.possibleBelief}
      </aside>}

      <div className={styles.previewActions} data-keyboard-actions>
        <button className={styles.primaryButton} type="button" disabled={unavailable} data-keyboard-default="true" onClick={() => void onPlay()}>{copy.play}</button>
        <button className={styles.secondaryButton} type="button" disabled={unavailable} onClick={onRevise}>{copy.revise}</button>
        <button className={styles.quietButton} type="button" disabled={unavailable} onClick={() => void onFightNormally()}>{copy.fight}</button>
      </div>
    </article>}

    {fallbackChoices.length > 0 && <details className={styles.fallbacks} open={Boolean(error) || !preview}>
      <summary>{copy.fallback}</summary>
      <ul className={styles.fallbackList} data-keyboard-actions>
        {fallbackChoices.map((choice, index) => <li key={choice.id}>
          <button
            className={styles.fallbackChoice}
            type="button"
            disabled={unavailable || !onFallbackChoice}
            data-keyboard-default={!preview && !canCompile && index === 0 ? "true" : undefined}
            onClick={() => onFallbackChoice?.(choice.id)}
          >
            <strong>{choice.title}</strong>
            <span>{choice.description}</span>
          </button>
        </li>)}
      </ul>
    </details>}
  </section>;
}
