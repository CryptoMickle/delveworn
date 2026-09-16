# Arbeidsplan: spillflyt, gjenspilling og Weekly-toppliste

Dato: 16. september 2026. Utgangspunkt: lokal revisjon `8b8b3f2`.
Status: pakke 0 og 1 er implementert og lokalt verifisert. Review-preview og
faktisk telefon-/nettleserkontroll gjenstår før pakke 2 startes.

## Leveransestatus

- Kontrollgrunnlaget er oppdatert til 200 beståtte tester, bestått TypeScript-
  kontroll, bestått produksjonsbygg og 14 kjente lint-advarsler uten nye feil.
- Weekly V1 har fått et fast replay-eksempel som låser challenge-ID, handlingslogg,
  resultat, run-ID og bevis før senere Weekly-arbeid.
- First Descent har nå samme piltast/Enter-kontrakt i start, butikk, relic-valg
  og sluttskjerm. Kevins originale butikkbilde kan åpnes i full størrelse.
- Åpningsreplikken får full lesetid før én eventuell kampreaksjon. Køen tømmes
  ved seier, død eller rombytte og påvirker ikke spillets tilfeldighetssekvens.
- Automatisk nettleserkjøring er fortsatt blokkert av den tidligere obligatoriske
  policykontrollen. E2E-testene er oppdatert, men kan først godkjennes gjennom
  en tillatt nettleserkjøring eller manuell kontroll av review-previewen.

## Mål og rammer

Spilleren skal enkelt komme inn, forstå kampvalgene, få lyst til å fortsette med
sin første relic og kunne utfordre en venn i samme ukentlige dungeon. En liten
toppliste skal støtte denne flyten.

- Behold originalgrafikken, monsterrommene, Kevin og eksisterende kampkjerne.
- Nye runs starter med 100 HP, tre potions og ingen relic. Ingen innledende relic-valg.
- Behold WASD for gange, piltaster/Enter for knapper og eksisterende muse-/touchstyring.
- Behold automatisk loot-pickup ved ankomst, direkte dørklikk for bypass og healing mellom rom.
- Maks to monsterreplikker per kamp. Ingen avsluttende replikk fra et beseiret monster.
- Wallet-fri spilling først. Kjernen forblir kjedeagnostisk; eventuell onchain-versjon er Somnia.
- Somnia-adapter/VRF regnes ikke som avklart. Ingen kontrakttransaksjoner inngår.
- Market Dungeon og synkroniserte referansefiler under `sources/` berøres ikke.
- Ingen Farcaster-, Telegram-, Discord-, SDK-, grant- eller partnerskapsoppgaver.
- Videre arbeid med telefonvarme står på vent som avtalt.

## Modell og resonneringsnivå

**Anbefalt standard for hele planen: GPT-5.6 Sol · Extra High (`xhigh`).**

Dette følger brukerens ønskede GPT-5.6/Extra High-oppsett. Sol er det presise
modellnavnet; OpenAI oppgir at `gpt-5.6` peker til Sol og at modellen støtter
`xhigh`. Valget av Extra High til dette prosjektet er vår arbeidsanbefaling,
særlig fordi romtilstand, lagring, gjenspilling og servervalidering henger sammen.
[Offisiell modellbeskrivelse](https://developers.openai.com/api/docs/models/gpt-5.6-sol).

| Arbeid | Anbefalt modell | Nivå |
| --- | --- | --- |
| Planlegging, gjennomføring og feilsøking, alle arbeidspakker | GPT-5.6 Sol | Extra High |
| Uavhengig kontroll av lagring, Weekly-regler og toppliste | GPT-5.6 Sol, separat gjennomgang | Extra High |
| Oppsummering av tester, dokumentasjon og spillertilbakemeldinger | GPT-5.6 Sol | Extra High, samme prosjektstandard |

Oppsettet er en anbefaling for kommende arbeid; planen endrer ikke modellvalget
i den aktive samtalen. Høyere resonneringsnivå erstatter ikke faktisk testing.
Parallelle agenter får avgrensede oppgaver, og to agenter skal ikke samtidig
redigere samme del av spilltilstanden.

## Rekkefølge

| Pakke | Leveranse | Avhengighet | Omfang |
| --- | --- | --- | --- |
| 0 | Fastsett kontrollgrunnlag, regler og testløype | Ingen | Liten |
| 1 | Tastatur, replikk-timing og Kevin-butikk | 0 | Middels |
| 2 | Tydelig inngang og kampinformasjon | 0; samordnes med 1 | Middels |
| A | Første spilltest med 5–10 nye spillere | 1 og 2 | Avhenger av testere |
| 3 | Fortsett fra First Descent til rom 11 | 1 og 2 | Middels |
| 4 | Weekly Challenge i det delte grid-grensesnittet | 1 og 2 | Stor |
| 5 | Personlige rekorder, vennemål, deling og måling | 3 og 4 for samlet levering | Middels |
| 6 | Enkel ukentlig toppliste | 4 og 5 | Stor |
| B | Samlet kvalitetssjekk og ny ekstern test | 3–6 | Middels + testere |

Omfang er relativt, ikke et kalenderløfte. Backendtilgang og faktisk telefon-/
nettlesertesting må avklares før en bindende leveringsdato. Pakke 3 og 4 kan
utvikles parallelt etter at felles romgrensesnitt er stabilt.

## 0. Kontrollgrunnlag og regelavklaringer

**Arbeid**

- Registrer branch, revisjon, uferdig arbeid og teststatus før implementering.
  Kontrollgrunnlaget er 196 beståtte tester, bestått Somnia-standardbygg og
  14 kjente lint-advarsler. Kontroller status på nytt ved oppstart.
- Lag én kort regresjonsløype: start → bevegelse → kamp → potion → loot eller
  bypass → Kevin → boss → relic → rom 11 → lagre/gjenoppta.
- Oppdater utdaterte beskrivelser av J/K/M, Kevins plassering og start-relics
  i relevant dokumentasjon. Dagens kode og siste avtalte oppførsel er grunnlaget.
- Fastsett potionforklaringen: behold nåværende beregning som utgangspunkt,
  og la visningen forklare faktisk slutt-HP. Dagens formel trekker motslaget
  fra HP + 25 før maksimumsgrensen brukes. En endring i denne rekkefølgen er
  en separat spillregelendring, med lokal/Somnia-paritet og versjonering.
- Frys eksempler på eksisterende Weekly-bevis og score som sammenligningsgrunnlag.

**Ferdig når:** forventet oppførsel og testtilfeller er dokumentert, særlig
potion ved nesten full HP, gamle Weekly-lenker og eksisterende Practice-lagring.

## 1. Rett spillflyt og presentasjon

### 1A. Samme tastaturflyt gjennom hele spillet

- Gjør butikk, relic-valg og avslutningsknapper i First Descent navigerbare
  med piltaster og Enter, med tydelig fokus på første relevante handling.
- Desktopbutikken åpnes for handel etter spillerens og Kevins ankomst.
  Behold kølagt besøk dersom spilleren kommer før Kevin er ferdig.
- Vis en kort ventebeskjed ved behov. Ett fysisk Enter-trykk gir én handling.
- Behold muligheten til å gå videre uten handel; ingen ny tvungen butikksekvens.

**Ferdig når:** en spiller kan fullføre med tastatur uten museklikk for å
gjenopprette fokus. Test også room 10 → relic → room 11, dobbelttrykk,
deaktiverte kjøp og lukking av butikk.

### 1B. To replikker som faktisk kan leses

- Vis åpningsreplikken sammen med eller over monsterets nærbilde.
- La den første kampreaksjonen vente til den kan vises og leses uten å bli
  skjult av nærbildet eller umiddelbart erstatte åpningen.
- Behold nærbildets avtalte to sekunder og taleboblens lesetid. Ingen nye
  ventekrav for Attack, Storm eller Potion.
- Avbryt ventende tale ved monsterets død eller rombytte. Manuell åpning av
  artwork gir ikke flere replikker eller en ny replikkkvote.

**Ferdig når:** approach → umiddelbart attack → flere raske handlinger gir
maks to synlige replikker. Ingen tekst forbrukes skjult, og et dødt monster
forblir stille. Kort kamp kan naturlig ende med bare åpningsreplikken.

### 1C. Kevin-butikk på mobil

- Bruk en mindre, komplett originalillustrasjon med mulighet for stor visning.
  Unngå beskjæring av Kevin, vogna og skiltet.
- Fjern overflødige gjentakelser av butikk-/Kevin-overskrifter.
- Prioriter HP, gold, potions, weapon/armor og de første kjøpsvalgene innenfor
  samme skjerm. Resten av butikken skal være lett å rulle til.
- Behold ønsket speilvendt komposisjon, men rett skiltteksten så den er lesbar.
  Gjenbruk behandlingen av skiltet som allerede finnes i romgrafikken.

**Ferdig når:** butikken er kontrollert på iPhone 11 Pro-størrelse, liten telefon
og desktop; originalgrafikk, verdier og kjøp er lesbare uten overlapp.

**Berørte områder:** `app/descent/game.tsx`, `app/desktop-navigation.tsx`,
`app/dungeon/monster-speech.*`, `app/descent/monster-reveal.*`,
`app/dungeon/shop-vitals.*`, `app/dungeon/merchant-art.tsx` under `frontend/`.

## 2. Tydelig inngang og tydelige kampkonsekvenser

**Arbeid**

- Gjør «Spill gratis» til tydelig hovedinngang for nye spillere, med First
  Descent som introduksjon. Vis «Fortsett» når et passende lokalt run finnes.
- La Endless Practice og Weekly være tydelige alternativer. Onchain er et
  separat, valgfritt valg. Delte Weekly-lenker går direkte til rett utfordring.
- Behold statusbaren og kjente knappeplasseringer: Storm venstre, Attack høyre,
  Potion i midten på mobil. Unngå at informasjon flytter på rommet mellom turer.
- Vis én kort «ga skade / tok skade»-oppsummering på mobil. Reduser overflødig
  gjentakelse av status før teksten gjøres mindre.
- Vis potionens faktiske forventede HP-intervall, inkludert redusert motslag,
  HP-grense og gjeldende relic-effekter. Mellom rom vises trygg healing.
- Marker når et mulig motslag er dødelig, uten å hevde at et tilfeldig utfall
  er sikkert eller overse at et sikkert dødelig slag hindrer motslaget.

**Ferdig når:** nye spillere finner starten, forstår de tre kampvalgene og kan
forklare hvorfor HP endret seg. Visningen stemmer med motoren for vanlig kamp,
kritisk treff, full/nesten full HP, potiongrense og relevante relics.

**Berørte områder:** `dungeon-home.tsx`, `game-ui.tsx`, `descent/combat-panel.*`,
`dungeon/endless-room.*`, eksisterende feedback og tester.

## Testpunkt A. Første eksterne spilltest

Bruk én fast preview-versjon og 5–10 nye spillere, med både telefon og desktop.
Gi dem målet «spill så langt du kommer», og observer før du forklarer knappene.

- Registrer startvansker, uklare kampvalg, dør/loot-forvirring og blokkeringer.
- Se om spillerne finner potion, Kevin og relic-valget uten hjelp.
- Registrer hvem som frivillig starter igjen og hva de ønsker å prøve neste gang.
- Død i spillet er et gyldig utfall; målet er forståelig og fungerende flyt.

**Videregang:** rett alle bekreftede blokkeringer før topplisten prioriteres.
Utvalget gir kvalitative funn, ikke sikre konklusjoner om marked eller retention.
Utsending av invitasjoner gjøres bare når brukeren har bedt om det.

## 3. Gi den opptjente relicen videre verdi

**Arbeid**

- Tilby «Fortsett til rom 11 i Practice» etter fullført First Descent og
  eksisterende relic-valg. Behold også oppsummering og «Start nytt run».
- Overfør faktisk opptjent HP, gold, potions, weapon/armor, relic-samling,
  valgt relic og romprogresjon til gyldig Practice-tilstand.
- Bruk eksisterende Practice-motor, validering og lagringsformat. Fortsettelsen
  er lokal Practice, ikke et Weekly-verifisert eller onchain-resultat.
- Bevar avsluttet First Descent som oppsummering. Overføringen må være trygg
  ved dobbeltklikk, omlasting, lagringsfeil og konkurrerende faner.
- Bruk en separat, validert overføringspost. Practice tar imot den først etter
  at floor loot og relic-valget er avsluttet. Identifiser importen med det
  opprinnelige run-ID-et, slik at en gjentatt import ikke nullstiller videre
  fremdrift. First Descent skal ikke skrive direkte over Practice-lagringen.
- Dersom et Practice-run finnes fra før, behold det inntil spilleren velger
  uttrykkelig å erstatte det. Ved avbrudd skal begge opprinnelige saves bestå.
- Generer rom 11 én gang gjennom den ordinære motoren; ikke gi nye startverdier
  eller en ekstra kopi av bossbelønningen.
- Bruk normal Practice-randomness videre. Ved utilgjengelig lagring skal en
  eventuell fortsettelse i minnet merkes tydelig og ikke regnes som lagret.

**Ferdig når:** begge relic-valgene kan fortsette til rom 11 med riktig tilstand,
spilleren kan bruke relicen i kamp og gjenoppta etter omlasting. Et nytt run
starter fortsatt fra standardsettet uten relic. Eksisterende saves overskrives
ikke automatisk.

**Berørte områder:** `descent/model.ts`, `descent/game.tsx`, `descent/storage.ts`,
`practice/storage.ts`, `practice/grid-state.ts`, Practice-inngangen og run-card.

## 4. Weekly Challenge i det samme grid-grensesnittet

**Arbeid**

- Gjenbruk eksisterende rom, monsterkunst, bevegelse, kampknapper, Kevin,
  resultatkort og tilgjengelighetsmønstre. Weekly beholder sin egen myndighet
  over seed, handlinger, poeng og verifisering.
- Kartlegg forskjellen mellom dagens Weekly og gridets fysiske loot. Weekly
  V1 krediterer loot gjennom kampmotoren; fremtidig utsatt pickup/bypass må
  ikke late som belønningen kan forsvinne når beviset sier at den er mottatt.
- Behold gamle V1-bevis og resultater. Dersom lik grid-oppførsel krever endrede
  belønninger, handlinger, RNG-forbruk eller poeng, innfør en eksplisitt ny
  regelversjon fra en fastsatt uke, med egen replay-støtte for gammel versjon.
- Før topplistearkiver tas i bruk, lås V1-oppførselen bak en versjonsstyrt
  verifier. Dagens verifier importerer den løpende Practice-motoren og godtar
  bare gjeldende versjonskonstant. Senere endringer i Practice må verken endre
  gamle scorer eller gjøre gamle bevis uleselige.
- Weekly V1 avsluttes ved første boss-seier, før et relic-valg. Det nye
  grensesnittet skal ikke legge til First Descent sin belønningsfase i V1.
- Bevegelse, artwork, Kevin-animasjon og nye monsterreplikker skal ikke bruke
  kampens tilfeldighetssekvens eller telle som poenggivende spillhandlinger.
  Eksisterende V1-forbruk til loggtekst må også bevares ved replay.
- Test både direkte Weekly-inngang og gamle/delte utfordringslenker.

**Ferdig når:** to spillere kan åpne samme ID og regler; samme lovlige handlingslogg
gir samme resultat på klient og server. Manipulerte/ugyldige bevis avvises.
Gamle lenker beholder gamle resultater. Practice- og Somnia-flyt er bevart.

**Berørte områder:** `challenge/challenge-client.tsx`, `challenge/core.ts`,
`challenge/storage.ts`, felles `dungeon/`-komponenter og replay-tester.

## 5. Personlig rekord, vennemål, deling og måling

**Arbeid**

- Behold vennens verifiserte resultat gjennom start, lagring/gjenopptak og eget
  sluttresultat. Vis et diskret mål og sammenligning etterpå.
- Valider det lagrede målbeviset på nytt ved gjenopptak; ikke stol på et lokalt
  redigert poengtall. Deling fungerer også uten innsending til topplisten.
- Sammenlign bare samme challenge-ID og regelversjon. Vis seier, likt resultat
  eller gjenstående poeng uten at en venns resultat blandes inn i egen score.
- Lagre personlig beste for Weekly per utfordring/regler. Skill dette fra lokal
  Practice-rekord, som fortsatt merkes som selvrapportert.
- Gjenbruk delingsarket, kopieringsfallback og resultatkort. Tilby en tydelig
  «Prøv å slå dette»-lenke og svar-deling etter et henvist forsøk.
- Gi First Descent et lokalt resultatkort og vei videre til Weekly. Ikke kall
  First Descent-resultatet replay-verifisert uten en kompatibel handlingslogg.
- Gi Weekly en passende lenkeforhåndsvisning; vis bare score dersom beviset er
  validert. Resultatlenker må fungere selv om mottakeren ennå ikke har profil.
- Utvid eksisterende, begrensede analysehendelser med start/fortsettelse fra
  forsiden, fullføring, frivillig nytt forsøk og overgang til rom 11.
  Skill unike Weekly-starter fra gjentatte forsøk; behold eksisterende referral-
  og senere-uke-målinger. Ingen proof, kallenavn eller wallet i analysehendelser.

**Ferdig når:** A deler → B ser målet → B spiller → B ser forskjellen → B deler
tilbake. Gjenopptak bevarer målet, avbrutt deling teller ikke som gjennomført
deling, og analysefeil blokkerer aldri spillet.

## 6. Ukentlig toppliste V1

### Produktet

- Én toppliste per challenge-ID og regelversjon. Samme seed og scoreformel.
- Ubegrensede forsøk; bare beste resultat per gjesteprofil teller.
- Topp 10, egen plassering og noen resultater rundt egen plassering.
- Like poeng gir delt plassering. Ingen tidsbonus eller telefonavhengig rangering.
- Bruk rangeringen 1, 2, 2, 4. Ved lik score beholdes første godkjente resultat;
  innsendingsrekkefølge brukes bare for stabil radvisning, ikke bedre plassering.
  Vis to naborader på hver side av egen rad, uten å gjenta rader fra topp 10.
- Automatisk gjesteprofil uten wallet, e-post eller obligatorisk kallenavn før
  spilling. Valgfritt kallenavn etter første run; et generert navn fungerer også.
- Personlig rekord og vennemål vises sammen med plasseringen.
- Ny uke mandag 00:00 UTC. Tidligere lister arkiveres for lesing, ikke slettes.
- Serverens klokke avgjør fristen. Et run levert etter fristen kan deles som
  historisk resultat, men flytter ikke den avsluttede topplisten. Dette forklares.

### Minste tekniske løsning

- Bruk en liten serverfunksjon og varig datalagring. Undersøk eksisterende
  tilgang først; ingen ny konto eller betalt tjeneste opprettes automatisk.
- Gjenbruk replay-motoren på serveren. Serveren validerer challenge, regler,
  handlingsgrenser og terminal tilstand og beregner poeng selv. Klientens
  oppgitte score eller plassering skal aldri være autoritativ.
- Gjesteprofilen får en serverutstedt hemmelig øktidentitet. Klienten kan ikke
  velge en annens profil-ID. Slettet nettleserlagring kan miste profilen;
  en gjesteprofil er ikke en garantert unik person.
- Oppdater beste resultat atomisk: samtidige innsendinger og retries gir ikke
  dobbeltoppføringer eller erstatter en bedre score med en svakere.
- Håndter gjeninnsending per profil og utfordring. To ulike profiler kan lovlig
  ha identiske handlingslogger og resultater; proof-hash er ikke en person-ID.
- Begrens forespørsler, størrelse og replay-arbeid. Valider kallenavn og ha en
  enkel måte å skjule spam/åpenbart upassende navn på. Feil i topplistetjenesten
  må ikke stoppe kamp, lokalt resultat eller deling.
- Lagre bare nødvendig profil, ukebeste, tilhørende replay-bevis og tidspunkt.
  Fastsett sletting, arkivering og eventuell kort levetid for driftslogger før
  ekstern bruk. Ingen fingeravtrykk for å prøve å identifisere spilleren.

### Hva «verifisert» betyr

Serveren kan kontrollere at poengsummen følger reglene. Offentlig seed og
delbare handlingslogger kan fortsatt kopieres eller beregnes automatisk.
Servervalidering, signaturer eller en wallet beviser ikke alene menneskelig spill.
V1 er derfor en uformell konkurranse uten premier eller påstander om full
juksebeskyttelse. Sterkere konkurransekrav blir en egen senere oppgave.

**Ferdig når:** falske scorer, feil uke/regelversjon og ulovlige logs avvises;
bedre/dårligere/like resultater rangeres riktig; nye og gamle uker er adskilt;
retry, samtidighet, tom liste, gjesteprofil og lagringsfeil er testet. Egen
plassering stemmer også utenfor topp 10. Ingen konto kreves for å spille.

## Testpunkt B. Samlet kontroll og leveranse

**Automatisert**

- Relevante enhets-, integrasjons- og regresjonstester, lint og bygg skal bestå.
  Kontroller eksisterende CI-konfigurasjoner uten å aktivere nye onchain-løfter.
- Gjør nye, viktige overgangstester varige i repoet, inkludert tale/artwork,
  tastaturkjøp, relic → rom 11 og Kevin før/etter relic.
- Nettlesertester skal dekke den faktiske Practice-/Weekly-flyten på iPhone 11
  Pro-størrelse, ikke bare First Descent, samt desktop og en mindre telefon.
- Test hele delings- og rangeringsløypa, også API-feil, gammel proof-versjon,
  ugyldig payload, ukegrense og gjenopptak.

**Faktisk bruk**

- Kontroller mobil Safari med browserfelt åpent/lukket, scroll, butikk, dør og
  gjenopptak. Test desktop kun med tastatur og separat med mus.
- Gjenta ekstern test med samme oppgaver; vurder hvor spillere stopper, om de
  frivillig spiller igjen og om delte lenker fører til nye forsøk.
- Bekreft reelle analysehendelser uten å samle unødvendige personopplysninger.

**Leveranse**

- Én gjennomgått revisjon med endringsoversikt, faktiske testresultater,
  kjente begrensninger, oppdaterte spilleregler/personvern og fungerende preview.
- Bruk eksisterende preview-godkjenning innenfor dens rammer. Produksjons-
  publisering er en separat beslutning etter at konkret resultat kan vurderes.
- Topplisten skal kunne slås av uten å deaktivere Weekly-spilling og deling.

Nettleserkjøring er for tiden blokkert av en tidligere obligatorisk policykontroll.
Det omgås ikke. Kode-/replay-arbeid og tester uten nettleser kan gjennomføres,
men faktisk nettleser-/telefonkontroll kan ikke markeres som bestått uten bevis.

## Avgrensede beslutninger underveis

| Tema | Planens utgangspunkt | Når avklaring faktisk trengs |
| --- | --- | --- |
| Potionregler | Behold beregning; rett forklaring og konsekvensvisning | Før eventuell spillregelendring |
| First Descent → Practice | Behold opptjent tilstand og eksisterende saves | Spilleren velger selv eventuell erstatning av lagret Practice-run |
| Weekly-versjon | Bevar V1; versjoner nødvendige regelendringer | Pakke 4, før ny ukedefinisjon låses |
| Server/database | Undersøk og gjenbruk tilgjengelig oppsett | Dersom ny konto, kostnad eller ekstern publisering er nødvendig |
| Topplisteidentitet | Enkel gjesteprofil; ingen wallet-plikt | Før eventuell senere konto-/premieløsning |
| Telefonvarme | Videre tiltak står på vent | Når brukeren tar opp arbeidet igjen |

## Første implementeringsleveranse

Start med pakke 0 og 1: fastsett regresjonsgrunnlaget, rett tastaturflyten,
samordne de to replikkene med monsterbildet og forbedre Kevin-butikken på mobil.
Lever én samlet review-preview før fortsettelse, Weekly-ombygging og toppliste.
