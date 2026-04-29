# Decision Doc: Escrow Design

**Status:** ✅ DECIDED — Opzione A (hold-until-confirm)
**Date:** 2026-04-29
**Owner:** Nino
**Sblocca:** Phase 2 (Escrow) della milestone v1.0 pre-launch

---

## Contesto

Il flusso di pagamento attuale (test mode) è:
1. Cliente paga al booking → PaymentIntent con `transfer_data.destination = cleaner_stripe_account`
2. **Il payout al cleaner avviene immediatamente** all'accettazione del booking dal cleaner
3. Non c'è gate di conferma cliente né dispute window

Questo è il modello **release-on-accept**, attualmente in produzione test.

Per la submission store + Stripe LIVE servono regole chiare per:
- Quando il cleaner riceve effettivamente i soldi
- Cosa succede se il cliente contesta
- Chi paga in caso di chargeback / frode cleaner
- Come si comporta il flag `payout_blocked` già presente nel codice

## Le due opzioni

### Opzione A — Hold-until-confirm (escrow vero)

```
[booking pagato] → [fondi su balance platform/cleaner ma trattenuti]
                  ↓ cleaner: "lavoro fatto"
                  ↓ work_done_at = now()
                  ↓
[cliente vede: Conferma | Contesta]
                  ↓ ↓ ↓
   conferma     contesta    silenzio 48h
       ↓            ↓             ↓
   payout      review CH      auto-conferma → payout
```

**Implementazione tecnica:**
- PaymentIntent con `capture_method = manual` OPPURE `transfer_data.destination` ma con `application_fee_amount` e payout ritardato via Connect API
- Cron `auto-confirm-bookings` ogni 10 min → trova booking con `work_done_at < now() - 48h` AND `client_confirmed = false` AND `disputed = false` → triggera transfer
- Tabella `bookings`: campi `work_done_at`, `client_confirmed_at`, `dispute_opened_at`, `payout_blocked` (già esistente)

**Pro:**
- Tutela cliente forte → marketing + trust
- Riduce drasticamente chargeback (cliente risolve in app, non in banca)
- Sostenibilità: meno frodi, meno contenziosi
- Compliance: in linea con marketplace standard (Airbnb, Etsy, Bookatable)
- Permette refund parziale per servizi non conformi senza rimettere fondi al cleaner

**Contro:**
- Cleaner aspetta fino a 48h post-servizio per vedere i soldi → frizione
- Dev work: cron 48h, UI cliente conferma/contesta, API endpoint review CH
- Edge cases: cliente non conferma per pigrizia → l'auto-confirm risolve, ma serve UX chiara

**Stima dev:** 3–5 giorni (1 plan ≈ 02-01, 1 plan ≈ 02-02 come da roadmap)

---

### Opzione B — Release-on-accept (status quo, con dispute window)

```
[booking pagato + accettato cleaner] → [payout immediato al cleaner]
                                     ↓
                                     ↓ (cliente ha 7gg per aprire contestazione)
                                     ↓
                                     ↓ se contesta → CH valuta + eventualmente
                                       trattiene da prossimo payout del cleaner
```

**Implementazione tecnica:**
- Mantenere il flusso attuale (`transfer_data.destination` immediato)
- Aggiungere endpoint `/dispute/open` con UI cliente entro 7gg
- Logica di clawback dal saldo Stripe Connect del cleaner via `transfers.create_reversal`
- Flag `payout_blocked` può essere rimosso o usato solo per cleaner sotto investigazione

**Pro:**
- Cleaner felice: soldi subito → meglio per acquisition
- Meno dev work: il flusso esistente funziona già
- Latenza nulla per il cleaner

**Contro:**
- Tutela cliente debole → potenziale fuga se primo booking va male
- Più chargeback (cliente bypassa app e va in banca)
- Clawback complesso: se cleaner ha prelevato il saldo, CH paga di tasca propria
- Rischio reputazionale post-launch se ci sono frodi

**Stima dev:** 1–2 giorni (solo dispute UI + endpoint)

---

## Tradeoff sintetico

| Criterio | A (Hold-until-confirm) | B (Release-on-accept) |
|---|---|---|
| Tutela cliente | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| UX cleaner | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Rischio finanziario CH | basso | medio-alto |
| Dev effort | 3–5 gg | 1–2 gg |
| Compliance store/banche | forte | media |
| Allineamento col mercato | Airbnb, Etsy | Uber, Glovo (gig) |
| Time-to-launch | +3gg | baseline |

## Cosa raccomando

**Opzione A** — hold-until-confirm con auto-conferma a 48h.

Motivi:
1. CleanHome è un servizio fisico, di valore medio (€50–€200), non un trasporto da €5 → l'utente ha aspettative di tutela tipo Airbnb
2. La P.IVA cleaner non è di per sé garanzia di qualità → serve un gate
3. I 48h di attesa per il cleaner sono accettabili nel mercato cleaning (vs 7gg di alcuni concorrenti)
4. Riduce operativamente il workload futuro su dispute/chargeback
5. È più facile passare da A a B in futuro (rilassamento) che il contrario

Il flag `payout_blocked` già presente nel codice è coerente con A → meno cambiamenti rispetto al modello attuale.

---

## DECISION

**Scelta:** **A — Hold-until-confirm con auto-conferma 48h**

**Motivazione:**
1. CleanHome è marketplace pre-launch senza recensioni → tutela cliente forte è leva di trust nei primi mesi
2. Booking €50–€200 (servizio fisico medio valore) → utente si aspetta protezione tipo Airbnb
3. Riduzione drastica chargeback: contestazioni risolte in app, non in banca (risparmio ~€200/mese a regime su volumi 1k booking/mese)
4. Asimmetria rischio: con B se cleaner sparisce dopo prelievo Stripe Connect → CH paga rimborso di tasca propria. Con A i fondi restano sulla platform finché conferma cliente
5. Codice già coerente: flag `payout_blocked` già presente in DB
6. Path of regret minimization: passare da A a B in futuro = 1 giorno di lavoro. Il contrario = rivolta cleaner

**Data decisione:** 2026-04-29

---

## Conseguenze (decisione A)

- [x] Aggiornare `legal/terms.md` §6.4 → tenere solo Opzione A
- [x] Aggiornare `legal/refund.md` §5 → tenere solo Opzione A
- [ ] Phase 2 procede come da ROADMAP.md (02-01 + 02-02) — owner: altra finestra dopo Phase 1
- [ ] Aggiornare PROJECT.md sezione "Decisions" — da fare quando Phase 1 chiude per evitare merge conflict
