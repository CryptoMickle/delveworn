# Oppfølging: Redis og Somnia V4

Dato: 17. september 2026. Utgangspunkt: `cfff2eb` på
`feat/phase-1-dungeon-slice`.

## Resultat

Weekly, Practice og det delte gridet er bevart. Denne oppfølgingen retter to
reelle Redis-feil og implementerer kontraktstyrt loot for en fremtidig Somnia
V4. Den eksisterende Somnia-adressen er uendret og beholder legacy-reglene.

**Klar for preview; ikke produksjonsklar med full Somnia-paritet.** Ingen
kontrakt er publisert, ingen kjedetransaksjon er sendt og ingen aktive runs er
flyttet. Eksterne brukertester og videre måling av telefonvarme er fortsatt utsatt.

## Levert

- Ekte Redis-test av produksjonens Lua-operasjoner. Tomme uker returnerer nå
  en gyldig tom liste, og siste sorteringsregel ved identisk score/tid er lik
  i lokal lagring og Redis. Samtidige forsøk beholder ett beste resultat.
- Verifisert handlingsbevis lagres privat sammen med nye innsendte resultater.
  Topplistens offentlige svar utleverer ikke beviset eller gjestens hemmelige ID.
- Somnia V4 lagrer loot uten å kreditere spillerens beholdning. Pickup
  krediterer én gang, vanlig dør-bypass forkaster atomisk, og boss-loot må
  avgjøres før relic-valget. Omlasting kan gjenopprette loot fra kontrakten.
- Trygge potions og lovlige Kevin-kjøp virker før pickup. En ventende potion
  reserverer plass mot grensen på fem.
- Frontend støtter V4 og de eksisterende kontraktene. Usikre nettverkssvar
  nedgraderer ikke V4 til legacy. Gamle session-grants som mangler nye
  tillatelser bruker den tilkoblede walletens vanlige godkjenning.
- Forsinkede VRF-hendelser kan ikke alene avslutte en ny handling. Etter
  uklare innsendingsfeil venter klienten på kontraktens tilstand, også når
  transaksjonen først lander etter flere uendrede avlesninger.
- Solidity-versjon og EVM-mål er låst. CI kontrollerer størrelsen på
  produksjonskontraktene, bygger alle Solidity-filer og kjører alle testene.

## Faktiske lokale resultater

| Kontroll | Resultat |
| --- | --- |
| Frontend, `npm test` | 270 bestått, 0 feil |
| Lint | 0 feil, 13 eksisterende advarsler |
| Produksjonsbygg med webpack, inkludert TypeScript | Bestått |
| Ekte Redis 7.2.7 | 5 bestått, 0 feil, inkludert overordnet test |
| Forge under låst profil | 152 bestått, 0 feil |
| Solidity-format og full bygging | Bestått |
| Delveworn runtime | 24 255 byte; 321 byte under EIP-170 |
| Byggprofil | Solidity 0.8.35, Prague, optimizer 200, via IR |
| Frontend mot faktisk Forge-ABI | V4-tuple, pending-loot-getter og 16 custom errors samsvarer |

Redis-testen starter en isolert lokal Redis via Unix-socket og kjører de ekte
Lua-operasjonene. Den tester ikke alene Upstash-autentisering eller en
publisert Vercel-instans. Frontendens wallet-/feiltester er kontrollerte
regresjonstester; de er ikke en levende wallet-/VRF-runde på Shannon.

## Nettleser og live lesekontroll

Den allerede publiserte `cfff2eb`-previewen er kontrollert i nettleser:
forsiden viser én Weekly-inngang, og den delte V2-lenken viser **106 395 poeng,
10 rom, 35 HP, 57 gold og én potion**, verifisert ved replay. Den tidligere
blokkeringen av denne kontrollen er avklart. Topplisten viste ærlig utilgjengelig
lagring før databaseoppsett. Ingen eksisterende brukerlagring ble slettet.

Den lesende Somnia-kontrollen bekrefter at live core, adapter og native
koordinator finnes og peker riktig. Den beviser ikke statusen til alle historiske
VRF-forespørsler; adapteren har ikke en komplett liste-/antall-getter.
Se [preflight med blokknummer og nøyaktige funn](./SOMNIA_READONLY_PREFLIGHT_2026-09-17.md).

## Aktivering og begrensninger

Upstash Redis er nå opprettet via Vercel etter uttrykkelig godkjenning, også
av Marketplace-vilkårene. `delveworn-weekly-preview` bruker gratisplan i IAD1,
med bare `delveworn-app (preview)` tilkoblet. Opprettelsen slo av automatisk
oppgradering, Prod Pack og eviction. Privat cookie-secret og REST-tilkobling
er konfigurert på serveren. Produksjonsinnstillingene er uendret.

Hosted kontroll mot faktisk Redis/Vercel bestod alle disse sjekkene:

- tom uke og arkiv kan leses;
- første verifiserte innsending lagres, gjentakelse beholder samme oppføring;
- bedre score erstatter den gamle og kan leses i en senere forespørsel;
- bevis og hemmelig gjeste-ID utleveres ikke i offentlig svar;
- historisk innsending, ugyldig bevis og feil Origin avvises.

Testoppføringen **Preview QA** ble forbedret fra **50 840** til **107 190**
poeng. Nettleseren viser én rad på førsteplass, 10/10 rom. Dette er en merket,
intern automatisk test, ikke et resultat fra en ekstern spiller.

Kode `b9820dd` har bestått [alle fire Frontend CI-jobber](https://github.com/CryptoMickle/delveworn/actions/runs/35204628725)
og [Contracts CI](https://github.com/CryptoMickle/delveworn/actions/runs/35204628841).
Alle tre tilknyttede Vercel-previewbygg var grønne. Databasetesten og den siste
nettleserkontrollen brukte `delveworn-app`, deploy
`dpl_BUPBBDSNbr9Yw7FWwUREWA8buLqN`, med samme kode og ny databasekonfigurasjon.

[Åpne preview](https://delveworn-app-git-feat-phase-1-dungeon-slice-crypto-mickle.vercel.app)
eller [topplisten for uke 38](https://delveworn-app-git-feat-phase-1-dungeon-slice-crypto-mickle.vercel.app/challenge/2026-W38/leaderboard).
En senere dokumentasjonsoppdatering endrer ikke den testede spillkoden.

Full V4-paritet på Somnia krever senere uttrykkelig godkjent deploy av både
ny core og ny adapter, avklaring av gamle forespørsler/aktive runs og en
kontrollert adresseovergang. Direkte kontrakter oppgraderes ikke ved å
publisere denne frontenden. Se [V4-beskrivelse og migrasjonsgrenser](./SOMNIA_PENDING_LOOT_V4.md).

Ved vedvarende uklare wallet-svar stanser nye handlinger. Gjenoppretting ved
omlasting krever igjen lesbar kontraktstilstand. Dette er bevisst for å unngå
at en forsinket handling forveksles med en mislykket handling.

Kontrakten har begrenset bytecode-margin. Senere endringer må fortsatt bestå
størrelseskontrollen; terskelen er ikke hevet for å få implementeringen gjennom.

## Endrede områder

- Kontrakt: `src/Delveworn.sol`, `foundry.toml`,
  `.github/workflows/test.yml` og eksisterende kontrakt-/balanse-/relic-tester.
- Onchain-klient: `frontend/app/onchain-game.tsx`, `onchain-presentation.ts`,
  nye `onchain-v4.ts`, `onchain-vrf.ts`, `onchain-recovery.ts`,
  `dungeon/endless-room.tsx` og tilhørende tester.
- Toppliste: `frontend/app/leaderboard/{core,redis-store,server,weekly-leaderboard}`,
  `frontend/tests/leaderboard.test.ts`, ny `leaderboard-redis.integration.ts`,
  `frontend/package.json` og `.github/workflows/frontend.yml`.
- Dokumentasjon: denne rapporten, arbeidsplanen, opprinnelig leveranse,
  `WEEKLY_LEADERBOARD.md`, `SOMNIA_GRID_FLOW_REVIEW.md` og de to nye Somnia-rapportene.

## Første eksterne test når den gjenopptas

Bruk en fast preview med 5–10 spillere fordelt på telefon og desktop. La dem
fullføre eller dø i Weekly, prøve Kevin/loot-bypass og sende inn et resultat.
Kontroller at en venn kan åpne lenken og at begge finner riktig toppliste.
Dette er anbefalt neste test, ikke en test som er gjennomført her.
