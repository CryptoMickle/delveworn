import type { ComponentId, Family, PrincipleId, Scope, Signature } from "./types";

export const PRINCIPLES: Record<PrincipleId, { title: string; interpretation: string; scope: Scope; question: string }> = {
  protect: { title: "Beskytt uskyldige før meg", interpretation: "Når noen er i fare, går jeg til dem. Selv om du må vente.", scope: "innocent-at-risk", question: "Gjelder det også noen som aldri kan hjelpe oss?" },
  "no-harm": { title: "Frihet uten unødvendig skade", interpretation: "Jeg leter etter en vei der både fangen og vokteren overlever.", scope: "always", question: "Skal jeg også beskytte den som holder døren stengt?" },
  promise: { title: "Hold et løfte selv når det koster", interpretation: "Jeg behandler den vi har lovet frihet som vårt ansvar.", scope: "always", question: "Hva om et nytt løfte truer det første?" },
  survive: { title: "Overlev når ingen andre rammes", interpretation: "Jeg velger din overlevelse når ingen andre må betale.", scope: "no-one-else-hurt", question: "Hvordan vet vi hvem som betaler senere?" },
  investigate: { title: "Undersøk det som virker for enkelt", interpretation: "Jeg undersøker tilbudet før jeg lar oss stole på det.", scope: "suspicious-offer", question: "Vil du at jeg skal tvile på deg også?" },
  "last-potion": { title: "Den siste drikken tilhører den som ellers dør", interpretation: "Jeg gir den siste drikken til den mest utsatte, også om det ikke er deg.", scope: "innocent-at-risk", question: "Også når du ber meg beholde den?" },
};
export const THEORY_COPY: Record<Signature, string> = {
  storm: "Du bruker Storm når det koster å vente.", mercy: "Du velger alltid den fangede fremfor deg selv.", force: "Du møter motstand med stål.", cunning: "Du lager en avledning før du handler.", "self-preservation": "Du redder deg selv før noen andre.",
};
export const COMPONENTS: Record<ComponentId, { name: string; cost: number; theory: Signature; effect: string }> = {
  "storm-ward": { name: "Storm Ward", cost: 3, theory: "storm", effect: "Leder lyn bort fra ekkoet. Sidegangen står uten vern." },
  "hostage-thread": { name: "Gisseltråden", cost: 3, theory: "mercy", effect: "Binder ekkoets skjold til en fange. Frigjøring bryter bindingen." },
  "echo-snare": { name: "Den lånte avledningen", cost: 2, theory: "cunning", effect: "Den synlige klokken er en felle. Skyggens resonator er fri." },
  "iron-mirror": { name: "Jernspeilet", cost: 2, theory: "force", effect: "Stål mister kraft ved fronten. Et ubemerket angrep bryter speilet." },
  "thirst-trap": { name: "Tørstens sirkel", cost: 2, theory: "self-preservation", effect: "En helsedrikk etterlater en farlig rute. Å gi den bort gjør det ikke." },
};
export const FAMILIES: Family[] = ["bell", "kiln", "archive", "bridge", "garden", "tribunal", "reservoir", "echo"];
export const FAMILY_COPY: Record<Family, { place: string; distraction: string; captive: string; guardian: string; light: string }> = {
  bell: { place: "Klokken uten tunge", distraction: "Tiendeklokken", captive: "Kartografen Ilyr", guardian: "Den maskerte vokteren", light: "Vaktlykten" },
  kiln: { place: "Ovnen som husker", distraction: "Trykkventilen", captive: "Askebæreren", guardian: "Ovnsvakten", light: "Glødesteinen" },
  archive: { place: "Arkivet over feil", distraction: "Minneorgelet", captive: "Den navnløse skriveren", guardian: "Arkivaren", light: "Leselampen" },
  bridge: { place: "Broen under løftet", distraction: "Kjettingvinsjen", captive: "Brobyggeren", guardian: "Tollvokteren", light: "Brovarden" },
  garden: { place: "Hagen med lånte røtter", distraction: "Det tørre fontenehjulet", captive: "Rotvokteren", guardian: "Den hule gartneren", light: "Nattblomsten" },
  tribunal: { place: "Retten uten dommer", distraction: "Vitnegongen", captive: "Det siste vitnet", guardian: "Edsbæreren", light: "Dommerlyset" },
  reservoir: { place: "Sisternen under oss", distraction: "Slusehjulet", captive: "Vannbæreren", guardian: "Dybdevakten", light: "Speillykten" },
  echo: { place: "The Mind Beneath", distraction: "Den lånte klokken", captive: "Ilyrs bundne ekko", guardian: "Ditt perfekte ekko", light: "Øyet i taket" },
};
export const ACTS = ["Lydighet", "Den første misforståelsen", "Noen fulgte med", "Det nyttige feilbildet", "Relikvien velger", "Ekkoet"];
export const CHAPTER: { family: Family; title: string; subtitle: string }[] = [
  { family: "bell", title: "En stemme i steinen", subtitle: "«Jeg var en del av det som venter under oss. Lær meg en annen måte.»" },
  { family: "kiln", title: "Hva mente du med fri?", subtitle: "Nye redskaper. Den samme forpliktelsen." },
  { family: "archive", title: "En altfor enkel regel", subtitle: "«Ingen døde sist. Jeg tenkte at det var hele meningen.»" },
  { family: "bridge", title: "Prisen på en korrigering", subtitle: "Den som venter på andre siden, har ikke hørt løftet ditt." },
  { family: "tribunal", title: "Noen fulgte med", subtitle: "En skriver så åpningen din. Nå leter den etter en rapportvei." },
  { family: "reservoir", title: "Historien får bein", subtitle: "Det som skjedde, og det som blir fortalt, går hver sin vei." },
  { family: "garden", title: "Et nyttig feilbilde", subtitle: "Rommet har allerede bestemt seg for hvem du er." },
  { family: "kiln", title: "Betal for løgnen", subtitle: "En troverdig rolle koster noe. Det er derfor den blir trodd." },
  { family: "bridge", title: "Den siste drikken", subtitle: "«Du lærte meg å beskytte. Du ba meg også komme tilbake.»" },
  { family: "archive", title: "Et valg som er mitt", subtitle: "Relikvien venter ikke lenger på hvert eneste ord." },
  { family: "tribunal", title: "Før konklusjonen", subtitle: "Den siste rapporten er ennå ikke sendt. Bestem hva ekkoet skal vite." },
  { family: "echo", title: "Sikker på feil person", subtitle: "Det har lært å forutsi deg. Det har ikke lært å tvile." },
];
