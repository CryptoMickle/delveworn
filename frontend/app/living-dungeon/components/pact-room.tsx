"use client";

import { useEffect, useRef, useState } from "react";
import {
  LIVING_DUNGEON_PROPOSAL_MAX_CHARACTERS,
  type InterpretFallbackReason,
  type InterpretPactIntentReply,
  type InterpretPactIntentRequest,
} from "../ai-contract";
import {
  trackLivingDungeon,
  type LivingDungeonInputMethod,
  type LivingDungeonLatencyBucket,
  type LivingDungeonSuggestionId,
} from "../analytics";
import { livingDungeonPactEligibility, transitionLivingDungeon } from "../engine";
import { PACT_RESTRICTIONS, eligibleSacrifices } from "../pact-catalogue";
import { pactEligibilityDigest } from "../pact-engine";
import {
  PACT_DESIRED_BOONS,
  type PactDesiredBoon,
  type PactIntent,
  type PactSacrifice,
} from "../pact-schema";
import type { LivingDungeon, LivingDungeonCommand } from "../model";
import { ExactPactRuleCard } from "./exact-pact-rule-card";

const BOON_LABELS: Record<PactDesiredBoon, string> = {
  DEFENSE: "Protection from the boss's first retaliation",
  DAMAGE: "More damage at the start of the boss fight",
  ENTRY_HEAL: "Healing when the boss room opens",
};

const BOON_REQUESTS: Record<PactDesiredBoon, string> = {
  DEFENSE: "protection from the boss's first retaliation",
  DAMAGE: "stronger opening attacks against the boss",
  ENTRY_HEAL: "healing when the boss room opens",
};

const SACRIFICE_REQUESTS: Record<PactSacrifice, string> = {
  NO_STORM: "leave Storm unused",
  NO_VOLUNTARY_HEALING: "avoid voluntary healing",
  NO_CAMP_PURCHASE: "buy nothing at camp",
};

const STANDARD_INTENTS: readonly { title: string; detail: string; intent: PactIntent }[] = [
  {
    title: "A ward for a silent storm",
    detail: "Give up Storm until the boss in exchange for protection from its first retaliation.",
    intent: { desiredBoon: "DEFENSE", offeredSacrifice: "NO_STORM", durationPreference: "UNTIL_BOSS", breachTolerance: "HIGH", needsClarification: false },
  },
  {
    title: "Power carried through pain",
    detail: "Give up voluntary healing in exchange for a stronger opening against the boss.",
    intent: { desiredBoon: "DAMAGE", offeredSacrifice: "NO_VOLUNTARY_HEALING", durationPreference: "UNTIL_BOSS", breachTolerance: "HIGH", needsClarification: false },
  },
  {
    title: "Mercy beyond the empty stall",
    detail: "Buy nothing at camp in exchange for healing when you enter the boss room.",
    intent: { desiredBoon: "ENTRY_HEAL", offeredSacrifice: "NO_CAMP_PURCHASE", durationPreference: "UNTIL_BOSS", breachTolerance: "HIGH", needsClarification: false },
  },
];

const SUGGESTIONS: readonly { id: LivingDungeonSuggestionId; text: string }[] = [
  { id: "protection", text: "Protect me from the boss's first hit; I won't use Storm." },
  { id: "damage", text: "Make my opening attacks stronger; I won't heal myself." },
  { id: "potions", text: "Heal me before the boss; I won't buy anything at camp." },
] as const;

type ConversationEntry = Readonly<{
  id: number;
  role: "player" | "keeper" | "system";
  text: string;
  pending?: boolean;
}>;

function offerSeed(run: LivingDungeon, offset = 0): number {
  return (run.seed ^ Math.imul(run.revision + 1 + offset, 0x45d9f3b)) >>> 0;
}

function keeperUnderstanding(intent: PactIntent): string {
  return `I understand: you want ${BOON_REQUESTS[intent.desiredBoon]}. In return, you will ${SACRIFICE_REQUESTS[intent.offeredSacrifice]} until the boss falls. Check the exact game rule below.`;
}

function latencyBucket(milliseconds: number): LivingDungeonLatencyBucket {
  if (milliseconds < 1_000) return "under_1s";
  if (milliseconds < 2_500) return "1_to_2_5s";
  if (milliseconds < 4_000) return "2_5_to_4s";
  return "over_4s";
}

function analyticsNow(): number {
  return globalThis.performance.now();
}

export function PactRoom({ run, onCommand }: Readonly<{
  run: LivingDungeon;
  onCommand: (command: LivingDungeonCommand) => Promise<boolean>;
}>) {
  const [proposal, setProposal] = useState("");
  const [boon, setBoon] = useState<PactDesiredBoon>("DEFENSE");
  const [sacrifice, setSacrifice] = useState<PactSacrifice>("NO_STORM");
  const [interpreting, setInterpreting] = useState(false);
  const [manualOpen, setManualOpen] = useState(run.pactInterpretationAttempts >= 2);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [retryReason, setRetryReason] = useState<InterpretFallbackReason | null>(null);
  const [currentInputMethod, setCurrentInputMethod] = useState<LivingDungeonInputMethod>("free_text");
  const [offerInputMethod, setOfferInputMethod] = useState<LivingDungeonInputMethod>("free_text");
  const [conversation, setConversation] = useState<readonly ConversationEntry[]>([]);
  const latestRun = useRef(run);
  const nextMessageId = useRef(0);
  const conversationTracked = useRef(false);
  const fallbackChoiceTracked = useRef(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const manualBuilder = useRef<HTMLElement>(null);

  useEffect(() => { latestRun.current = run; }, [run]);
  useEffect(() => {
    if (conversationTracked.current) return;
    conversationTracked.current = true;
    trackLivingDungeon("conversation_opened", { room: "pact-room", opened_by: "automatic" });
  }, []);

  const snapshot = livingDungeonPactEligibility(run);
  const sacrifices = eligibleSacrifices(snapshot);
  const canPrepare = run.pactOfferAttempts < 2;
  const aiAvailable = canPrepare && run.pactInterpretationAttempts < 2;
  const nearCharacterLimit = Array.from(proposal).length >= LIVING_DUNGEON_PROPOSAL_MAX_CHARACTERS - 80;

  const appendMessage = (entry: Omit<ConversationEntry, "id">): number => {
    const id = ++nextMessageId.current;
    setConversation(current => [...current, { ...entry, id }]);
    return id;
  };

  const replaceMessage = (id: number, entry: Omit<ConversationEntry, "id">) => {
    setConversation(current => current.map(message => message.id === id ? { ...entry, id } : message));
  };

  const revealManualBuilder = (focus = false) => {
    setManualOpen(true);
    if (focus) window.requestAnimationFrame(() => manualBuilder.current?.focus());
  };

  const recordFallbackChoice = (destination: "ready_made" | "retry") => {
    if (!retryReason || fallbackChoiceTracked.current) return;
    fallbackChoiceTracked.current = true;
    trackLivingDungeon("fallback_used", { reason: retryReason, destination });
  };

  const prepare = async (
    intent: PactIntent,
    seed = offerSeed(latestRun.current),
    replyId?: number,
    method: LivingDungeonInputMethod = currentInputMethod,
    isRevision = latestRun.current.pendingOffer !== null,
  ) => {
    const answer = (entry: Omit<ConversationEntry, "id">) => replyId ? replaceMessage(replyId, entry) : appendMessage(entry);
    const current = latestRun.current;
    if (current.pactOfferAttempts >= 2) {
      answer({ role: "system", text: "You have already changed these terms once. Accept the current pact or leave the room." });
      return;
    }
    const changed = await onCommand({ type: "prepare-pact", intent, offerSeed: seed });
    if (changed) {
      answer({ role: "keeper", text: keeperUnderstanding(intent) });
      setOfferInputMethod(method);
      setRetryAvailable(false);
      setRetryReason(null);
      if (isRevision) {
        trackLivingDungeon("rule_revised", { input_method: method, revision_number: 1 });
      }
      if (method === "ready_made" || method === "custom_menu") {
        trackLivingDungeon("interpretation_returned", {
          source: "menu",
          input_method: method,
          result: "offer",
          attempt: current.pactOfferAttempts === 0 ? 1 : 2,
          latency: "under_1s",
        });
      }
      return;
    }
    answer({ role: "system", text: "Those terms cannot be formed from the rules available in this room. Your request is still in the composer below." });
    revealManualBuilder();
  };

  const interpret = async () => {
    const text = proposal.trim();
    if (!text || interpreting) return;
    if (!aiAvailable) {
      appendMessage({ role: "system", text: "The Keeper cannot interpret another request in this room. Your words are still here; choose the exact terms below." });
      revealManualBuilder(true);
      return;
    }
    if (sacrifices.length === 0) {
      appendMessage({ role: "system", text: "There is no meaningful promise left to offer in this expedition. You may leave without a pact." });
      revealManualBuilder();
      return;
    }

    setInterpreting(true);
    recordFallbackChoice("retry");
    fallbackChoiceTracked.current = false;
    setRetryAvailable(false);
    setRetryReason(null);
    appendMessage({ role: "player", text });
    const replyId = appendMessage({ role: "keeper", text: "The Keeper weighs your words…", pending: true });
    const beforeAttempt = latestRun.current;
    const hadPendingOffer = beforeAttempt.pendingOffer !== null;
    const attemptCommand = { type: "record-pact-interpretation" } as const;
    const captured = transitionLivingDungeon(beforeAttempt, attemptCommand, beforeAttempt.revision);
    const attemptRecorded = captured !== beforeAttempt && await onCommand(attemptCommand);
    if (!attemptRecorded) {
      replaceMessage(replyId, { role: "system", text: "The interpretation limit has been reached. Your words are still here; choose the exact terms below." });
      revealManualBuilder();
      setInterpreting(false);
      return;
    }

    latestRun.current = captured;
    const capturedSnapshot = livingDungeonPactEligibility(captured);
    const seed = offerSeed(captured, captured.pactOfferAttempts);
    const body: InterpretPactIntentRequest = {
      proposal: text,
      eligibility: { desiredBoons: PACT_DESIRED_BOONS, sacrifices },
      runRevision: captured.revision,
      stateDigest: pactEligibilityDigest(capturedSnapshot),
      offerSeed: seed,
    };
    const requestStartedAt = analyticsNow();
    const attempt = captured.pactInterpretationAttempts === 1 ? 1 : 2;

    try {
      const response = await fetch("/api/living-dungeon/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("interpretation rejected");
      const reply = await response.json() as InterpretPactIntentReply;
      const current = latestRun.current;
      if (current.revision !== reply.binding.runRevision
        || pactEligibilityDigest(livingDungeonPactEligibility(current)) !== reply.binding.stateDigest) {
        replaceMessage(replyId, { role: "system", text: "The room changed before the answer returned. Your words are still here; try again with the current state." });
        setRetryAvailable(current.pactInterpretationAttempts < 2);
        setRetryReason("provider_unavailable");
        return;
      }
      if (reply.status === "fallback") {
        trackLivingDungeon("interpretation_returned", { source: "fallback", input_method: currentInputMethod, result: "fallback", attempt, latency: latencyBucket(analyticsNow() - requestStartedAt) });
        replaceMessage(replyId, { role: "system", text: "The Keeper could not shape that request right now. Your words are still here, and every legal pact is available below." });
        setRetryAvailable(current.pactInterpretationAttempts < 2);
        setRetryReason(reply.reason);
        revealManualBuilder();
        return;
      }
      if (reply.intent.needsClarification) {
        trackLivingDungeon("interpretation_returned", { source: "ai", input_method: currentInputMethod, result: "clarification", attempt, latency: latencyBucket(analyticsNow() - requestStartedAt) });
        if (current.pactClarificationAttempts >= 1) {
          replaceMessage(replyId, { role: "keeper", text: "I still cannot bind both sides of that bargain. Choose the exact power and promise below; your words remain in the composer." });
          revealManualBuilder();
        } else {
          const recorded = await onCommand({ type: "record-pact-clarification" });
          if (recorded) trackLivingDungeon("clarification_requested", { reason: "ambiguous", attempt: 1 });
          replaceMessage(replyId, recorded
            ? { role: "keeper", text: "I need both halves of the bargain. Tell me what power you want and what you will give up until the boss falls." }
            : { role: "system", text: "The room could not hold that clarification. Your words are still here; choose the exact terms below." });
          if (!recorded) revealManualBuilder();
          else window.requestAnimationFrame(() => composer.current?.focus());
        }
        return;
      }
      trackLivingDungeon("interpretation_returned", { source: "ai", input_method: currentInputMethod, result: "offer", attempt, latency: latencyBucket(analyticsNow() - requestStartedAt) });
      await prepare(reply.intent, reply.binding.offerSeed, replyId, currentInputMethod, hadPendingOffer);
    } catch {
      const current = latestRun.current;
      trackLivingDungeon("interpretation_returned", { source: "fallback", input_method: currentInputMethod, result: "fallback", attempt, latency: latencyBucket(analyticsNow() - requestStartedAt) });
      replaceMessage(replyId, { role: "system", text: "The Keeper could not shape that request right now. Your words are still here." });
      setRetryAvailable(current.pactInterpretationAttempts < 2);
      setRetryReason("provider_unavailable");
      revealManualBuilder();
    } finally {
      setInterpreting(false);
    }
  };

  const chooseSuggestion = (suggestion: { id: LivingDungeonSuggestionId; text: string }) => {
    setCurrentInputMethod("suggestion");
    trackLivingDungeon("suggestion_used", { room: "pact-room", suggestion_id: suggestion.id });
    setProposal(suggestion.text);
    window.requestAnimationFrame(() => {
      composer.current?.focus();
      composer.current?.setSelectionRange(suggestion.text.length, suggestion.text.length);
    });
  };

  const changeRequest = () => {
    window.requestAnimationFrame(() => {
      composer.current?.focus();
      composer.current?.scrollIntoView({ block: "center" });
    });
  };

  const prepareManual = (intent: PactIntent, title: string, method: "ready_made" | "custom_menu") => {
    recordFallbackChoice("ready_made");
    setCurrentInputMethod(method);
    appendMessage({ role: "player", text: `Use the written pact: ${title}.` });
    const replyId = appendMessage({ role: "keeper", text: "The Keeper writes the terms…", pending: true });
    void prepare(intent, offerSeed(latestRun.current), replyId, method);
  };

  const declinePact = async () => {
    const hadOffer = Boolean(latestRun.current.pendingOffer);
    const declined = await onCommand({ type: "decline-pact" });
    if (declined && hadOffer) trackLivingDungeon("rule_rejected", { input_method: offerInputMethod, reason: "player_choice" });
  };

  return <section className="living-scene-panel living-pact-scene" aria-labelledby="living-pact-title">
    <header><div><p>SCENE 2 · THE PACT ROOM</p><h2 id="living-pact-title">Speak your bargain. Check the rule.</h2></div><span>Write as you would in ChatGPT. Nothing changes until you accept the exact game rule.</span></header>

    <div className="living-conversation-shell">
      <ol className="living-conversation" aria-label="Conversation with the Pact Keeper" aria-live="polite" aria-relevant="additions text">
        <li className="living-message-row" data-role="keeper">
          <article className="living-message living-message-keeper">
            <div className="living-message-avatar" aria-hidden="true">K</div>
            <div><p className="living-message-role">Pact Keeper</p><p>I can change one rule until the boss falls. Tell me what power you want — and what you will give up for it.</p></div>
          </article>
        </li>
        {conversation.map(message => <li className="living-message-row" data-role={message.role} key={message.id}>
          <article className={`living-message living-message-${message.role}`} aria-busy={message.pending || undefined}>
            {message.role === "keeper" && <div className="living-message-avatar" aria-hidden="true">K</div>}
            <div><p className="living-message-role">{message.role === "player" ? "You" : message.role === "keeper" ? "Pact Keeper" : "Game"}</p><p>{message.text}</p></div>
          </article>
        </li>)}
        {run.pendingOffer && <li className="living-transcript-rule">
          <ExactPactRuleCard run={run} onCommand={onCommand} onChangeRequest={changeRequest} onShowEveryPact={() => revealManualBuilder(true)} manualOpen={manualOpen} inputMethod={offerInputMethod} />
        </li>}
      </ol>

      <form className="living-composer" onSubmit={event => { event.preventDefault(); void interpret(); }}>
        <div className="living-composer-heading"><label htmlFor="living-pact-proposal">What do you want to try?</label><span>English or Norwegian works</span></div>
        <textarea
          ref={composer}
          id="living-pact-proposal"
          maxLength={LIVING_DUNGEON_PROPOSAL_MAX_CHARACTERS}
          value={proposal}
          disabled={interpreting}
          aria-describedby="living-pact-help living-pact-capability"
          onChange={event => { setCurrentInputMethod("free_text"); setProposal(event.target.value); }}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Describe the power you want and what you would give up…"
        />
        <div className="living-composer-meta" id="living-pact-help">
          <span>Enter sends · Shift+Enter adds a new line</span>
          {nearCharacterLimit && <span>{Array.from(proposal).length}/{LIVING_DUNGEON_PROPOSAL_MAX_CHARACTERS}</span>}
        </div>
        {conversation.length === 0 && <div className="living-suggestions" aria-label="Editable example requests">
          {SUGGESTIONS.map(suggestion => <button key={suggestion.id} type="button" disabled={interpreting} onClick={() => chooseSuggestion(suggestion)}>{suggestion.text}</button>)}
        </div>}
        <p className="living-capability" id="living-pact-capability">You can bargain for boss protection, stronger opening attacks or healing before the boss — in exchange for Storm, healing or shopping.</p>
        <div className="living-composer-actions living-actions" data-keyboard-actions>
          <button type="submit" className="living-primary" data-keyboard-default="true" disabled={interpreting || !proposal.trim() || !aiAvailable}>{interpreting ? "THE KEEPER IS THINKING…" : run.pendingOffer ? "SEND REVISION" : "SEND TO THE KEEPER"}</button>
          <button type="button" className="living-secondary" aria-expanded={manualOpen} aria-controls="living-pact-manual" onClick={() => revealManualBuilder(true)}>SEE EVERY POSSIBLE PACT</button>
        </div>
        {retryAvailable && aiAvailable && <div className="living-recovery-actions" data-keyboard-actions>
          <button type="button" className="living-secondary" onClick={() => { recordFallbackChoice("retry"); void interpret(); }}>TRY MY WORDS AGAIN</button>
        </div>}
      </form>

      {manualOpen && <section ref={manualBuilder} tabIndex={-1} className="living-manual-builder" id="living-pact-manual" aria-labelledby="living-pact-manual-title">
        <div className="living-manual-heading"><div><p className="living-card-kicker">READY-MADE RULES</p><h3 id="living-pact-manual-title">Build the pact yourself</h3></div><button type="button" aria-label="Close ready-made pact choices" onClick={() => setManualOpen(false)}>×</button></div>
        <p>Your draft remains in the composer. These choices use the same rules and produce the same exact card.</p>
        <div className="living-standard-offers" data-keyboard-actions>{STANDARD_INTENTS.map(entry => <button key={entry.title} type="button" onClick={() => prepareManual(entry.intent, entry.title, "ready_made")} disabled={!canPrepare || !sacrifices.includes(entry.intent.offeredSacrifice)}><strong>{entry.title}</strong><span>{entry.detail}</span></button>)}</div>
        <div className="living-menu-grid">
          <div><label htmlFor="living-manual-boon">Power</label><select id="living-manual-boon" value={boon} onChange={event => setBoon(event.target.value as PactDesiredBoon)}>{PACT_DESIRED_BOONS.map(id => <option key={id} value={id}>{BOON_LABELS[id]}</option>)}</select></div>
          <div><label htmlFor="living-manual-sacrifice">Promise</label><select id="living-manual-sacrifice" value={sacrifice} onChange={event => setSacrifice(event.target.value as PactSacrifice)}>{sacrifices.map(id => <option key={id} value={id}>{PACT_RESTRICTIONS[id].rule}</option>)}</select></div>
        </div>
        <div className="living-actions" data-keyboard-actions><button type="button" className="living-secondary" data-keyboard-default="true" disabled={!canPrepare || sacrifices.length === 0} onClick={() => prepareManual({ desiredBoon: boon, offeredSacrifice: sacrifice, durationPreference: "UNTIL_BOSS", breachTolerance: "HIGH", needsClarification: false }, "my selected power and promise", "custom_menu")}>{run.pendingOffer ? "PREVIEW THESE NEW TERMS" : "PREVIEW THESE TERMS"}</button></div>
      </section>}

      <p className="living-conversation-trust"><strong>The Keeper interprets your words.</strong> The exact game rule decides what happens.</p>
      <div className="living-pact-exit living-actions" data-keyboard-actions><button type="button" className="living-secondary" onClick={() => void declinePact()}>LEAVE WITHOUT A PACT</button></div>
    </div>
  </section>;
}
