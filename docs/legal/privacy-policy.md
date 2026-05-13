# Informativa sulla Privacy

*Documento generato come template di partenza. Si consiglia revisione legale da avvocato specializzato in diritto della tutela del consumatore prima della pubblicazione definitiva.*

**Ultimo aggiornamento:** 2026-04-28
**Versione:** v1.0

---

La presente Informativa sulla Privacy descrive le modalità con cui CleanHome (di seguito "CleanHome", "noi", "la Piattaforma") raccoglie, utilizza e protegge i dati personali degli utenti dell'applicazione mobile CleanHome (bundle id `com.cleanhome.app`, di seguito "App") e del sito web associato.

Il documento è redatto ai sensi del Regolamento (UE) 2016/679 ("GDPR"), del D.Lgs. 196/2003 e successive modifiche ("Codice Privacy"), nonché dei provvedimenti del Garante per la protezione dei dati personali italiano.

## 1. Titolare del trattamento

Il Titolare del trattamento dei dati personali è:

- **Denominazione:** Nino Mariano Lai (ditta individuale)
- **Sede legale:** Via Sicilia 97, 09170 Oristano (OR)
- **P.IVA / Codice Fiscale:** LAINMR92M16Z112D
- **Email di contatto utenti:** info@cleanhome.app
- **Email del Responsabile della protezione dei dati (DPO):** non nominato

L'utente può rivolgersi ai recapiti sopra indicati per esercitare i propri diritti o richiedere chiarimenti relativi al trattamento dei propri dati.

## 2. Tipologie di dati raccolti

CleanHome raccoglie le seguenti categorie di dati personali, in funzione del ruolo dell'utente (Cliente o Professionista):

### 2.1 Dati di registrazione e profilo
- Nome e cognome
- Indirizzo email
- Numero di telefono
- Foto profilo (facoltativa)
- Password (conservata in forma criptata, mai in chiaro)

### 2.2 Dati fiscali (solo Professionisti)
- Codice fiscale e/o Partita IVA
- Dati bancari per ricezione pagamenti (gestiti direttamente da Stripe Connect)

### 2.2.bis Verifica identità tramite Stripe Identity (solo Professionisti)
Prima di poter ricevere prenotazioni, ogni Professionista deve completare la verifica identità tramite **Stripe Identity** (servizio di Stripe Payments Europe Ltd.). La verifica include:
- Scansione del documento d'identità (carta d'identità, passaporto o patente di guida)
- Selfie con **liveness check 3D** (rilevamento di movimento e profondità del volto)
- Confronto automatico tra foto del documento e selfie

I **dati biometrici** (struttura del volto, pattern di liveness) sono trattati **direttamente da Stripe Inc.**, non sono mai accessibili a CleanHome né conservati sui nostri server. CleanHome riceve esclusivamente:
- Esito della verifica (verificato / fallito / da reinviare)
- Nome, cognome e data di nascita estratti dal documento (necessari per le comunicazioni e la fatturazione)
- ID interno della verifica (`verification_session_id`) per riferimento

Base giuridica del trattamento: art. 6.1.b GDPR (esecuzione del contratto), art. 9.2.b (necessità per adempimento di obblighi e diritti in materia di lavoro/sicurezza). Per ulteriori dettagli sul trattamento dei dati biometrici da parte di Stripe: https://stripe.com/legal/identity

### 2.3 Dati di geolocalizzazione
- Latitudine e longitudine dell'indirizzo del Cliente (per consentire il dispatch al Professionista più vicino)
- Zona di copertura dichiarata dal Professionista (poligono geografico gestito tramite PostGIS)
- Posizione GPS dell'App al momento della prenotazione (con consenso esplicito dell'utente)

### 2.4 Contenuti caricati dagli utenti
- Foto della casa o degli ambienti, caricate dal Cliente per descrivere il servizio richiesto
- Foto del lavoro completato, caricate dal Professionista a conclusione dell'intervento
- Recensioni e valutazioni (rating) scambiate tra Cliente e Professionista

### 2.5 Dati di pagamento
CleanHome **non** memorizza direttamente i dati delle carte di pagamento, che sono gestiti integralmente da Stripe Payments Europe Ltd. e dalla piattaforma Stripe Connect. CleanHome riceve unicamente identificativi di transazione (`PaymentIntent ID`, `Charge ID`) e l'esito del pagamento.

### 2.6 Comunicazioni
- Conversazioni in chat tra Cliente e Professionista, conservate sulla tabella `messages` del database
- Email transazionali inviate per conferme di prenotazione, ricevute, notifiche di stato

### 2.7 Dati tecnici
- Token push notification Expo (per invio notifiche al dispositivo)
- Indirizzo IP, modello di dispositivo, sistema operativo, versione App
- Log di accesso e di sicurezza

## 3. Finalità del trattamento e base giuridica

| Finalità | Base giuridica (art. 6 GDPR) |
|---|---|
| Esecuzione del contratto di intermediazione (creazione account, gestione prenotazioni, pagamenti, chat) | Art. 6.1.b — esecuzione di un contratto |
| Adempimento obblighi fiscali e contabili | Art. 6.1.c — obbligo legale |
| Prevenzione frodi, sicurezza dell'App, tutela contro abusi (es. anti-bypass contatti) | Art. 6.1.f — legittimo interesse |
| Invio comunicazioni di marketing, newsletter, offerte promozionali | Art. 6.1.a — consenso esplicito (opt-in) |
| Miglioramento del servizio e analisi statistiche aggregate | Art. 6.1.f — legittimo interesse |
| Risposta a richieste delle autorità giudiziarie o amministrative | Art. 6.1.c — obbligo legale |

Il consenso al marketing è facoltativo, revocabile in qualsiasi momento, e non condiziona l'utilizzo del servizio.

## 4. Modalità di trattamento

I dati sono trattati con strumenti informatici, su server collocati nell'Unione Europea (Francoforte, Germania), tramite l'infrastruttura cloud di Supabase. Sono adottate misure tecniche e organizzative adeguate (cifratura in transito tramite TLS, cifratura at-rest del database, accessi controllati con autenticazione a più fattori per il personale autorizzato, backup periodici).

Il trattamento avviene esclusivamente da parte di personale autorizzato e di responsabili esterni nominati ai sensi dell'art. 28 GDPR.

## 5. Periodi di conservazione

I dati sono conservati per i periodi minimi necessari alle finalità per cui sono stati raccolti:

- **Dati account:** per l'intera durata del rapporto e per ulteriori **2 anni** dopo la cancellazione, al fine di tutelare CleanHome in caso di contenzioso e di rispettare obblighi fiscali residui.
- **Conversazioni in chat:** **12 mesi** dalla data dell'ultimo messaggio.
- **Foto del lavoro completato e foto della casa:** **24 mesi** dalla data di caricamento, per consentire la gestione di eventuali contestazioni.
- **Dati fiscali e di transazione:** **10 anni**, ai sensi dell'art. 2220 c.c. e della normativa fiscale italiana.
- **Recensioni e rating:** mantenuti in forma anonimizzata anche dopo cancellazione dell'account, a tutela dell'integrità del sistema reputazionale della Piattaforma.
- **Token push notification:** fino a revoca o disinstallazione dell'App.
- **Log di accesso:** **6 mesi**.

Al termine dei periodi di conservazione i dati vengono cancellati o anonimizzati in modo irreversibile.

## 6. Destinatari dei dati

I dati possono essere comunicati ai seguenti soggetti, in qualità di Responsabili del trattamento ex art. 28 GDPR o titolari autonomi:

- **Stripe Payments Europe Ltd.** (Irlanda) e **Stripe Inc.** (USA): gestione pagamenti, custodia fondi, KYC dei Professionisti tramite Stripe Connect Express
- **Supabase Inc.** (con server EU a Francoforte): hosting database, autenticazione, storage delle immagini
- **Expo (650 Industries, Inc.)** (USA): invio notifiche push tramite servizio Expo Push
- **Google LLC / Google Cloud EMEA Ltd.**: Maps API, geocoding, eventuali servizi di posta elettronica
- Fornitori SMTP per invio email transazionali (es. Resend, Postmark o equivalenti)
- Consulenti fiscali, legali e contabili, vincolati da obblighi di riservatezza
- Autorità giudiziarie o amministrative, su richiesta legittima

L'elenco aggiornato dei Responsabili del trattamento può essere richiesto scrivendo all'indirizzo info@cleanhome.app.

## 7. Trasferimento dei dati extra-UE

Alcuni Responsabili hanno sede o effettuano trattamenti negli Stati Uniti d'America. In tali casi il trasferimento avviene sulla base di adeguate garanzie ai sensi degli artt. 44 e ss. GDPR:

- **Stripe Inc. (USA):** Standard Contractual Clauses (SCC) approvate dalla Commissione UE, integrate da misure tecniche supplementari
- **Google LLC (USA):** adesione al **Data Privacy Framework UE-USA** (DPF)
- **Expo / 650 Industries (USA):** Standard Contractual Clauses (SCC)

Una copia delle garanzie applicabili può essere richiesta scrivendo a info@cleanhome.app.

## 8. Diritti dell'interessato

In ogni momento l'utente può esercitare, ai sensi degli artt. 15-22 GDPR, i seguenti diritti:

- **Accesso** ai propri dati personali (art. 15)
- **Rettifica** dei dati inesatti (art. 16)
- **Cancellazione** ("diritto all'oblio") nei limiti consentiti dalla legge (art. 17)
- **Limitazione** del trattamento (art. 18)
- **Portabilità** dei dati in formato strutturato e leggibile (art. 20)
- **Opposizione** al trattamento basato sul legittimo interesse (art. 21)
- **Revoca del consenso** in qualunque momento, senza pregiudicare la liceità dei trattamenti già effettuati
- **Reclamo** all'Autorità Garante per la protezione dei dati personali (www.garanteprivacy.it)

Per esercitare tali diritti è sufficiente inviare una richiesta a info@cleanhome.app o, se nominato, al DPO all'indirizzo non nominato. La risposta sarà fornita entro **30 giorni** dalla ricezione, prorogabili di ulteriori 60 giorni in caso di richieste complesse.

## 9. Cookie e tecnologie di tracciamento

L'App mobile CleanHome **non utilizza cookie**. L'eventuale sito web associato (landing page e pagine legali ospitate su Vercel) può utilizzare unicamente **cookie tecnici** strettamente necessari al funzionamento del sito, per i quali non è richiesto consenso ai sensi dell'art. 122 del Codice Privacy. Non sono utilizzati cookie di profilazione, analitici di terze parti o di marketing senza preventivo consenso.

## 10. Minori

Il servizio CleanHome non è destinato a soggetti di età inferiore ai **18 anni**. CleanHome non raccoglie consapevolmente dati di minori. Qualora un genitore o tutore dovesse riscontrare la registrazione di un minore, è invitato a segnalarlo immediatamente a info@cleanhome.app per la tempestiva cancellazione dell'account.

## 11. Modifiche alla presente Informativa

CleanHome si riserva il diritto di aggiornare la presente Informativa per riflettere modifiche normative, organizzative o tecniche. Le modifiche sostanziali saranno notificate agli utenti tramite l'App o via email almeno **15 giorni** prima della loro entrata in vigore. La data di "Ultimo aggiornamento" in cima al documento indica sempre la versione vigente.

## 12. Contatti

Per qualsiasi domanda relativa al trattamento dei dati personali:

- Email generale: info@cleanhome.app
- Email DPO (se nominato): non nominato
- Indirizzo postale: Via Sicilia 97, 09170 Oristano (OR)

---

## Documenti collegati

- [Termini di Servizio](./terms-of-service.md)
- [Politica di Rimborso](./refund-policy.md)
