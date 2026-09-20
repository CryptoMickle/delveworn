"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import styles from "./intent-to-world.module.css";

export type ThresholdIntentSuggestion = Readonly<{
  id: string;
  label: string;
  statement: string;
}>;

export type ThresholdIntentComposerProps = Readonly<{
  language?: "en" | "no";
  suggestions?: readonly ThresholdIntentSuggestion[];
  initialStatement?: string;
  maxLength?: number;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  onSubmit: (statement: string) => void | Promise<void>;
}>;

const COPY = {
  en: {
    eyebrow: "Your intent",
    heading: "What kind of victory are you after?",
    intro: "Describe the outcome you want. The dungeon will show what it can turn into before anything happens.",
    label: "Describe your intended victory",
    placeholder: "I want to reach the door without the watcher learning how I fight…",
    submit: "Send intent",
    hint: "Enter to send · Shift + Enter for a new line",
    disclosure: "Your text is sent to OpenAI for interpretation. It is not stored in this expedition.",
    loading: "The dungeon is reading the room…",
    suggestions: [
      { id: "unseen", label: "Win without being seen", statement: "I want to get through without the watcher seeing what I can do." },
      { id: "room", label: "Turn the room against them", statement: "I want to use the room itself to defeat the guard." },
      { id: "truth", label: "Learn who is watching", statement: "I want to find out who is watching before I commit to a fight." },
    ],
  },
  no: {
    eyebrow: "Din hensikt",
    heading: "Hva slags seier er du ute etter?",
    intro: "Beskriv resultatet du ønsker. Dungeonen viser hva det kan bli til før noe skjer.",
    label: "Beskriv seieren du ønsker",
    placeholder: "Jeg vil nå døren uten at vitnet lærer hvordan jeg kjemper…",
    submit: "Send hensikt",
    hint: "Enter sender · Shift + Enter gir ny linje",
    disclosure: "Teksten du skriver sendes til OpenAI for tolkning. Den lagres ikke i ekspedisjonen.",
    loading: "Dungeonen leser rommet…",
    suggestions: [
      { id: "unseen", label: "Vinn uten å bli sett", statement: "Jeg vil komme meg gjennom uten at vitnet ser hva jeg kan gjøre." },
      { id: "room", label: "Vend rommet mot dem", statement: "Jeg vil bruke selve rommet til å beseire vakten." },
      { id: "truth", label: "Finn ut hvem som følger med", statement: "Jeg vil finne ut hvem som følger med før jeg velger å slåss." },
    ],
  },
} as const;

export function ThresholdIntentComposer({
  language = "en",
  suggestions,
  initialStatement = "",
  maxLength = 320,
  loading = false,
  error = null,
  disabled = false,
  onSubmit,
}: ThresholdIntentComposerProps) {
  const copy = COPY[language];
  const choices = suggestions ?? copy.suggestions;
  const [statement, setStatement] = useState(initialStatement);
  const headingId = useId();
  const inputId = useId();
  const statusId = useId();
  const disclosureId = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const remaining = maxLength - Array.from(statement).length;
  const unavailable = disabled || loading;
  const canSubmit = !unavailable && statement.trim().length > 0 && remaining >= 0;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = statement.trim().replace(/\s+/gu, " ");
    if (!canSubmit || !normalized) return;
    void onSubmit(normalized);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return <section className={`${styles.surface} ${styles.intentCard}`} aria-labelledby={headingId}>
    <header className={styles.intentHeader}>
      <p className={styles.eyebrow}>{copy.eyebrow}</p>
      <h2 id={headingId}>{copy.heading}</h2>
      <p>{copy.intro}</p>
    </header>

    <form onSubmit={submit} aria-busy={loading} data-keyboard-actions>
      <label className={styles.visuallyHidden} htmlFor={inputId}>{copy.label}</label>
      <div className={styles.promptShell}>
        <textarea
          ref={input}
          id={inputId}
          value={statement}
          maxLength={maxLength}
          rows={2}
          placeholder={copy.placeholder}
          disabled={unavailable}
          aria-describedby={`${statusId} ${disclosureId}`}
          aria-invalid={Boolean(error)}
          onChange={event => setStatement(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className={styles.sendButton}
          type="submit"
          disabled={!canSubmit}
          aria-label={copy.submit}
          data-keyboard-default={canSubmit ? "true" : undefined}
        >
          <span aria-hidden="true">{loading ? "•••" : "↑"}</span>
        </button>
      </div>
      <p className={styles.aiDisclosure} id={disclosureId}>{copy.disclosure}</p>
      <div className={styles.composerMeta} id={statusId} aria-live="polite">
        <span className={error ? styles.errorText : loading ? styles.loadingText : undefined}>
          {error || (loading ? copy.loading : copy.hint)}
        </span>
        <span>{Math.max(0, remaining)}</span>
      </div>
    </form>

    {choices.length > 0 && <ul className={styles.suggestionList} aria-label={language === "no" ? "Forslag" : "Suggestions"} data-keyboard-actions>
      {choices.map((choice, index) => <li key={choice.id}>
        <button
          type="button"
          className={styles.suggestionButton}
          disabled={unavailable}
          data-keyboard-default={!canSubmit && index === 0 ? "true" : undefined}
          onClick={() => {
            setStatement(choice.statement.slice(0, maxLength));
            window.requestAnimationFrame(() => input.current?.focus());
          }}
        >{choice.label}</button>
      </li>)}
    </ul>}
  </section>;
}
