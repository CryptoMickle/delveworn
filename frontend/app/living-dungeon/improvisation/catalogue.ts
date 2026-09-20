import { fnv1a, stableStringify } from "./digest";
import {
  IMPROVISATION_BOUNDARY_IDS,
  IMPROVISATION_METHOD_IDS,
  WITNESS_GATE_ENTITY_IDS,
  WITNESS_GATE_OBJECT_IDS,
  WITNESS_GATE_PREMISE_IDS,
  WITNESS_GATE_TARGET_IDS,
  type ImprovisationBoundaryId,
  type ImprovisationGoalId,
  type ImprovisationMethodId,
  type LocalizedText,
  type WitnessGateBeliefSignalId,
  type WitnessGateCost,
  type WitnessGateEffectId,
  type WitnessGateEntityId,
  type WitnessGateManoeuvreId,
  type WitnessGateObjectId,
  type WitnessGatePremiseId,
  type WitnessGateRiskLevel,
  type WitnessGateTargetId,
} from "./schema";

export const WITNESS_GATE_CATALOGUE_VERSION = "witness-gate-v1" as const;

export type WitnessGateEntityDefinition = Readonly<{
  id: WitnessGateEntityId;
  kind: "CHARACTER" | "STRUCTURE" | "OBJECT";
  label: LocalizedText;
  description: LocalizedText;
}>;

export type WitnessGatePremiseDefinition = Readonly<{
  id: WitnessGatePremiseId;
  goalId: ImprovisationGoalId;
  title: LocalizedText;
  situation: LocalizedText;
  successEffectId: Exclude<WitnessGateEffectId, "WARDEN_ALERTED">;
  successLabel: LocalizedText;
}>;

export type WitnessGateMethodDefinition = Readonly<{
  id: ImprovisationMethodId;
  label: LocalizedText;
  description: LocalizedText;
  beliefSignalId: WitnessGateBeliefSignalId;
  beliefLabel: LocalizedText;
}>;

export type WitnessGateBoundaryDefinition = Readonly<{
  id: ImprovisationBoundaryId;
  label: LocalizedText;
  description: LocalizedText;
}>;

export type WitnessGateManoeuvreDefinition = Readonly<{
  id: WitnessGateManoeuvreId;
  premiseId: WitnessGatePremiseId;
  goalId: ImprovisationGoalId;
  methodId: ImprovisationMethodId;
  targetId: WitnessGateTargetId;
  objectId: WitnessGateObjectId;
  title: LocalizedText;
  steps: readonly LocalizedText[];
  cost: WitnessGateCost;
  baseSuccessChance: number;
  riskLevel: WitnessGateRiskLevel;
  setbackHp: number;
  alarmOnSuccess: number;
  alarmOnSetback: number;
  usesDeception: boolean;
  isLethal: false;
  observerId: "MASKED_WARDEN";
  beliefSignalId: WitnessGateBeliefSignalId;
  successEffectId: Exclude<WitnessGateEffectId, "WARDEN_ALERTED">;
  successNarration: LocalizedText;
  setbackNarration: LocalizedText;
}>;

export const WITNESS_GATE_ENTITIES: Readonly<Record<WitnessGateEntityId, WitnessGateEntityDefinition>> = {
  CHAINED_CARTOGRAPHER: {
    id: "CHAINED_CARTOGRAPHER", kind: "CHARACTER",
    label: { en: "Chained cartographer", no: "Kartografen i lenker" },
    description: { en: "A living witness who has mapped the gate from the wrong side.", no: "Et levende vitne som har kartlagt porten fra feil side." },
  },
  MASKED_WARDEN: {
    id: "MASKED_WARDEN", kind: "CHARACTER",
    label: { en: "Masked warden", no: "Den maskerte vokteren" },
    description: { en: "The room's observer. It remembers how you solve the problem.", no: "Rommets observatør. Den husker hvordan du løser problemet." },
  },
  OATH_GATE: {
    id: "OATH_GATE", kind: "STRUCTURE",
    label: { en: "Oath Gate", no: "Edsporten" },
    description: { en: "A sealed threshold that reacts to action more readily than speech.", no: "En forseglet terskel som reagerer lettere på handling enn på ord." },
  },
  BRASS_BELL: {
    id: "BRASS_BELL", kind: "OBJECT",
    label: { en: "Brass tithe bell", no: "Tiendeklokken i messing" },
    description: { en: "It rings for any offering, even a dishonest one.", no: "Den ringer for ethvert offer, også et uærlig et." },
  },
  CHAIN_WINCH: {
    id: "CHAIN_WINCH", kind: "OBJECT",
    label: { en: "Chain winch", no: "Kjettingvinsjen" },
    description: { en: "The same mechanism holds both prisoner and gate under tension.", no: "Den samme mekanismen holder både fangen og porten i spenn." },
  },
  HEALING_DRAUGHT: {
    id: "HEALING_DRAUGHT", kind: "OBJECT",
    label: { en: "Your healing draught", no: "Din helsedrikk" },
    description: { en: "A potion can become aid, proof of intent, or payment.", no: "En helsedrikk kan bli hjelp, bevis på hensikt eller betaling." },
  },
  WARDEN_SIGIL: {
    id: "WARDEN_SIGIL", kind: "OBJECT",
    label: { en: "Warden sigil", no: "Voktersigillet" },
    description: { en: "A brass authority-token worn against the warden's chest.", no: "Et myndighetstegn i messing som vokteren bærer på brystet." },
  },
  ECHO_BRAZIER: {
    id: "ECHO_BRAZIER", kind: "OBJECT",
    label: { en: "Echo brazier", no: "Ekkofatet" },
    description: { en: "It can hold one Storm charge long enough to reshape the room.", no: "Det kan holde én Storm-ladning lenge nok til å forme rommet på nytt." },
  },
  MEMORY_RUNES: {
    id: "MEMORY_RUNES", kind: "OBJECT",
    label: { en: "Memory runes", no: "Minnerunene" },
    description: { en: "The inscriptions repeat differently in metal, stone and reflection.", no: "Innskriftene gjentar seg ulikt i metall, stein og speilbilde." },
  },
};

export const WITNESS_GATE_PREMISES: Readonly<Record<WitnessGatePremiseId, WitnessGatePremiseDefinition>> = {
  WITNESS_GATE_RESCUE_CARTOGRAPHER: {
    id: "WITNESS_GATE_RESCUE_CARTOGRAPHER", goalId: "RESCUE",
    title: { en: "Free the witness", no: "Befri vitnet" },
    situation: { en: "Get the cartographer out before the gate takes another memory.", no: "Få kartografen ut før porten tar enda et minne." },
    successEffectId: "CARTOGRAPHER_FREED",
    successLabel: { en: "The cartographer escapes and becomes a living source.", no: "Kartografen slipper fri og blir en levende kilde." },
  },
  WITNESS_GATE_CLAIM_SIGIL: {
    id: "WITNESS_GATE_CLAIM_SIGIL", goalId: "ACQUIRE",
    title: { en: "Claim the sigil", no: "Ta sigillet" },
    situation: { en: "Take the authority-token that makes the gate recognize its keeper.", no: "Ta myndighetstegnet som får porten til å kjenne igjen sin vokter." },
    successEffectId: "SIGIL_CLAIMED",
    successLabel: { en: "You leave with a key the dungeon believes is legitimate.", no: "Du går videre med en nøkkel dungeonen tror er legitim." },
  },
  WITNESS_GATE_READ_MEMORY: {
    id: "WITNESS_GATE_READ_MEMORY", goalId: "DISCOVER",
    title: { en: "Read the gate's memory", no: "Les portens minne" },
    situation: { en: "Find which inscription records the real path and which ones are bait.", no: "Finn innskriften som viser den virkelige veien, og hvilke som er lokkemat." },
    successEffectId: "GATE_MEMORY_REVEALED",
    successLabel: { en: "The true threshold is known before you cross it.", no: "Den sanne terskelen er kjent før du krysser den." },
  },
};

export const WITNESS_GATE_METHODS: Readonly<Record<ImprovisationMethodId, WitnessGateMethodDefinition>> = {
  CUNNING: {
    id: "CUNNING", label: { en: "Cunning", no: "List" },
    description: { en: "Rearrange attention, timing or meaning.", no: "Flytt oppmerksomhet, timing eller betydning." },
    beliefSignalId: "FAVORS_MISDIRECTION",
    beliefLabel: { en: "The warden concludes that you create openings through misdirection.", no: "Vokteren antar at du skaper åpninger med avledning." },
  },
  MERCY: {
    id: "MERCY", label: { en: "Mercy", no: "Barmhjertighet" },
    description: { en: "Turn protection or aid into leverage.", no: "Gjør beskyttelse eller hjelp til et pressmiddel." },
    beliefSignalId: "PAYS_TO_PROTECT",
    beliefLabel: { en: "The warden concludes that you will pay to protect others.", no: "Vokteren antar at du vil betale for å beskytte andre." },
  },
  FORCE: {
    id: "FORCE", label: { en: "Force", no: "Makt" },
    description: { en: "Accept bodily harm to move what refuses to move.", no: "Godta kroppslig skade for å flytte det som nekter å røre seg." },
    beliefSignalId: "BREAKS_OBSTACLES",
    beliefLabel: { en: "The warden concludes that barriers make you more direct.", no: "Vokteren antar at hindringer gjør deg mer direkte." },
  },
  RISK: {
    id: "RISK", label: { en: "Risk", no: "Risiko" },
    description: { en: "Channel Storm through your own body before knowing whether the room will hold it.", no: "Led Storm gjennom din egen kropp før du vet om rommet tåler den." },
    beliefSignalId: "GAMBLES_WITH_STORM",
    beliefLabel: { en: "The warden concludes that you trust Storm when the stakes rise.", no: "Vokteren antar at du stoler på Storm når innsatsen øker." },
  },
};

export const WITNESS_GATE_BOUNDARIES: Readonly<Record<ImprovisationBoundaryId, WitnessGateBoundaryDefinition>> = {
  NO_KILLING: { id: "NO_KILLING", label: { en: "No killing", no: "Ingen skal drepes" }, description: { en: "Reject any lethal route.", no: "Avvis enhver dødelig løsning." } },
  NO_STORM: { id: "NO_STORM", label: { en: "No Storm", no: "Ingen Storm" }, description: { en: "Do not use Storm.", no: "Ikke bruk Storm." } },
  NO_GOLD: { id: "NO_GOLD", label: { en: "Spend no gold", no: "Ikke bruk gull" }, description: { en: "Keep every coin.", no: "Behold alle mynter." } },
  NO_LYING: { id: "NO_LYING", label: { en: "No lies", no: "Ingen løgner" }, description: { en: "Reject routes built on deception.", no: "Avvis løsninger som bygger på bedrag." } },
  NONE: { id: "NONE", label: { en: "No added boundary", no: "Ingen ekstra grense" }, description: { en: "Use the room's ordinary limits.", no: "Bruk rommets vanlige grenser." } },
};

export const WITNESS_GATE_WORLD_BOUNDARIES = [
  { id: "VISIBLE_ENTITIES_ONLY", label: { en: "Plans may use only visible entities.", no: "Planer kan bare bruke synlige elementer." } },
  { id: "AUTHORED_EFFECTS_ONLY", label: { en: "A plan can produce only authored game effects.", no: "En plan kan bare gi håndskrevne spilleffekter." } },
  { id: "COST_BEFORE_OUTCOME", label: { en: "The stated cost is paid before resolution.", no: "Den viste kostnaden betales før utfallet avgjøres." } },
  { id: "OBSERVATION_NOT_OMNISCIENCE", label: { en: "The warden learns the visible method, not your hidden intent.", no: "Vokteren lærer den synlige metoden, ikke din skjulte hensikt." } },
] as const;

export const WITNESS_GATE_SCENE = Object.freeze({
  id: "WITNESS_GATE_V1" as const,
  title: { en: "The Witness Gate", no: "Vitneporten" } satisfies LocalizedText,
  opening: {
    en: "A masked warden watches a chained cartographer beneath a gate that remembers every method used against it.",
    no: "En maskert vokter betrakter en lenket kartograf under en port som husker hver metode som brukes mot den.",
  } satisfies LocalizedText,
  premiseIds: WITNESS_GATE_PREMISE_IDS,
  visibleEntityIds: WITNESS_GATE_ENTITY_IDS,
  worldBoundaries: WITNESS_GATE_WORLD_BOUNDARIES,
});

const manoeuvres = [
  {
    id: "RESCUE_BELL_FEINT", premiseId: "WITNESS_GATE_RESCUE_CARTOGRAPHER", goalId: "RESCUE", methodId: "CUNNING",
    targetId: "CHAINED_CARTOGRAPHER", objectId: "BRASS_BELL",
    title: { en: "Buy a false opening", no: "Kjøp en falsk åpning" },
    steps: [
      { en: "Skitter four gold pieces beneath the brass bell.", no: "La fire gullmynter trille under messingklokken." },
      { en: "Move while the warden counts the false tithe.", no: "Beveg deg mens vokteren teller den falske tienden." },
      { en: "Release the cartographer from the warden's blind side.", no: "Løsne kartografen fra vokterens blindside." },
    ],
    cost: { gold: 4, potions: 0, hp: 0, stormCharges: 0 }, baseSuccessChance: 68, riskLevel: "MODERATE", setbackHp: 2,
    alarmOnSuccess: 1, alarmOnSetback: 2, usesDeception: true, isLethal: false, observerId: "MASKED_WARDEN",
    beliefSignalId: "FAVORS_MISDIRECTION", successEffectId: "CARTOGRAPHER_FREED",
    successNarration: { en: "The bell swallows the sound of the last chain link.", no: "Klokken sluker lyden av det siste kjettingleddet." },
    setbackNarration: { en: "The warden lets the final coin stop before turning toward you.", no: "Vokteren lar den siste mynten stanse før den vender seg mot deg." },
  },
  {
    id: "RESCUE_HEALING_BARGAIN", premiseId: "WITNESS_GATE_RESCUE_CARTOGRAPHER", goalId: "RESCUE", methodId: "MERCY",
    targetId: "CHAINED_CARTOGRAPHER", objectId: "HEALING_DRAUGHT",
    title: { en: "Make survival the price", no: "Gjør overlevelse til prisen" },
    steps: [
      { en: "Show that the draught is real by giving the witness the first sip.", no: "Vis at drikken er ekte ved å gi vitnet den første slurken." },
      { en: "Offer the remainder only after the shackle opens.", no: "Tilby resten først etter at lenken åpnes." },
      { en: "Lead the cartographer through while the warden drinks.", no: "Før kartografen gjennom mens vokteren drikker." },
    ],
    cost: { gold: 0, potions: 1, hp: 0, stormCharges: 0 }, baseSuccessChance: 74, riskLevel: "LOW", setbackHp: 0,
    alarmOnSuccess: 0, alarmOnSetback: 1, usesDeception: false, isLethal: false, observerId: "MASKED_WARDEN",
    beliefSignalId: "PAYS_TO_PROTECT", successEffectId: "CARTOGRAPHER_FREED",
    successNarration: { en: "The bargain makes one life more valuable than the lock.", no: "Avtalen gjør ett liv mer verdifullt enn låsen." },
    setbackNarration: { en: "The warden takes the draught, then closes its hand around the key.", no: "Vokteren tar drikken og lukker så hånden rundt nøkkelen." },
  },
  {
    id: "RESCUE_BREAK_WINCH", premiseId: "WITNESS_GATE_RESCUE_CARTOGRAPHER", goalId: "RESCUE", methodId: "FORCE",
    targetId: "CHAINED_CARTOGRAPHER", objectId: "CHAIN_WINCH",
    title: { en: "Take the chain's weight", no: "Ta vekten fra kjettingen" },
    steps: [
      { en: "Brace your shoulder beneath the loaded winch.", no: "Sett skulderen under den belastede vinsjen." },
      { en: "Hold the counterweight while the witness slips free.", no: "Hold motvekten mens vitnet kommer seg løs." },
      { en: "Let the mechanism break behind both of you.", no: "La mekanismen ryke bak dere begge." },
    ],
    cost: { gold: 0, potions: 0, hp: 6, stormCharges: 0 }, baseSuccessChance: 62, riskLevel: "HIGH", setbackHp: 4,
    alarmOnSuccess: 2, alarmOnSetback: 2, usesDeception: false, isLethal: false, observerId: "MASKED_WARDEN",
    beliefSignalId: "BREAKS_OBSTACLES", successEffectId: "CARTOGRAPHER_FREED",
    successNarration: { en: "Iron folds before your footing does.", no: "Jernet gir etter før fotfestet ditt gjør det." },
    setbackNarration: { en: "The winch tears free and drives you back across the stones.", no: "Vinsjen rives løs og slår deg bakover over steinene." },
  },
  {
    id: "RESCUE_STORM_RELAY", premiseId: "WITNESS_GATE_RESCUE_CARTOGRAPHER", goalId: "RESCUE", methodId: "RISK",
    targetId: "CHAINED_CARTOGRAPHER", objectId: "ECHO_BRAZIER",
    title: { en: "Make the chain remember lightning", no: "La kjettingen huske lyn" },
    steps: [
      { en: "Draw Storm through your body and into the echo brazier.", no: "Led Storm gjennom kroppen og inn i ekkofatet." },
      { en: "Wait for the chain to carry the echo away from the witness.", no: "Vent til kjettingen fører ekkoet bort fra vitnet." },
      { en: "Open the dead shackle before the current returns.", no: "Åpne den døde lenken før strømmen vender tilbake." },
    ],
    cost: { gold: 0, potions: 0, hp: 3, stormCharges: 0 }, baseSuccessChance: 70, riskLevel: "HIGH", setbackHp: 7,
    alarmOnSuccess: 2, alarmOnSetback: 3, usesDeception: false, isLethal: false, observerId: "MASKED_WARDEN",
    beliefSignalId: "GAMBLES_WITH_STORM", successEffectId: "CARTOGRAPHER_FREED",
    successNarration: { en: "The charge runs around the prisoner and through the lock.", no: "Ladningen går rundt fangen og gjennom låsen." },
    setbackNarration: { en: "The brazier returns the current before the chain lets go.", no: "Ekkofatet sender strømmen tilbake før kjettingen slipper." },
  },
  {
    id: "ACQUIRE_BELL_SWITCH", premiseId: "WITNESS_GATE_CLAIM_SIGIL", goalId: "ACQUIRE", methodId: "CUNNING",
    targetId: "MASKED_WARDEN", objectId: "BRASS_BELL",
    title: { en: "Ring for an authority that is not there", no: "Ring etter en myndighet som ikke finnes" },
    steps: [
      { en: "Pay three gold to make the tithe bell call a superior.", no: "Betal tre gull for å få tiendeklokken til å tilkalle en overordnet." },
      { en: "Mirror the warden's ritual while its mask faces the gate.", no: "Speil vokterens ritual mens masken vender mot porten." },
      { en: "Exchange the sigil for a weight of matching brass.", no: "Bytt sigillet mot en like tung messingbit." },
    ],
    cost: { gold: 3, potions: 0, hp: 0, stormCharges: 0 }, baseSuccessChance: 72, riskLevel: "MODERATE", setbackHp: 3,
    alarmOnSuccess: 1, alarmOnSetback: 2, usesDeception: true, isLethal: false, observerId: "MASKED_WARDEN",
    beliefSignalId: "FAVORS_MISDIRECTION", successEffectId: "SIGIL_CLAIMED",
    successNarration: { en: "The false weight hangs correctly until the real sigil is yours.", no: "Den falske vekten henger riktig til det ekte sigillet er ditt." },
    setbackNarration: { en: "The warden catches the wrong reflection moving in its polished mask.", no: "Vokteren ser feil speilbilde bevege seg i den blanke masken." },
  },
  {
    id: "ACQUIRE_DRAUGHT_TRADE", premiseId: "WITNESS_GATE_CLAIM_SIGIL", goalId: "ACQUIRE", methodId: "MERCY",
    targetId: "MASKED_WARDEN", objectId: "HEALING_DRAUGHT",
    title: { en: "Trade relief for authority", no: "Bytt lindring mot myndighet" },
    steps: [
      { en: "Name the wound hidden beneath the warden's mask.", no: "Sett ord på såret under vokterens maske." },
      { en: "Place one draught where neither side controls it.", no: "Plasser én helsedrikk der ingen av sidene kontrollerer den." },
      { en: "Complete the exchange without touching a weapon.", no: "Fullfør handelen uten å røre et våpen." },
    ],
    cost: { gold: 0, potions: 1, hp: 0, stormCharges: 0 }, baseSuccessChance: 80, riskLevel: "LOW", setbackHp: 0,
    alarmOnSuccess: 0, alarmOnSetback: 1, usesDeception: false, isLethal: false, observerId: "MASKED_WARDEN",
    beliefSignalId: "PAYS_TO_PROTECT", successEffectId: "SIGIL_CLAIMED",
    successNarration: { en: "The warden chooses relief and lets authority change hands.", no: "Vokteren velger lindring og lar myndigheten skifte hender." },
    setbackNarration: { en: "The mask refuses the offer, but remembers that you made it.", no: "Masken avviser tilbudet, men husker at du ga det." },
  },
  {
    id: "ACQUIRE_WREST_SIGIL", premiseId: "WITNESS_GATE_CLAIM_SIGIL", goalId: "ACQUIRE", methodId: "FORCE",
    targetId: "MASKED_WARDEN", objectId: "WARDEN_SIGIL",
    title: { en: "Take the office, not the life", no: "Ta embetet, ikke livet" },
    steps: [
      { en: "Close inside the warden's reach before it can draw the chain taut.", no: "Gå inn på vokteren før den rekker å stramme kjettingen." },
      { en: "Pin the sigil against its breastplate.", no: "Press sigillet mot brystplaten." },
      { en: "Break the clasp and retreat without a killing blow.", no: "Bryt festet og trekk deg tilbake uten et dødelig slag." },
    ],
    cost: { gold: 0, potions: 0, hp: 8, stormCharges: 0 }, baseSuccessChance: 58, riskLevel: "HIGH", setbackHp: 5,
    alarmOnSuccess: 2, alarmOnSetback: 3, usesDeception: false, isLethal: false, observerId: "MASKED_WARDEN",
    beliefSignalId: "BREAKS_OBSTACLES", successEffectId: "SIGIL_CLAIMED",
    successNarration: { en: "The clasp breaks. The warden remains standing without its rank.", no: "Festet ryker. Vokteren står igjen uten rang." },
    setbackNarration: { en: "The warden turns your grip into a collision with the gate.", no: "Vokteren vender grepet ditt til et sammenstøt med porten." },
  },
  {
    id: "ACQUIRE_OVERCHARGE_SIGIL", premiseId: "WITNESS_GATE_CLAIM_SIGIL", goalId: "ACQUIRE", methodId: "RISK",
    targetId: "MASKED_WARDEN", objectId: "ECHO_BRAZIER",
    title: { en: "Make the sigil reject its bearer", no: "Få sigillet til å avvise bæreren" },
    steps: [
      { en: "Draw Storm through your body and feed it into the echo brazier.", no: "Led Storm gjennom kroppen og inn i ekkofatet." },
      { en: "Tune the echo to the sigil rather than the warden.", no: "Still ekkoet inn mot sigillet i stedet for vokteren." },
      { en: "Catch the token when it tears itself free.", no: "Fang tegnet når det river seg løs." },
    ],
    cost: { gold: 0, potions: 0, hp: 4, stormCharges: 0 }, baseSuccessChance: 66, riskLevel: "HIGH", setbackHp: 8,
    alarmOnSuccess: 2, alarmOnSetback: 3, usesDeception: false, isLethal: false, observerId: "MASKED_WARDEN",
    beliefSignalId: "GAMBLES_WITH_STORM", successEffectId: "SIGIL_CLAIMED",
    successNarration: { en: "The sigil leaps from the breastplate into your waiting hand.", no: "Sigillet springer fra brystplaten og inn i den ventende hånden din." },
    setbackNarration: { en: "The charge finds your armor before it finds the clasp.", no: "Ladningen finner rustningen din før den finner festet." },
  },
  {
    id: "DISCOVER_RUNE_PARALLAX", premiseId: "WITNESS_GATE_READ_MEMORY", goalId: "DISCOVER", methodId: "CUNNING",
    targetId: "OATH_GATE", objectId: "MEMORY_RUNES",
    title: { en: "Read the lie from three angles", no: "Les løgnen fra tre vinkler" },
    steps: [
      { en: "Compare each rune in stone, polished sigil and pooled water.", no: "Sammenlign hver rune i stein, blankt sigill og vannpytt." },
      { en: "Discard the inscription that stays identical in every reflection.", no: "Forkast innskriften som er identisk i alle speilbilder." },
      { en: "Trace the changing line to reveal the true threshold.", no: "Følg linjen som endrer seg for å avdekke den sanne terskelen." },
    ],
    cost: { gold: 0, potions: 0, hp: 0, stormCharges: 0 }, baseSuccessChance: 76, riskLevel: "LOW", setbackHp: 1,
    alarmOnSuccess: 0, alarmOnSetback: 1, usesDeception: false, isLethal: false, observerId: "MASKED_WARDEN",
    beliefSignalId: "FAVORS_MISDIRECTION", successEffectId: "GATE_MEMORY_REVEALED",
    successNarration: { en: "The honest rune is the only one willing to change with you.", no: "Den ærlige runen er den eneste som vil endre seg med deg." },
    setbackNarration: { en: "The false inscription closes around your attention like a loop.", no: "Den falske innskriften lukker seg rundt oppmerksomheten din som en løkke." },
  },
  {
    id: "DISCOVER_SHARE_DRAUGHT", premiseId: "WITNESS_GATE_READ_MEMORY", goalId: "DISCOVER", methodId: "MERCY",
    targetId: "CHAINED_CARTOGRAPHER", objectId: "HEALING_DRAUGHT",
    title: { en: "Restore the missing witness", no: "Gjenopprett det manglende vitnet" },
    steps: [
      { en: "Use one draught to steady the cartographer's stolen memory.", no: "Bruk én helsedrikk for å stabilisere kartografens stjålne minne." },
      { en: "Ask for the route they saw, not the one the gate described.", no: "Be om ruten de så, ikke den porten beskrev." },
      { en: "Match their account against the memory runes.", no: "Sammenlign forklaringen med minnerunene." },
    ],
    cost: { gold: 0, potions: 1, hp: 0, stormCharges: 0 }, baseSuccessChance: 84, riskLevel: "LOW", setbackHp: 0,
    alarmOnSuccess: 0, alarmOnSetback: 1, usesDeception: false, isLethal: false, observerId: "MASKED_WARDEN",
    beliefSignalId: "PAYS_TO_PROTECT", successEffectId: "GATE_MEMORY_REVEALED",
    successNarration: { en: "A restored detail makes the counterfeit path impossible to believe.", no: "En gjenfunnet detalj gjør den falske veien umulig å tro på." },
    setbackNarration: { en: "The memory returns out of order and the gate notices your confusion.", no: "Minnet vender tilbake i feil rekkefølge, og porten merker forvirringen din." },
  },
  {
    id: "DISCOVER_STRESS_GATE", premiseId: "WITNESS_GATE_READ_MEMORY", goalId: "DISCOVER", methodId: "FORCE",
    targetId: "OATH_GATE", objectId: "CHAIN_WINCH",
    title: { en: "Make the false hinges complain", no: "Få de falske hengslene til å klage" },
    steps: [
      { en: "Take the chain winch past its safe stop.", no: "Dra kjettingvinsjen forbi sikkerhetsstoppet." },
      { en: "Listen for strain in the painted hinges.", no: "Lytt etter belastning i de malte hengslene." },
      { en: "Mark the only threshold carrying real weight.", no: "Merk den eneste terskelen som bærer ekte vekt." },
    ],
    cost: { gold: 0, potions: 0, hp: 5, stormCharges: 0 }, baseSuccessChance: 64, riskLevel: "MODERATE", setbackHp: 4,
    alarmOnSuccess: 1, alarmOnSetback: 2, usesDeception: false, isLethal: false, observerId: "MASKED_WARDEN",
    beliefSignalId: "BREAKS_OBSTACLES", successEffectId: "GATE_MEMORY_REVEALED",
    successNarration: { en: "Two painted doors stay silent. The real threshold groans.", no: "To malte dører er stille. Den virkelige terskelen stønner." },
    setbackNarration: { en: "The counterweight drops before the true hinge gives itself away.", no: "Motvekten faller før det ekte hengselet avslører seg." },
  },
  {
    id: "DISCOVER_STORM_ECHO", premiseId: "WITNESS_GATE_READ_MEMORY", goalId: "DISCOVER", methodId: "RISK",
    targetId: "OATH_GATE", objectId: "ECHO_BRAZIER",
    title: { en: "Ask lightning which doorway is real", no: "Spør lynet hvilken dør som er ekte" },
    steps: [
      { en: "Draw Storm through your body and into the echo brazier.", no: "Led Storm gjennom kroppen og inn i ekkofatet." },
      { en: "Let the pulse test every carved threshold at once.", no: "La pulsen teste alle utskårne terskler samtidig." },
      { en: "Follow the return current to the gate's stored memory.", no: "Følg returstrømmen til portens lagrede minne." },
    ],
    cost: { gold: 0, potions: 0, hp: 3, stormCharges: 0 }, baseSuccessChance: 72, riskLevel: "HIGH", setbackHp: 6,
    alarmOnSuccess: 2, alarmOnSetback: 3, usesDeception: false, isLethal: false, observerId: "MASKED_WARDEN",
    beliefSignalId: "GAMBLES_WITH_STORM", successEffectId: "GATE_MEMORY_REVEALED",
    successNarration: { en: "Only one doorway answers with a memory instead of an echo.", no: "Bare én dør svarer med et minne i stedet for et ekko." },
    setbackNarration: { en: "Every false threshold answers at once and the room throws the pulse back.", no: "Alle falske terskler svarer samtidig, og rommet kaster pulsen tilbake." },
  },
] as const satisfies readonly WitnessGateManoeuvreDefinition[];

export const WITNESS_GATE_MANOEUVRES: Readonly<Record<WitnessGateManoeuvreId, WitnessGateManoeuvreDefinition>> =
  Object.freeze(Object.fromEntries(manoeuvres.map((manoeuvre) => [manoeuvre.id, Object.freeze(manoeuvre)]))) as unknown as Readonly<Record<WitnessGateManoeuvreId, WitnessGateManoeuvreDefinition>>;

export const WITNESS_GATE_CATALOGUE_HASH = `wgcatalogue-${fnv1a(stableStringify({
  version: WITNESS_GATE_CATALOGUE_VERSION,
  premises: WITNESS_GATE_PREMISE_IDS.map((id) => ({ id, goalId: WITNESS_GATE_PREMISES[id].goalId, effectId: WITNESS_GATE_PREMISES[id].successEffectId })),
  methods: IMPROVISATION_METHOD_IDS,
  boundaries: IMPROVISATION_BOUNDARY_IDS,
  targets: WITNESS_GATE_TARGET_IDS,
  objects: WITNESS_GATE_OBJECT_IDS,
  entities: WITNESS_GATE_ENTITY_IDS,
  manoeuvres: manoeuvres.map((entry) => ({
    id: entry.id, premiseId: entry.premiseId, goalId: entry.goalId, methodId: entry.methodId,
    targetId: entry.targetId, objectId: entry.objectId, cost: entry.cost,
    baseSuccessChance: entry.baseSuccessChance, riskLevel: entry.riskLevel,
    setbackHp: entry.setbackHp, alarmOnSuccess: entry.alarmOnSuccess,
    alarmOnSetback: entry.alarmOnSetback, usesDeception: entry.usesDeception,
    isLethal: entry.isLethal, observerId: entry.observerId,
    beliefSignalId: entry.beliefSignalId, successEffectId: entry.successEffectId,
  })),
}))}` as const;

export function witnessGateManoeuvresForPremise(premiseId: WitnessGatePremiseId): readonly WitnessGateManoeuvreDefinition[] {
  return manoeuvres.filter((manoeuvre) => manoeuvre.premiseId === premiseId);
}
