# Termini e Condizioni di Servizio — CleanHome

**Ultimo aggiornamento:** 29 aprile 2026
**Versione:** 1.0

---

## 1. Identificazione del fornitore

CleanHome è gestita da:
- **Ragione sociale:** [NINO: COMPILARE]
- **Sede legale:** [NINO: COMPILARE]
- **P.IVA / C.F.:** [NINO: COMPILARE]
- **Iscrizione REA:** [NINO: COMPILARE o "non applicabile"]
- **Email:** [NINO: COMPILARE — info@cleanhome.it]
- **PEC:** [NINO: COMPILARE]

(di seguito "**CleanHome**" o "**noi**")

## 2. Oggetto del servizio

CleanHome è una **piattaforma di intermediazione** (marketplace) che mette in contatto:
- **Clienti**: persone fisiche o giuridiche che richiedono servizi di pulizia per le proprie proprietà
- **Cleaner**: professionisti autonomi che offrono servizi di pulizia

**CleanHome non eroga direttamente i servizi di pulizia.** I servizi sono erogati dai cleaner, che agiscono come **prestatori indipendenti** e non come dipendenti o collaboratori di CleanHome.

## 3. Ruolo di CleanHome

CleanHome fornisce:
- Tecnologia di matching cliente↔cleaner basata su geolocalizzazione e preferenze
- Sistema di pagamento sicuro tramite **Stripe** (vedi §7)
- Sistema di chat 1:1 e notifiche transazionali
- Recensioni e rating bidirezionali
- Customer support per problemi tecnici della piattaforma

CleanHome **non**:
- Eroga servizi di pulizia
- Garantisce la qualità del servizio del singolo cleaner
- È datore di lavoro dei cleaner
- È responsabile del rapporto contrattuale tra cliente e cleaner (eccetto per i pagamenti — §7)

## 4. Registrazione account

### 4.1 Requisiti
- Maggiore età (18 anni)
- Email valida o Apple ID
- Per i cleaner: **P.IVA italiana attiva** (verificata tramite Stripe Connect KYC)

### 4.2 Veridicità dei dati
L'utente garantisce la veridicità e l'aggiornamento dei dati forniti. CleanHome può sospendere o chiudere account con dati falsi.

### 4.3 Sicurezza credenziali
L'utente è responsabile della custodia delle proprie credenziali e di ogni attività svolta dal proprio account.

## 5. Cleaner: termini specifici

### 5.1 Status fiscale
Il cleaner agisce come **lavoratore autonomo titolare di P.IVA**. Il cleaner è unico responsabile di:
- Adempimenti fiscali (fatturazione, dichiarazione redditi, IVA)
- Adempimenti previdenziali (contributi INPS gestione separata o artigiani)
- Adempimenti assicurativi (responsabilità civile professionale consigliata)

### 5.2 Listings
- Il primo listing è gratuito
- Listings aggiuntivi: **€4,99/mese ciascuno** (abbonamento Stripe ricorrente)
- Il cleaner può cancellare l'abbonamento in qualsiasi momento; il listing rimane attivo fino a fine periodo pagato

### 5.3 Onboarding Stripe Connect
Per ricevere pagamenti, il cleaner deve completare l'onboarding KYC su **Stripe Connect Express**. CleanHome non ha accesso ai documenti caricati su Stripe.

### 5.4 Commissioni
Su ogni booking confermato:
- Il cliente paga il prezzo del servizio + **commissione 9%**
- Al cleaner viene erogato il prezzo del servizio − **commissione 9%**
- **Commissione totale CleanHome: 18%**

Le commissioni sono trattenute da Stripe al momento del payout.

### 5.5 Standard di servizio
Il cleaner si impegna a:
- Erogare il servizio nei tempi e modi concordati
- Non chiedere pagamenti fuori piattaforma (vedi §10)
- Non condividere contatti diretti per bypassare la piattaforma (vedi §10)
- Mantenere comportamento professionale

Violazioni → sospensione/ban account.

## 6. Cliente: termini specifici

### 6.1 Booking
Il cliente:
- Crea proprietà con metratura e dettagli
- Sceglie il cleaner preferito o lascia il dispatch automatico
- Paga al momento della prenotazione tramite Stripe

### 6.2 Prezzo
Il prezzo è calcolato come: **€1,30/m² (minimo €50)** + **commissione cliente 9%**.

### 6.3 Cancellazione
Vedi **Refund Policy** ([refund.md](./refund.md)).

### 6.4 Conferma servizio (modello escrow)

CleanHome adotta un modello **hold-until-confirm**: il pagamento del cliente viene **trattenuto sulla piattaforma** e non rilasciato al cleaner fino alla conferma del servizio.

**Flusso:**
1. Al momento del booking, il cliente paga l'intero importo (servizio + commissione cliente). I fondi vengono trattenuti sul conto Stripe Connect della piattaforma.
2. Quando il cleaner segna il lavoro come completato, parte una finestra di **48 ore** entro la quale il cliente può:
   - **Confermare** il servizio → il pagamento viene immediatamente rilasciato al cleaner
   - **Aprire una contestazione** motivata → i fondi restano congelati e CleanHome esamina il caso entro 5 giorni lavorativi (vedi [Refund Policy](./refund.md) §5)
3. Decorse le 48 ore senza alcuna azione del cliente, il sistema considera il servizio **automaticamente confermato** e rilascia il pagamento al cleaner.

Il cliente accetta esplicitamente questo meccanismo di auto-conferma silente al momento della prenotazione.

## 7. Pagamenti

### 7.1 Payment processor
Tutti i pagamenti sono processati da **Stripe Payments Europe Ltd.** (Dublino, Irlanda). CleanHome agisce come "platform" tramite Stripe Connect.

### 7.2 Strumenti accettati
Carte di credito/debito, Apple Pay, Google Pay (tramite Stripe).

### 7.3 Fatturazione
- Ricevuta della commissione CleanHome → emessa da **CleanHome** al cliente
- Fattura/ricevuta del servizio di pulizia → emessa **direttamente dal cleaner** al cliente, secondo regime fiscale del cleaner

## 8. Recensioni

### 8.1 Bidirezionali
Cliente e cleaner si recensiscono reciprocamente dopo il servizio.

### 8.2 Linee guida
Le recensioni devono essere veritiere e rispettose. È vietato:
- Diffamazione
- Linguaggio offensivo, discriminatorio, sessista, razzista
- Pubblicazione di dati personali altrui
- Recensioni a pagamento o false

CleanHome può rimuovere recensioni che violano queste linee guida.

## 9. Chat e moderazione

La chat è destinata esclusivamente al **coordinamento del booking specifico**.

### 9.1 Anti-bypass
È **vietato**:
- Condividere numeri di telefono, email personali, profili social
- Suggerire pagamenti fuori piattaforma
- Suggerire l'uso di app esterne (WhatsApp, Telegram, ecc.) per il proseguimento della conversazione

I messaggi che violano questa regola vengono **bloccati automaticamente** da un filtro tecnico. Violazioni ripetute → sospensione/ban.

### 9.2 Motivazione
La moderazione è necessaria per:
- Sicurezza pagamenti (escrow funziona solo on-platform)
- Tutela contro frodi
- Sostenibilità economica della piattaforma

## 10. Comportamenti vietati

È vietato:
- Bypassare la piattaforma (§9.1)
- Creare account multipli per eludere ban
- Manipolare il sistema di rating
- Caricare foto false o non autorizzate di proprietà altrui
- Pubblicare contenuti illegali
- Reverse engineering dell'app

Violazioni → ban + eventuale denuncia all'autorità competente.

## 11. Responsabilità di CleanHome

### 11.1 Limitazione
CleanHome è responsabile per:
- Disponibilità della piattaforma (best effort, no SLA contrattuale)
- Sicurezza dei pagamenti (delegata a Stripe, certificato PCI-DSS Level 1)
- Trattamento dati personali secondo Privacy Policy

CleanHome **non è responsabile** per:
- Qualità del servizio erogato dal cleaner
- Danni alla proprietà causati dal cleaner durante l'esecuzione del servizio
- Inadempimenti contrattuali tra cliente e cleaner

### 11.2 Forza maggiore
CleanHome non risponde di interruzioni dovute a forza maggiore (down provider, attacchi DDoS, calamità, atti di autorità).

### 11.3 Limite di responsabilità
In ogni caso la responsabilità di CleanHome è limitata all'**importo della commissione** percepita per il booking oggetto della contestazione, salvo dolo o colpa grave.

## 12. Diritto di recesso (consumatori)

Ai sensi del **Codice del Consumo (D.Lgs. 206/2005)**, il cliente consumatore ha diritto di recesso entro **14 giorni** dalla conclusione del contratto digitale (registrazione/abbonamento), salvo che il servizio sia stato già erogato con consenso espresso.

**Per il singolo booking**, vista la natura del servizio (esecuzione su data specifica), l'utente accetta che il diritto di recesso si estingua all'inizio dell'esecuzione del servizio.

Per cancellazioni vedi [refund.md](./refund.md).

## 13. Privacy

Il trattamento dei dati personali è regolato dalla **Privacy Policy** ([privacy.md](./privacy.md)), parte integrante dei presenti Termini.

## 14. Modifiche

CleanHome può modificare i Termini con preavviso di **30 giorni** comunicato via email/in-app. Continuando ad usare il servizio dopo la modifica, l'utente accetta la nuova versione.

## 15. Risoluzione

CleanHome può chiudere account in caso di:
- Violazione dei Termini
- Frode o sospetto frode
- Richiesta dell'autorità

L'utente può chiudere il proprio account in qualsiasi momento dall'app: Profilo → Impostazioni → Elimina account.

## 16. Legge applicabile e foro competente

I presenti Termini sono regolati dalla **legge italiana**.

Per le controversie con consumatori, è competente il foro del domicilio o residenza del consumatore.

Per le controversie con cleaner (professionisti), è competente in via esclusiva il **Foro di [NINO: COMPILARE — es. Milano]**.

### 16.1 ODR
Per controversie online il consumatore può accedere alla piattaforma ODR della Commissione UE: https://ec.europa.eu/consumers/odr/

## 17. Contatti

- **Customer support:** [NINO: COMPILARE — support@cleanhome.it]
- **Legale:** [NINO: COMPILARE — legal@cleanhome.it]
- **PEC:** [NINO: COMPILARE]
