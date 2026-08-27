type MonsterLogPersona = {
  name: string;
  encounters: readonly string[];
  hitLines: readonly string[];
  killLines: readonly string[];
};

const MONSTER_LOG_COPY: readonly (readonly MonsterLogPersona[])[] = [
  [
    {
      name: "Grave Belle",
      encounters: [
        "Grave Belle notices you. Personal boundaries immediately become optional.",
        "She's undead, stylish, and suspiciously happy to see you.",
      ],
      hitLines: [
        "Personal space remains an unresolved issue.",
        "Apparently manners died first.",
        "She seems pleased with herself.",
        "That was unnecessarily intimate.",
      ],
      killLines: [
        "Grave Belle has died again. Awkward.",
        "Her second death was somehow more theatrical than the first.",
      ],
    },
    {
      name: "Miss Morgue",
      encounters: [
        "She smiles. You immediately regret being biologically active.",
        "Miss Morgue seems professionally interested in your pulse.",
      ],
      hitLines: [
        "Your insurance probably does not cover this.",
        "Medical ethics have left the dungeon.",
        "She calls that bedside manner.",
        "Miss Morgue seems delighted by the result.",
      ],
      killLines: [
        "Miss Morgue is no longer accepting patients.",
        "Cause of death: adventurer.",
      ],
    },
    {
      name: "Velvet Rot",
      encounters: [
        "Velvet Rot enters like this is somehow your fault.",
        "You suddenly understand why the dungeon has no dating app.",
      ],
      hitLines: [
        "That relationship escalated quickly.",
        "This date is going badly.",
        "She takes your discomfort as encouragement.",
        "Velvet appears satisfied. You are less enthusiastic.",
      ],
      killLines: [
        "Velvet Rot leaves behind several red flags and some gold.",
        "It's not you. It's the sword.",
      ],
    },
    {
      name: "Lady Decomposition",
      encounters: [
        "Lady Decomposition arrives fashionably late by several centuries.",
        "She looks offended that you are still alive.",
      ],
      hitLines: [
        "Nobility has spoken.",
        "You have offended the undead upper class.",
        "She considers this appropriate etiquette.",
        "The aristocracy remains surprisingly hands-on.",
      ],
      killLines: [
        "Lady Decomposition finally experiences downward mobility.",
        "The estate will be hearing about this.",
      ],
    },
  ],
  [
    {
      name: "Gary",
      encounters: [
        "Gary charges. Planning was apparently optional.",
        "Gary appears. Nobody requested Gary.",
      ],
      hitLines: [
        "Gary looks shocked that this worked.",
        "This was the best moment of Gary's week.",
        "This has significantly improved Gary's confidence.",
        "Gary immediately considers himself a tactical genius.",
      ],
      killLines: [
        "Gary has been promoted to former employee.",
        "Gary's plan has encountered a minor implementation issue.",
      ],
    },
    {
      name: "Kevin the Unqualified",
      encounters: [
        "Kevin has received absolutely no training for this.",
        "Kevin looks prepared. This is misleading.",
      ],
      hitLines: [
        "Kevin cannot believe that worked.",
        "This will absolutely go on Kevin's résumé.",
        "His annual review is going surprisingly well.",
        "Kevin briefly achieves competence.",
      ],
      killLines: [
        "Kevin has failed probation.",
        "The hiring manager has several questions to answer.",
      ],
    },
    {
      name: "Gribble",
      encounters: [
        "Gribble has acquired equipment and immediately become unbearable.",
        "Someone armed Gribble properly. Find them.",
      ],
      hitLines: [
        "He is going to talk about that hit for weeks.",
        "His confidence reaches dangerous levels.",
        "Gribble's investment in equipment pays dividends.",
        "Gribble considers this proof of superiority.",
      ],
      killLines: [
        "Gribble's technological revolution ends here.",
        "Civilization narrowly avoids the Gribble era.",
      ],
    },
    {
      name: "Gary's Supervisor",
      encounters: [
        "Management has become aware of the Gary situation.",
        "You finally meet the man who approved Gary.",
      ],
      hitLines: [
        "Management considers this constructive feedback.",
        "He calls this leadership.",
        "Your performance review is deteriorating.",
        "Apparently this qualifies as employee development.",
      ],
      killLines: [
        "The organization chart just improved.",
        "Middle management takes another historic loss.",
      ],
    },
  ],
  [
    {
      name: "Thud",
      encounters: [
        "Thud appears. The dungeon floor files a structural complaint.",
        "He briefly considers strategy. The moment passes.",
      ],
      hitLines: [
        "Complex negotiations have failed.",
        "Thud considers this diplomacy.",
        "The floor shakes slightly.",
        "Thud appears intellectually satisfied.",
      ],
      killLines: [
        "Thud falls over. The dungeon briefly registers seismic activity.",
        "The structural complaint has been resolved.",
      ],
    },
    {
      name: "Brutus",
      encounters: [
        "Brutus believes subtlety is a type of weakness.",
        "His battle plan appears to have been written in crayon.",
      ],
      hitLines: [
        "His doctrine remains frustratingly effective.",
        "Thinking remains unnecessary.",
        "Brutus sees no reason to reconsider the plan.",
        "He seems encouraged by the simplicity of violence.",
      ],
      killLines: [
        "Brutus discovers that harder was not always the answer.",
        "The crayon battle plan requires significant amendments.",
      ],
    },
    {
      name: "Gronk",
      encounters: [
        "Gronk enters. Diplomatic relations immediately deteriorate.",
        "Negotiations begin without an agenda and with several muscles.",
      ],
      hitLines: [
        "Diplomacy has officially ended.",
        "Gronk considers the discussion productive.",
        "The negotiations remain physical.",
        "Gronk nods approvingly at his own technique.",
      ],
      killLines: [
        "Gronk will not be attending the next summit.",
        "Formal relations have been suspended indefinitely.",
      ],
    },
    {
      name: "Meatwall",
      encounters: [
        "Meatwall arrives. Technically, part of the room arrives with him.",
        "You are unsure whether to fight him or obtain planning permission.",
      ],
      hitLines: [
        "You have been struck by infrastructure.",
        "Meatwall continues being geographically inconvenient.",
        "Architecture becomes unexpectedly aggressive.",
        "The building regulations remain unenforced.",
      ],
      killLines: [
        "The architectural problem has been demolished.",
        "Local property values immediately improve.",
      ],
    },
  ],
  [
    {
      name: "The Dungeon Lord",
      encounters: [
        "The Dungeon Lord looks up from his paperwork. You have interrupted something deeply unnecessary.",
        "A crown, a title and absolutely no accountability.",
      ],
      hitLines: [
        "This will be documented in the quarterly report.",
        "Your complaint has been denied.",
        "Management has entered the fight.",
        "The Dungeon Lord calls this performance management.",
      ],
      killLines: [
        "Organizational restructuring begins immediately.",
        "Dungeon management is currently unavailable.",
      ],
    },
    {
      name: "The Senior Dungeon Lord",
      encounters: [
        "Your case has been escalated to senior management.",
        "The Senior Dungeon Lord has reviewed your file. He dislikes it.",
      ],
      hitLines: [
        "Senior management provides direct feedback.",
        "Your escalation request has been denied.",
        "This meeting is becoming increasingly hostile.",
        "The chain of command remains surprisingly physical.",
      ],
      killLines: [
        "Senior management has left the organization.",
        "The dungeon urgently requires succession planning.",
      ],
    },
    {
      name: "The Executive Overlord",
      encounters: [
        "Your survival has become a board-level concern.",
        "The executive team has finally noticed you.",
      ],
      hitLines: [
        "The quarterly targets suddenly feel personal.",
        "Your KPI is now survival.",
        "Executive action has been authorized.",
        "This is what leadership calls decisive action.",
      ],
      killLines: [
        "The executive team has lost quorum.",
        "Executive leadership has been involuntarily streamlined.",
      ],
    },
    {
      name: "The Chairman Below",
      encounters: [
        "You have reached the top of an organization that should never have existed.",
        "The Chairman has read the reports. All of them.",
      ],
      hitLines: [
        "The board has reached a unanimous decision.",
        "The Chairman calls this stakeholder engagement.",
        "Your appeal period has expired.",
        "Corporate policy has become extremely literal.",
      ],
      killLines: [
        "The board is dissolved. Mostly because you dissolved it.",
        "There is officially nobody left to escalate this to.",
      ],
    },
  ],
];

const CRITICAL_LINES = [
  "CRITICAL HIT! Anatomy has left the chat.",
  "CRITICAL HIT! That looked expensive.",
  "CRITICAL HIT! Several workplace regulations were violated.",
  "CRITICAL HIT! Completely reasonable amount of force.",
  "CRITICAL HIT! The paperwork will be incredible.",
  "CRITICAL HIT! Absolutely textbook. A very concerning textbook.",
] as const;

const ATTACK_LINES = [
  "⚔️ You hit {monster} for {damage} DAMAGE. Professional disagreement continues.",
  "⚔️ You deal {damage} DAMAGE to {monster}. Negotiations remain unproductive.",
  "⚔️ {monster} takes {damage} DAMAGE. The incident report gains another page.",
  "⚔️ You land {damage} DAMAGE on {monster}. Conflict resolution remains aspirational.",
  "⚔️ {monster} receives {damage} DAMAGE. No apology is forthcoming.",
  "⚔️ You inflict {damage} DAMAGE on {monster}. The dungeon calls this constructive dialogue.",
  "⚔️ {monster} loses {damage} HP. Violence remains the fastest interface.",
  "⚔️ You submit {damage} DAMAGE to {monster}. Another compelling argument is filed.",
  "⚔️ {monster} suffers {damage} DAMAGE. This counts as active listening here.",
  "⚔️ You strike {monster} for {damage} DAMAGE. The performance review turns physical.",
  "⚔️ {monster} absorbs {damage} DAMAGE. Diplomacy takes scheduled leave.",
  "⚔️ You deliver {damage} DAMAGE to {monster}. Your point lands with measurable impact.",
] as const;

const NORMAL_DEATH_LINES = [
  "☠️ You died. The dungeon updates its statistics.",
  "☠️ You died. Please leave your equipment with reception.",
  "☠️ Your run has been terminated with immediate effect.",
  "☠️ Management appreciates your contribution.",
  "☠️ The dungeon records another successful onboarding.",
] as const;

const STORM_DEATH_LINES = [
  "☠️ You trusted the storm. The storm did not reciprocate.",
  "☠️ The forecast called for poor decisions.",
  "☠️ You gambled on the weather and lost.",
  "☠️ The storm worked perfectly. Just not for you.",
] as const;

const STORM_ZERO_LINES = [
  "⚡ Storm deals 0 DAMAGE. Magnificent presentation. No measurable effect.",
  "⚡ Storm deals 0 DAMAGE. Somewhere, thunder quietly apologizes.",
  "⚡ Storm deals 0 DAMAGE. You successfully intimidate the atmosphere.",
] as const;

const STORM_LOW_LINES = [
  "⚡ Storm deals {damage} DAMAGE. More drizzle than thunderstorm.",
  "⚡ Storm deals {damage} DAMAGE. The monster looks mildly inconvenienced.",
  "⚡ Storm deals {damage} DAMAGE. Dramatic entrance, modest results.",
] as const;

const STORM_MEDIUM_LINES = [
  "⚡ Storm deals {damage} DAMAGE. Acceptable chaos.",
  "⚡ Storm deals {damage} DAMAGE. Surprisingly respectable.",
  "⚡ Storm deals {damage} DAMAGE. Reasonably irresponsible.",
] as const;

const STORM_HIGH_LINES = [
  "⚡ Storm deals {damage} DAMAGE. Completely intentional.",
  "⚡ Storm deals {damage} DAMAGE. We will pretend that was calculated.",
  "⚡ Storm deals {damage} DAMAGE. Risk management has left the dungeon.",
] as const;

const STORM_EXTREME_LINES = [
  "⚡ Storm deals {damage} DAMAGE. The storm has chosen violence.",
  "⚡ Storm deals {damage} DAMAGE. Forecast: catastrophic.",
  "⚡ Storm deals {damage} DAMAGE. Completely unreasonable. Excellent.",
] as const;

function randomIndex(length: number): number {
  if (length <= 1) return 0;
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % length;
}

export function pickLogLine<T>(values: readonly T[]): T {
  return values[randomIndex(values.length)];
}

function pickFreshCandidate<T>(
  values: readonly T[],
  recentLog: readonly string[],
  markerFor: (value: T) => string
): T {
  const withRecency = values.map((value) => ({
    value,
    lastSeenAt: recentLog.findIndex((entry) => entry.includes(markerFor(value))),
  }));
  const unseen = withRecency.filter(({ lastSeenAt }) => lastSeenAt === -1);
  if (unseen.length > 0) return pickLogLine(unseen).value;

  const oldestIndex = Math.max(...withRecency.map(({ lastSeenAt }) => lastSeenAt));
  return pickLogLine(
    withRecency.filter(({ lastSeenAt }) => lastSeenAt === oldestIndex)
  ).value;
}

export function pickFreshLogLine<T extends string>(
  values: readonly T[],
  recentLog: readonly string[]
): T {
  return pickFreshCandidate(values, recentLog, (value) => value);
}

function templateMarker(template: string): string {
  const finalPlaceholder = Math.max(
    template.lastIndexOf("{damage}"),
    template.lastIndexOf("{monster}")
  );
  if (finalPlaceholder === -1) return template;
  const closingBrace = template.indexOf("}", finalPlaceholder);
  return template.slice(closingBrace + 1).trim();
}

function pickFreshTemplate<T extends string>(
  templates: readonly T[],
  recentLog: readonly string[]
): T {
  return pickFreshCandidate<T>(templates, recentLog, (template) =>
    templateMarker(template)
  );
}

function regularTier(room: number): number {
  if (room <= 9) return 0;
  if (room <= 19) return 1;
  if (room <= 29) return 2;
  return 3;
}

function bossTier(room: number): number {
  if (room <= 10) return 0;
  if (room <= 20) return 1;
  if (room <= 30) return 2;
  return 3;
}

export function getMonsterLogPersona(monsterType: number, room: number): MonsterLogPersona {
  const tier = monsterType === 3 ? bossTier(room) : regularTier(room);
  return MONSTER_LOG_COPY[monsterType]?.[tier] ?? MONSTER_LOG_COPY[0][0];
}

export function getAttackLogLine(
  monster: string,
  damage: number,
  recentLog: readonly string[] = []
): string {
  return pickFreshTemplate(ATTACK_LINES, recentLog)
    .replace("{monster}", monster)
    .replace("{damage}", `${damage}`);
}

export function getCriticalLogLine(
  damage: number,
  recentLog: readonly string[] = []
): string {
  return `💥 ${pickFreshLogLine(CRITICAL_LINES, recentLog)} ${damage} DAMAGE.`;
}

export function getDeathLogLine(storm = false): string {
  return pickLogLine(storm ? STORM_DEATH_LINES : NORMAL_DEATH_LINES);
}

export function getStormLogLine(
  damage: number,
  stormMax: number,
  recentLog: readonly string[] = []
): string {
  if (damage === 0) return pickFreshLogLine(STORM_ZERO_LINES, recentLog);
  const ratio = stormMax > 0 ? damage / stormMax : 0;
  const lines = ratio < 0.25
    ? STORM_LOW_LINES
    : ratio < 0.55
      ? STORM_MEDIUM_LINES
      : ratio < 0.85
        ? STORM_HIGH_LINES
        : STORM_EXTREME_LINES;
  return pickFreshTemplate(lines, recentLog).replace("{damage}", `${damage}`);
}

export function getBossDialogue(room: number): string {
  if (room >= 60) return '“I no longer wish to discuss this.”';
  if (room >= 50) return '“WHY ARE YOU STILL HERE?”';
  if (room >= 40) return '“You have reached the board. There is nowhere left to escalate.”';
  if (room >= 30) return '“Your continued survival has become an executive-level concern.”';
  if (room >= 20) return '“Your case has been escalated. I was told you would be less persistent.”';
  return '“Ah. Another adventurer. How original.”';
}
