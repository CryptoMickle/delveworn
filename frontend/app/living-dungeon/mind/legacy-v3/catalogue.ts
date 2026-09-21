import type { ComponentId, Family, PrincipleId, Scope, Signature } from "./types";

export const PRINCIPLES: Record<PrincipleId, { title: string; interpretation: string; scope: Scope; question: string }> = {
  protect: { title: "Protect the innocent before me", interpretation: "When someone is in danger, I go to them. Even if you have to wait.", scope: "innocent-at-risk", question: "Even someone who can never help us?" },
  "no-harm": { title: "Freedom without needless harm", interpretation: "I look for a way that leaves both captive and guard alive.", scope: "always", question: "Should I protect the one keeping the door shut, too?" },
  promise: { title: "Keep a promise, even when it costs", interpretation: "Anyone we have promised freedom is our responsibility.", scope: "always", question: "What if a new promise threatens the first?" },
  survive: { title: "Survive when no one else pays", interpretation: "I choose your survival when no one else has to pay.", scope: "no-one-else-hurt", question: "How do we know who pays later?" },
  investigate: { title: "Question what seems too easy", interpretation: "I examine the offer before I let us trust it.", scope: "suspicious-offer", question: "Do you want me to doubt you, too?" },
  "last-potion": { title: "The last potion belongs to whoever would die without it", interpretation: "I give the last potion to whoever needs it most. Even if that is not you.", scope: "innocent-at-risk", question: "Even when you ask me to keep it?" },
};
export const THEORY_COPY: Record<Signature, string> = {
  storm: "You use Storm when waiting has a cost.", mercy: "You always choose the captive over yourself.", force: "You meet resistance with steel.", cunning: "You create a distraction before you act.", "self-preservation": "You save yourself before anyone else.",
};
export const COMPONENTS: Record<ComponentId, { name: string; cost: number; theory: Signature; effect: string }> = {
  "storm-ward": { name: "Storm Ward", cost: 3, theory: "storm", effect: "Diverts lightning away from the Echo. The side passage is unguarded." },
  "hostage-thread": { name: "Hostage Thread", cost: 3, theory: "mercy", effect: "Binds the Echo's shield to a captive. Release them to break the bond." },
  "echo-snare": { name: "Borrowed Distraction", cost: 2, theory: "cunning", effect: "The visible bell is a trap. The shadow resonator is unguarded." },
  "iron-mirror": { name: "Iron Mirror", cost: 2, theory: "force", effect: "Steel loses strength at the front. An unseen attack breaks the mirror." },
  "thirst-trap": { name: "Circle of Thirst", cost: 2, theory: "self-preservation", effect: "Drinking a potion leaves a hazardous tile. Giving it away does not." },
};
export const FAMILIES: Family[] = ["bell", "kiln", "archive", "bridge", "garden", "tribunal", "reservoir", "echo"];
export const FAMILY_COPY: Record<Family, { place: string; distraction: string; captive: string; guardian: string; light: string }> = {
  bell: { place: "The Tongueless Bell", distraction: "The Tithe Bell", captive: "Ilyr the Cartographer", guardian: "The Masked Warden", light: "The Watch Lantern" },
  kiln: { place: "The Remembering Kiln", distraction: "The Pressure Valve", captive: "The Ash Bearer", guardian: "The Kiln Guard", light: "The Emberstone" },
  archive: { place: "The Archive of Errors", distraction: "The Memory Organ", captive: "The Nameless Scribe", guardian: "The Archivist", light: "The Reading Lamp" },
  bridge: { place: "The Bridge Beneath the Promise", distraction: "The Chain Winch", captive: "The Bridge Builder", guardian: "The Tollkeeper", light: "The Bridge Beacon" },
  garden: { place: "The Garden of Borrowed Roots", distraction: "The Dry Fountain Wheel", captive: "The Rootkeeper", guardian: "The Hollow Gardener", light: "The Night Bloom" },
  tribunal: { place: "The Court Without a Judge", distraction: "The Witness Gong", captive: "The Last Witness", guardian: "The Oathbearer", light: "The Judge's Light" },
  reservoir: { place: "The Cistern Beneath", distraction: "The Sluice Wheel", captive: "The Water Bearer", guardian: "The Depth Guard", light: "The Mirror Lantern" },
  echo: { place: "The Mind Beneath", distraction: "The Borrowed Bell", captive: "Ilyr's Bound Echo", guardian: "Your Perfect Echo", light: "The Eye Above" },
};
export const ACTS = ["Obedience", "The First Misunderstanding", "Someone Was Watching", "A Useful Misconception", "The Relic Chooses", "The Echo"];
export const CHAPTER: { family: Family; title: string; subtitle: string }[] = [
  { family: "bell", title: "A Voice in the Stone", subtitle: "“I was part of what waits beneath us. Teach me another way.”" },
  { family: "kiln", title: "What Did You Mean by Free?", subtitle: "New tools. The same obligation." },
  { family: "archive", title: "Too Simple a Rule", subtitle: "“No one died last time. I thought that was the whole point.”" },
  { family: "bridge", title: "The Price of a Correction", subtitle: "The one waiting on the other side has not heard your promise." },
  { family: "tribunal", title: "Someone Was Watching", subtitle: "A scribe saw your opening. Now it is looking for a way to report." },
  { family: "reservoir", title: "The Story Grows Legs", subtitle: "What happened and what gets told go their separate ways." },
  { family: "garden", title: "A Useful Misconception", subtitle: "The room has already decided who you are." },
  { family: "kiln", title: "Pay for the Lie", subtitle: "A convincing role costs something. That is why it is believed." },
  { family: "bridge", title: "The Last Potion", subtitle: "“You taught me to protect. You also asked me to come back.”" },
  { family: "archive", title: "A Choice of My Own", subtitle: "The relic no longer waits for every word." },
  { family: "tribunal", title: "Before the Conclusion", subtitle: "The last report has not been sent. Decide what the Echo will know." },
  { family: "echo", title: "Certain About the Wrong Person", subtitle: "It has learned to predict you. It has not learned to doubt." },
];
