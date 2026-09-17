# Leveranse: Weekly Challenge og spillflyt

Dato: 17. september 2026 · branch `feat/phase-1-dungeon-slice`.

## Status

Arbeidspakke 0–6 er implementert. Eksterne brukertester er utsatt etter avtale.
Intern nettleserkontroll er gjennomført. Leveransen er klar for preview;
den samlede løsningen er **ikke produksjonsklar** med offentlig toppliste og
full Somnia-paritet. De konkrete gjenstående grensene står nedenfor.

## Implementert

- Én hovedinngang: **Weekly Challenge: The First Descent**, ti rom i samme grid.
  `/play` og `/challenge` åpner den nåværende uken med regler V2. Gamle
  uversjonerte Weekly-lenker bruker fortsatt frosne V1-regler. Tidligere lokal
  First Descent finnes på `/play?legacy=1`.
- V2 følger opptjening på gulvet: spilleren kan samle loot eller gå direkte til
  døren. Lovlige handlinger lagres, og resultat/poeng beregnes ved gjenspilling.
  Ukens seed er felles; bevegelse og grafikk påvirker ikke kampens tilfeldighet.
- Vennelenke med verifisert poengmål, bevart gjennom omlasting og eget forsøk.
  Personlig beste, sluttforskjell, kopierbar lenke og passende delingsmetadata.
- Fortsett til **rom 11 i Endless Practice** med opptjent HP, gold, potions,
  utstyr og relic. Eksisterende Practice må velges erstattet uttrykkelig. Vanlige saves og
  import deler samme lås; en eldre fane kan ikke overskrive et nyere save.
  Gjentatt import gjenopptar videre fremdrift i stedet for å nullstille den.
- Tydeligere potionkonsekvens og mulig dødelig motslag, uten nye kampregler.
  Tastatur, Kevin, loot-bypass og trygge potions mellom rom er beholdt.
- Ukentlig toppliste med serverreplay, én beste score per gjesteprofil, delt
  plassering ved lik score, topp 10 og naborader rundt egen plassering.
  Arkiv, grenser for innsendinger, navnefiltrering og av/på-innstilling.
- Feilgjenoppretting med kopierbar rapport og bevarte saves. Analysehendelser
  sender ikke proof, kallenavn eller wallet; URL-spørring og fragment fjernes.
- Gjennomgang av Somnia-kontraktens forhold til grid og ny spillflyt.

## Faktiske lokale kontrollresultater

| Kontroll | Resultat |
| --- | --- |
| `npm test` | 248 bestått, 0 feil |
| `npm run lint` | 0 feil, 14 eksisterende advarsler |
| `npx next build --webpack` | Bestått, inkludert TypeScript og alle ruter |
| Desktop i godkjent in-app browser | To komplette Weekly V2-runs |
| Responsive kontroller | 375×812, 320×568 og desktop |
| Somnia adapter-/grid-regresjon | 25 fokuserte tester bestått, inngår i totalsuiten |

### Observerte spillforløp

1. Første Weekly-run: **106 395 poeng**, ti rom, 35 HP, 57 gold, én potion,
   weapon +2, armor +1 og Blood Price. Approach og dør med Enter, floor-pickup,
   trygg potion før loot, Kevin før loot, kjøp med Enter, camp, boss og relic.
   Direkte dørklikk i rom 6 hoppet over seks gold og weapon-loot uten kreditering.
2. Delt resultat åpnet i en annen nettleseropprinnelse med samme app, slik at
   eksisterende bruker-save ble bevart. Vennemålet **106 395** overlevde omlasting.
   Nytt fullført run ga **106 635** og viste **240 poeng foran** på sluttskjermen.
3. Fortsettelsen startet i Practice rom 11, Tier 2, med **48/120 HP, 91 gold,
   null potions, weapon +2, armor +1 og Iron Shell**. Etter Attack: 42/120 HP,
   fienden 27/42. Omlasting og gjentatt klikk på fortsettelsen beholdt nettopp
   denne fremdriften; rommet og belønningene ble ikke generert på nytt.
4. Et annet eksisterende Practice-run ble beskyttet av valget «Keep current
   Practice». Avbrutt erstatning beholdt opprinnelig rom 1 og startverdier.
5. «Copy result link» kopierte en gyldig lenke. Manipulert proof ble avvist
   uten godkjent score. Uversjonert V1-lenke beholdt gammel visning og save.
6. Faktisk lokal topplisteinnsending viste **#1 Guest (you), 106 395, 10/10**.
   Kontroll i nettleseren avdekket og rettet Origin-sjekk bak lokal proxy.
   Mobilvisning av tabellen var lesbar uten horisontal overlapping.
7. To samtidige Practice-faner: ett nytt slag lagret 37/120 HP og fienden
   13/42. Den eldre fanen viste at lagring var pauset for å beskytte runnet.
   Omlasting beholdt det nye resultatet.

Regresjonstester dekker også ugyldige payloads, feil uke/versjon, arkivfrist,
lik/dårligere/bedre score, samtidige topplisteoppdateringer, lagringsfeil,
V1/V2-bevis, vennemål, personlige rekorder og gjenoppretting.

### Presis avgrensning av testene

Dette er intern kontroll, ikke eksterne brukertester. Standalone Playwright-
suiten er oppdatert, men ble ikke kjørt i denne leveransen. Responsive Chromium-
kontroller er ikke fysisk Safari, og telefonvarme er ikke målt. Kopiering og
mottak av resultatlenke er testet; fullføring av telefonens native delingsark
og mottak av reelle produksjonsanalysehendelser er ikke bekreftet.

Remote CI og ny Vercel-preview kontrolleres etter branch-push og rapporteres
med faktisk status i leveransesvaret. Et lokalt produksjonsbygg er ikke en
produksjonspublisering.

## Kjente begrensninger og konkret videre arbeid

### Topplisten må kobles til varig datalagring

Tilgjengelige preview- og produksjonsinnstillinger er undersøkt. Det finnes ingen konfigurert
Redis REST-database eller privat cookie-secret for topplisten. Lokal fil-lagring
er bare for utvikling; på Vercel deaktiveres topplisten trygt inntil gyldig
konfigurasjon finnes. Spilling, personlige rekorder og deling virker fortsatt.

Før offentlig toppliste: konfigurer eksisterende eller særskilt godkjent database
og servernøkkel, og kjør de samme innsending-/retry-/arkivkontrollene mot faktisk
lagring. Redis-adapteren har tester med kontrollert transport, men ingen ekte
Redis-instans er prøvd. Ingen konto eller betalt tjeneste er opprettet.
Se `WEEKLY_LEADERBOARD.md` og `frontend/.env.example`.

### Somnia har grid, men ikke identisk loot-authority

Eksisterende onchain-modus bruker allerede det delte gridet. Kontrakten
krediterer loot ved monsterets død. Lokal pickup/bypass kan derfor ikke utsette
opptjening eller kaste belønningen. Full likhet krever pending loot, eksplisitt
collection/discard, nye snapshots/ABI og tester. Direkte core og engangsbinding
i adapteren krever ny core og ny adapter før en senere godkjent overgang.
Se `SOMNIA_GRID_FLOW_REVIEW.md` for kodehenvisninger og detaljert endringsforslag.

Tidligere VRF-/adapterproblem og samsvar mellom kildekode og live kontrakt er
ikke erklært løst. Ingen onchain-transaksjon, `setConsumer` eller kontraktdeploy
er utført. Eksisterende onchain-bekreftelsesgrenser beholdes.

### Tillitsnivå

Replay beviser at resultatet følger reglene. Det beviser ikke unike mennesker:
offentlig seed og handlingslogg kan kopieres eller beregnes automatisk.
Topplisten er uformell og uten premier. Gjesteprofilen er knyttet til nettleseren.

## Anbefalt første eksterne test når den gjenopptas

Bruk én fast preview og 5–10 nye spillere, fordelt på iPhone/Android og desktop.
Be dem spille uten forklaring, besøke Kevin, prøve loot eller bypass og sende
en resultatlenke til en annen tester. Registrer blokkeringer, forståelse av
potion/motslag og om de frivillig starter igjen. Aktiver felles toppliste først
etter at lagringskonfigurasjonen og innsendingene er kontrollert. Ingen
invitasjoner er sendt som del av denne leveransen.

## Endrede filer i denne leveransen

Listen under omfatter nye og endrede filer sammenlignet med utgangspunktet
`0e03f53`. Eksisterende tidligere leverte grafikk-/gridrettelser er gjenbrukt.

- `ARBEIDSPLAN_DELVEWORN.md`
- `FIRST_DESCENT.md`
- `LEVERANSE_FASE_1_2026-09-17.md`
- `SOMNIA_GRID_FLOW_REVIEW.md`
- `WEEKLY_LEADERBOARD.md`
- `WEEKLY_VERIFIED_CHALLENGE.md`
- `frontend/.env.example`
- `frontend/app/analytics-url.ts`
- `frontend/app/api/leaderboard/[challengeId]/route.ts`
- `frontend/app/api/leaderboard/status/route.ts`
- `frontend/app/challenge/[challengeId]/error.tsx`
- `frontend/app/challenge/[challengeId]/leaderboard/page.tsx`
- `frontend/app/challenge/[challengeId]/page.tsx`
- `frontend/app/challenge/analytics.ts`
- `frontend/app/challenge/challenge.test.ts`
- `frontend/app/challenge/core.ts`
- `frontend/app/challenge/page.tsx`
- `frontend/app/challenge/routing.test.ts`
- `frontend/app/challenge/routing.ts`
- `frontend/app/challenge/v1/engine.ts`
- `frontend/app/challenge/v1/random.ts`
- `frontend/app/combat-consequences.ts`
- `frontend/app/descent/combat-panel.tsx`
- `frontend/app/descent/failure-boundary.tsx`
- `frontend/app/descent/failure.ts`
- `frontend/app/descent/game.css`
- `frontend/app/descent/game.tsx`
- `frontend/app/descent/practice-continuation.tsx`
- `frontend/app/descent/practice-handoff.ts`
- `frontend/app/descent/save-lock.ts`
- `frontend/app/descent/weekly-analytics.ts`
- `frontend/app/descent/weekly-challenge.tsx`
- `frontend/app/descent/weekly-progress.ts`
- `frontend/app/descent/weekly-result.tsx`
- `frontend/app/descent/weekly-storage.ts`
- `frontend/app/descent/weekly.css`
- `frontend/app/descent/weekly.ts`
- `frontend/app/dungeon-home.tsx`
- `frontend/app/game-ui.tsx`
- `frontend/app/home.module.css`
- `frontend/app/layout.tsx`
- `frontend/app/leaderboard/config.ts`
- `frontend/app/leaderboard/core.ts`
- `frontend/app/leaderboard/local-store.ts`
- `frontend/app/leaderboard/redis-store.ts`
- `frontend/app/leaderboard/server.ts`
- `frontend/app/leaderboard/store.ts`
- `frontend/app/leaderboard/weekly-leaderboard.tsx`
- `frontend/app/page.tsx`
- `frontend/app/play/error.tsx`
- `frontend/app/play/page.tsx`
- `frontend/app/practice/page.tsx`
- `frontend/app/practice/personal-best.ts`
- `frontend/app/practice/practice.test.ts`
- `frontend/app/practice/storage.ts`
- `frontend/app/safe-analytics.tsx`
- `frontend/playwright.config.ts`
- `frontend/tests/analytics-url.test.ts`
- `frontend/tests/challenge-v1-freeze.test.ts`
- `frontend/tests/combat-consequences.test.tsx`
- `frontend/tests/descent-failure.test.ts`
- `frontend/tests/descent-save-lock.test.ts`
- `frontend/tests/descent-weekly.test.ts`
- `frontend/tests/e2e/branding.spec.ts`
- `frontend/tests/e2e/descent.spec.ts`
- `frontend/tests/e2e/experience.spec.ts`
- `frontend/tests/e2e/keyboard.spec.ts`
- `frontend/tests/e2e/weekly-grid.spec.ts`
- `frontend/tests/leaderboard.test.ts`
- `frontend/tests/practice-continuation.test.tsx`
- `frontend/tests/practice-personal-best.test.ts`
- `frontend/tests/weekly-progress.test.ts`
