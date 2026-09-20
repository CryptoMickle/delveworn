/** All mechanics are expressed in this closed language. Text is never executable. */
export const OPS = ["MOVE", "ATTACK", "STORM", "POTION", "PROTECT", "DISTRACT", "HIDE", "OBSERVE", "CREATE_NOISE", "EXTINGUISH_LIGHT", "RELEASE", "TRANSFER_ITEM", "REVEAL_EVIDENCE", "PLANT_EVIDENCE", "REPORT", "INTERRUPT_REPORT", "RETREAT", "WAIT"] as const;
export type Verb = typeof OPS[number];
export type Point = { x: number; y: number };
export type Signature = "mercy" | "storm" | "force" | "cunning" | "self-preservation";
export type PrincipleId = "protect" | "no-harm" | "promise" | "survive" | "investigate" | "last-potion";
export type Scope = "always" | "innocent-at-risk" | "no-one-else-hurt" | "suspicious-offer";
export type Role = "player" | "guardian" | "captive" | "observer" | "distraction" | "light" | "relay" | "exit" | "evidence" | "cover" | "echo";
export type Operation = { verb: Verb; target?: string; at?: Point; signature?: Signature };
export type Entity = Point & { id: string; name: string; role: Role; hp: number; maxHp: number; active: boolean; freed: boolean; sight: number; distracted: number; protected: number; hidden: boolean; suspicious: boolean; credibility: number; intent: "watch" | "hunt" | "report" | "flee"; goal?: Point };
export type Family = "bell" | "kiln" | "archive" | "bridge" | "garden" | "tribunal" | "reservoir" | "echo";
export type ComponentId = "storm-ward" | "hostage-thread" | "echo-snare" | "iron-mirror" | "thirst-trap";
export type BossComponent = { id: ComponentId; cost: number; sources: string[]; theory: Signature; confidence: number };
export type Room = { id: string; index: number; act: number; family: Family; goal: "rescue" | "escort" | "evidence" | "story" | "echo"; title: string; subtitle: string; objective: string; width: number; height: number; walls: Point[]; shadows: Point[]; hazards: Point[]; entities: Entity[]; turn: number; solved: boolean; escaped: boolean; light: boolean; alert: number; reportDelay: number; components: BossComponent[]; adaptation: string | null; adaptationSources: string[]; inspected: string[]; captiveDeadline: number; disruptionUntil: number };
export type Fact = { id: string; tick: number; room: number; actor: string; kind: "action" | "harm" | "release" | "report" | "teaching" | "correction" | "learning" | "choice" | "countermeasure" | "room" | "interrupt" | "echo-break" | "scar"; operation?: Operation; target?: string; at: Point; signature?: Signature; cost: number; value: number; private: boolean; sources: string[]; text: string };
export type Observation = { id: string; factId: string; observer: string; tick: number; room: number; confidence: number; signature: Signature; cost: number; evidence: string[]; knownBy: string[] };
export type Belief = { id: string; holder: string; claim: Signature; confidence: number; sources: string[]; tick: number; evidence: string[]; knownBy: string[] };
export type Report = { id: string; originator: string; relay: string; observations: string[]; claim: Signature; created: number; delivered: number | null; intercepted: boolean; reliability: number; cost: number; route: string[]; room: number; forged: boolean };
export type Hypothesis = { claim: Signature; confidence: number; support: number; contradictions: number; sources: string[]; rooms: number[]; noise: number; updated: number };
export type Principle = { id: PrincipleId; scope: Scope; confidence: number; examples: string[]; counterexamples: string[]; corrections: string[]; conflicts: string[]; interpretation: string; priority: number };
export type ManeuverStep = { verb: Verb; role?: Role; dx?: number; dy?: number; signature?: Signature };
export type Maneuver = { id: string; name: string; intent: "rescue" | "conceal" | "misdirect" | "overcome"; steps: ManeuverStep[]; boundary: "no-harm" | "free-target" | "none"; examples: string[]; counterexamples: string[]; corrections: string[]; contexts: Family[]; cost: number; risks: string[]; signature: Signature; confidence: number; uses: number };
export type Binding = { runId: string; revision: number; digest: string; requestId: string; generation: string };
export type Plan = { id: string; binding: Binding; steps: Operation[]; boundary: Maneuver["boundary"]; maneuverId?: string; name: string };
export type ActivePlan = { plan: Plan; cursor: number; startedAt: number; facts: string[]; interrupted: string | null };
export type Relic = { stage: 0 | 1 | 2 | 3; energy: number; trust: number; principles: Principle[]; maneuvers: Maneuver[]; line: string; misunderstanding: boolean; pendingChoice: { protect: boolean; sources: string[] } | null; lastChoice: string | null };
export type Relationship = { id: string; name: string; trust: number; debt: number; rescued: number; witnessed: string[] };
export type Command =
  | { type: "act"; operation: Operation }
  | { type: "teach"; principle: PrincipleId; scope: Scope }
  | { type: "correct"; principle: PrincipleId; scope: Scope }
  | { type: "commit"; plan: Plan }
  | { type: "step" }
  | { type: "cancel" }
  | { type: "save-maneuver"; name: string; boundary: Maneuver["boundary"] }
  | { type: "correct-maneuver"; id: string; boundary: Maneuver["boundary"] }
  | { type: "override" }
  | { type: "descend" }
  | { type: "recover" }
  | { type: "favor"; relationshipId: string; help: "supplies" | "silence" }
  | { type: "director"; family: Family };
export type JournalEntry = { revision: number; command: Command };
export type Run = { version: 2; rules: "mind-beneath-1"; runId: string; seed: number; rng: number; revision: number; tick: number; room: Room; player: { hp: number; maxHp: number; potions: number; hiddenUntil: number }; relic: Relic; facts: Fact[]; observations: Observation[]; beliefs: Belief[]; reports: Report[]; hypotheses: Hypothesis[]; relationships: Relationship[]; scars: string[]; history: Family[]; journal: JournalEntry[]; activePlan: ActivePlan | null; lastSequence: { steps: Operation[]; facts: string[]; success: boolean; cost: number } | null; recentSteps: Operation[]; recentFacts: string[]; status: "playing" | "fallen"; echoes: number; chills: { understood: string | null; mistaken: string | null; divergence: string | null }; director: Family | null; notice: string };
export type PreviewStep = { operation: Operation; from: Point; to: Point; witnesses: string[]; hp: number; energy: number; description: string; interruption: string | null };
export type Preview = { legal: boolean; reason: string | null; steps: PreviewStep[]; healthCost: number; energyCost: number; potionCost: number; complications: string[]; observations: string[]; outcome: string };
export type SaveEnvelope = { version: 2; rules: "mind-beneath-1"; runId: string; seed: number; revision: number; journal: JournalEntry[]; checksum: string };
