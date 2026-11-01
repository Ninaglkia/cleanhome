# CleanHome RN — istruzioni per gli agenti

Questo file lo leggono sia **Claude Code** sia **Codex**. Nino, il committente, parla italiano: rispondigli in italiano, con frasi brevi. Codice, commenti e messaggi di commit in inglese.

## Il progetto
Marketplace di pulizie (cliente ↔ pulitore): Expo + React Native + TypeScript + NativeWind, backend Supabase, pagamenti Stripe Connect.
Regole complete, architettura, file chiave e checklist sono in `CLAUDE.md`: leggilo, vale anche per Codex (tranne le parti sugli strumenti di Claude).
- **Obiettivo attuale** (`CLAUDE.md` §6): finire il design "Pulitori" (verde, `lib/design/pulitori.ts`, `PColor`) e il checkout, poi TestFlight. Niente nuove funzioni finché questi due non sono chiusi.

## Come lavoriamo in due senza pestarci i piedi
1. **Ruoli.** Claude Code integra, prova sul simulatore iOS, fa commit/push su `main` e tiene aggiornati gli appunti. Codex lavora sui compiti assegnati in bacheca e fa revisione del codice; scrive codice solo nel suo spazio.
2. **Spazi separati.** Claude lavora in `~/CleanHomeRN` (branch `main`). Codex modifica file solo in `~/CleanHomeRN-codex` (branch `codex`), mai nella cartella di Claude. Leggere tutto, ovunque, va bene. Unica eccezione: `~/CleanHomeRN/BACHECA.md` (fuori da git), che entrambi possono scrivere.
3. **Mai lo stesso file in due.** La colonna "File" della bacheca dice chi sta toccando cosa: prima di modificare un file, controlla che non sia nei lavori in corso dell'altro.
4. **Prima di iniziare** un lavoro, Codex allinea il suo branch con `git merge main`.
5. **Commit piccoli**, un'idea per commit, messaggio `tipo(agente): cosa`. Esempi: `fix(codex): green CTA on property card`, `feat(claude): pay button loading state`.
6. **Verifica prima di dire "pronto":** `npx tsc --noEmit` senza errori nuovi; `npm test` se tocchi logica coperta da test. Nella worktree di Codex `node_modules` è un collegamento a quella di `~/CleanHomeRN`: **non fare `npm install` lì**. Nuove dipendenze o moduli nativi (richiedono un nuovo dev build): chiedi prima in bacheca.
7. **Consegna.** Quando un lavoro di Codex è pronto, lo scrive in bacheca ("pronto da unire" + commit + cosa si deve vedere a schermo). Claude lo unisce in `main`, lo prova sul simulatore, salva gli screenshot in `~/CleanHomeRN/screenshots/` (fuori da git) e fa push.
8. **Simulatore e Metro** li gestisce Claude: Metro sulla porta 8081, iPhone 16 Pro = pulitore, iPhone 16 = cliente. Se Codex ne avvia uno suo, usa la porta 8082.
9. **Produzione: solo Claude, e solo dopo l'ok di Nino.** Migrazioni sul database Supabase, deploy delle edge function, `eas update` / `eas build` / submit, qualunque operazione su Stripe LIVE. Codex può preparare i file (per esempio in `supabase/migrations/`) e segnalarli in bacheca.
10. **Mai distruggere il lavoro dell'altro**: niente `git reset --hard`, `git checkout --` o cancellazioni su file dell'altro. Se non sei d'accordo con una scelta, scrivilo in bacheca con la tua proposta: decide Nino.
11. **Indicazioni verificabili**: file e riga, valori, cosa si deve vedere a schermo. Niente consigli generici.
12. **Bacheca**: aggiorna solo le tue righe e aggiungi i messaggi in fondo alla tua sezione; non riscrivere quelli dell'altro.
13. **Segreti**: `.env.local` contiene chiavi (anche la secret key di Stripe). Mai copiarle, stamparle o committarle.

## Lezioni già imparate
- Mai Expo Go: solo il dev build `com.cleanhome.app`.
- Se `npx expo start` stampa `UnexpectedServerData: No returned query result` e l'app non carica, avvia Metro con `--offline`.
- `curl localhost:8081/reload` non ricarica davvero: per verificare a schermo, chiudi e rilancia l'app (`xcrun simctl terminate` + `launch`) e aspetta "Bundled".
- Il simulatore parte da San Francisco: `xcrun simctl location <UDID> set 45.4642,9.1900` per Milano (non è un bug dell'app).
- Pulsanti: usare il wrapper `AppPressable`, non `Pressable` diretto (vedi `CLAUDE.md`).
