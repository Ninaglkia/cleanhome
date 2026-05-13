# Privacy Policy — CleanHome

**Ultimo aggiornamento:** 29 aprile 2026
**Versione:** 1.0

---

## 1. Titolare del trattamento

Il Titolare del trattamento dei dati personali è:

- **Ragione sociale:** [NINO: COMPILARE — es. CleanHome S.r.l.s. / Ditta Individuale Mariano Lai]
- **Sede legale:** [NINO: COMPILARE — Via, CAP, Città, Provincia]
- **P.IVA / Codice Fiscale:** [NINO: COMPILARE]
- **Email contatto privacy:** info@cleanhomeapp.com
- **PEC:** [NINO: COMPILARE]

## 2. Dati raccolti

CleanHome raccoglie i seguenti dati personali:

### 2.1 Dati forniti dall'utente
- **Account:** email, password (hashata), nome, cognome, foto profilo
- **Identità Apple Sign In:** identificatore Apple anonimizzato (per chi usa Apple ID)
- **Profilo cleaner:** bio, esperienza, città di operatività, listings pubblicati
- **Profilo cliente:** indirizzi proprietà, preferenze pulizia, frequenza
- **Pagamenti:** nessun dato carta è memorizzato sui nostri server — gestito interamente da Stripe (vedi §6)
- **Stripe Connect (cleaner):** dati KYC inviati direttamente a Stripe (P.IVA, documento identità, IBAN) — **noi non vediamo né conserviamo questi dati**
- **Comunicazioni:** messaggi in chat 1:1 cliente↔cleaner

### 2.2 Dati raccolti automaticamente
- **Geolocalizzazione:** coordinate GPS della proprietà al momento dell'inserimento (per matching cleaner nelle vicinanze) — solo se l'utente concede il permesso
- **Identificatori dispositivo:** Expo Push Token per le notifiche
- **Dati tecnici:** versione app, sistema operativo, crash reports tramite Sentry
- **Log applicativi:** errori, eventi di pagamento, transizioni booking

## 3. Finalità del trattamento

I dati sono trattati per le seguenti finalità:

| Finalità | Base giuridica (GDPR Art. 6) |
|---|---|
| Erogazione del servizio (account, booking, chat) | Esecuzione di contratto (Art. 6.1.b) |
| Pagamenti e payout | Esecuzione di contratto + obbligo legale |
| Anti-frode e sicurezza | Legittimo interesse (Art. 6.1.f) |
| Notifiche transazionali | Esecuzione di contratto |
| Customer support | Esecuzione di contratto |
| Adempimenti fiscali | Obbligo legale (Art. 6.1.c) |
| Miglioramento del servizio (analytics aggregate) | Legittimo interesse |

**Non facciamo profiling automatizzato con effetti giuridici sull'utente.**

## 4. Conservazione dei dati

| Dato | Periodo |
|---|---|
| Account attivo | Per tutta la durata del rapporto |
| Account chiuso | 30 giorni poi cancellazione (salvo obblighi fiscali) |
| Dati fiscali (fatture, transazioni) | 10 anni (obbligo legale italiano) |
| Log tecnici | 90 giorni |
| Messaggi chat | 2 anni dall'ultima attività booking |
| Recensioni pubblicate | Indefinitamente (anonimizzate dopo cancellazione account) |

## 5. Destinatari dei dati

I dati possono essere comunicati a:
- **Supabase Inc.** (database, auth, storage) — server in EU
- **Stripe Payments Europe Ltd.** (pagamenti) — Dublino, Irlanda
- **Resend Inc.** (email transazionali) — server EU/USA con Standard Contractual Clauses
- **Expo (Push Notifications)** — USA con SCC
- **Google Places API** (autocomplete indirizzi) — USA con SCC
- **Sentry.io** (crash reporting) — USA con SCC
- **Autorità giudiziarie / fiscali** quando richiesto da legge

## 6. Pagamenti

**CleanHome non memorizza dati di pagamento.** Tutto il flusso è gestito da **Stripe** (PCI-DSS Level 1 certified). I cleaner ricevono i pagamenti tramite **Stripe Connect Express** — l'onboarding KYC avviene direttamente sui sistemi Stripe.

CleanHome conserva solo: ID transazione Stripe, importo, data, status, ID booking associato.

## 7. Trasferimento extra-UE

Alcuni dei nostri fornitori (Stripe, Expo, Google, Sentry) trattano dati in USA. Il trasferimento avviene sulla base di:
- **Decisioni di adeguatezza** (USA Data Privacy Framework dove applicabile)
- **Standard Contractual Clauses (SCC)** della Commissione Europea

## 8. Diritti dell'interessato (GDPR Art. 15-22)

Hai il diritto di:
- **Accesso** ai tuoi dati
- **Rettifica** di dati inesatti
- **Cancellazione** ("diritto all'oblio") — dall'app: Profilo → Impostazioni → Elimina account
- **Limitazione** del trattamento
- **Portabilità** dei dati in formato JSON
- **Opposizione** al trattamento basato su legittimo interesse
- **Reclamo al Garante Privacy** (www.garanteprivacy.it)

Per esercitarli scrivi a: **info@cleanhomeapp.com**
Risposta entro 30 giorni.

## 9. Cookie e tracciamento

L'app mobile **non usa cookie**. Usa identificatori tecnici (token sessione, push token) necessari al funzionamento del servizio.

## 10. Sicurezza

Adottiamo misure tecniche e organizzative adeguate:
- Crittografia in transito (TLS 1.2+)
- Crittografia at-rest (Supabase + Stripe)
- Row Level Security su database
- Autenticazione tramite Supabase Auth + Apple Sign In
- Crash reporting con Sentry per identificare bug di sicurezza
- Rotazione periodica delle API keys

## 11. Minori

Il servizio non è destinato a minori di 18 anni. Non raccogliamo intenzionalmente dati di minori.

## 12. Modifiche

Eventuali modifiche saranno comunicate via email e in-app con almeno 30 giorni di preavviso. Le modifiche sostanziali richiedono nuovo consenso.

## 13. Contatti

- **Privacy:** info@cleanhomeapp.com
- **DPO (se nominato):** [NINO: COMPILARE o "non nominato — non obbligatorio"]
- **Reclami Garante:** www.garanteprivacy.it
