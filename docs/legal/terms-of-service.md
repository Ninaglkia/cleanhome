# Termini di Servizio

*Documento generato come template di partenza. Si consiglia revisione legale da avvocato specializzato in diritto della tutela del consumatore prima della pubblicazione definitiva.*

**Ultimo aggiornamento:** 2026-04-28
**Versione:** v1.0

---

I presenti Termini di Servizio (di seguito "Termini") regolano l'utilizzo dell'applicazione mobile CleanHome (bundle id `com.cleanhome.app`) e dei servizi offerti da Nino Mariano Lai (ditta individuale), CF LAINMR92M16Z112D, con sede legale in Via Sicilia 97, 09170 Oristano (OR) (di seguito "CleanHome", "Piattaforma", "noi").

L'accesso e l'utilizzo dell'App comportano l'integrale e incondizionata accettazione dei presenti Termini. Si invita l'utente a leggerli attentamente prima di procedere alla registrazione.

## 1. Oggetto del contratto

CleanHome è una **piattaforma tecnologica di intermediazione** che mette in contatto soggetti privati che richiedono servizi di pulizia domestica (di seguito "Clienti") con professionisti autonomi che erogano tali servizi (di seguito "Professionisti").

CleanHome **non eroga direttamente alcun servizio di pulizia**. Le attività di pulizia sono svolte in piena autonomia dai Professionisti, i quali sono lavoratori indipendenti, non dipendenti né collaboratori di CleanHome. CleanHome non assume alcun obbligo di risultato in relazione ai servizi prestati dai Professionisti, salvo i limiti di legge.

## 2. Definizioni

- **Piattaforma:** l'App mobile CleanHome, il sito web e i servizi tecnologici associati.
- **Cliente:** persona fisica o giuridica che, tramite la Piattaforma, richiede un servizio di pulizia.
- **Professionista:** persona fisica o giuridica che, tramite la Piattaforma, offre servizi di pulizia ed esegue le prenotazioni accettate.
- **Servizio:** la prestazione di pulizia domestica oggetto della Prenotazione.
- **Prenotazione:** la richiesta inoltrata dal Cliente attraverso l'App e accettata da un Professionista, che dà luogo a un contratto bilaterale tra Cliente e Professionista.
- **Fee di Piattaforma:** la commissione applicata da CleanHome a fronte del servizio di intermediazione.
- **Account:** il profilo personale dell'utente sulla Piattaforma.

## 3. Registrazione e account

3.1 La registrazione è gratuita e richiede il conferimento di dati veritieri (nome, cognome, email, numero di telefono).

3.2 Per i **Professionisti** sono richiesti, in aggiunta:
- Codice fiscale e/o Partita IVA
- Verifica KYC ("Know Your Customer") tramite Stripe Connect Express, con caricamento di documento d'identità e dati bancari
- Dichiarazione delle zone geografiche di copertura

3.3 L'utente è tenuto a mantenere riservate le proprie credenziali di accesso e a notificare tempestivamente a CleanHome qualunque utilizzo non autorizzato del proprio account.

3.4 È vietato registrare più account per la stessa persona fisica, salvo casi specificamente autorizzati da CleanHome.

3.5 L'utente garantisce la veridicità e l'accuratezza dei dati forniti. CleanHome si riserva il diritto di sospendere o chiudere account contenenti dati falsi, incompleti o fraudolenti.

## 4. Ruolo della Piattaforma

4.1 CleanHome agisce esclusivamente come **intermediario tecnologico**. Il contratto di prestazione di servizi si perfeziona unicamente tra Cliente e Professionista al momento dell'accettazione della Prenotazione.

4.2 CleanHome **non è datore di lavoro né committente** dei Professionisti, che operano in piena autonomia organizzativa e gestionale. Ciascun Professionista è responsabile dei propri obblighi fiscali, previdenziali e assicurativi.

4.3 CleanHome non garantisce la disponibilità di Professionisti in ogni zona o orario, né la qualità soggettiva del servizio reso, salvo l'attività di moderazione e controllo svolta in forma di legittimo interesse.

## 5. Modalità di prenotazione

5.1 Il Cliente richiede un Servizio tramite l'App, indicando indirizzo, metratura dichiarata, data, orario e tipologia di pulizia. Le foto della casa sono caricate facoltativamente per descrivere meglio il servizio.

5.2 Il sistema applica un meccanismo di dispatch ("modello tipo Deliveroo"):
- la richiesta viene inviata fino a un massimo di **6 Professionisti preferiti** del Cliente, oppure
- in modalità broadcast, ai Professionisti più vicini disponibili nella zona di copertura PostGIS.

5.3 Il **primo Professionista che accetta** la richiesta si aggiudica la Prenotazione. Le richieste non accettate entro il timeout impostato sono automaticamente annullate (vedi Politica di Rimborso).

5.4 La conferma della Prenotazione è notificata al Cliente tramite push notification ed email transazionale.

## 6. Prezzo e pagamenti

6.1 Il prezzo del Servizio è calcolato automaticamente dalla Piattaforma sulla base della metratura dichiarata dal Cliente, secondo la tariffa in vigore al momento della Prenotazione, con un importo minimo previsto.

6.2 Sul prezzo del Servizio CleanHome applica una **fee di Piattaforma complessiva pari al 18%**, ripartita come segue:
- **9% trattenuto al Cliente** in fase di checkout
- **9% trattenuto al Professionista** sul payout

6.3 I pagamenti sono gestiti tramite **Stripe Connect Express**. CleanHome non tratta direttamente né conserva i dati delle carte di pagamento.

6.4 I fondi sono trattenuti in custodia ("hold") fino al completamento del Servizio. Il payout al Professionista avviene secondo i tempi tecnici di Stripe (tipicamente 1-7 giorni lavorativi successivi al completamento).

6.5 Il Cliente autorizza CleanHome a gestire, tramite Stripe, eventuali rimborsi, supplementi o storni come previsto dai presenti Termini e dalla Politica di Rimborso.

## 7. Cancellazioni e rimborsi

Le condizioni di cancellazione, le percentuali di rimborso e le tempistiche sono integralmente disciplinate dalla [Politica di Rimborso](./refund-policy.md), che costituisce parte integrante dei presenti Termini.

## 8. Anti-bypass dei contatti

8.1 Allo scopo di garantire la sicurezza degli utenti, la qualità del servizio e la tutela del modello economico, è **espressamente vietato** scambiare, sollecitare o tentare di acquisire al di fuori della chat di Piattaforma:
- numeri di telefono personali
- indirizzi email privati
- profili di social network (Instagram, WhatsApp, Telegram, Facebook, ecc.)
- qualsiasi altro recapito che consenta di aggirare il sistema di prenotazione e pagamento di CleanHome

8.2 La chat in-app è soggetta a moderazione automatica e manuale. La violazione del presente articolo comporta l'applicazione delle seguenti **sanzioni progressive**:
- **Primo episodio:** ammonizione formale, sospensione dell'account per **30 giorni** e applicazione automatica di una **sanzione di € 50,00** sulla prossima Prenotazione effettuata.
- **Secondo episodio:** **ban definitivo** dell'account, con eventuale escussione di importi maturati a copertura dei danni, nei limiti di legge.

8.3 La sanzione e la sospensione sono comminate da CleanHome previa valutazione dei contenuti della chat e costituiscono clausola penale ai sensi dell'art. 1382 c.c., senza pregiudizio del risarcimento dell'eventuale maggior danno.

## 9. Penalità per dichiarazioni mendaci

9.1 Il Cliente è tenuto a dichiarare con accuratezza la metratura dell'immobile e la tipologia di intervento richiesta.

9.2 Qualora il Professionista, all'arrivo sul posto, rilevi una difformità sostanziale tra quanto dichiarato e la realtà (ad esempio metratura significativamente superiore), può aprire un **ricorso documentato con foto evidenza** entro 24 ore dal sopralluogo.

9.3 Se il ricorso è accolto da CleanHome, sulla **prossima Prenotazione del Cliente** sarà applicato un **supplemento automatico** pari alla differenza dovuta, eventualmente maggiorato di un importo a titolo di indennizzo per il tempo perso dal Professionista. Il Cliente è informato preventivamente.

## 10. Recensioni

10.1 Le recensioni sono ammesse **soltanto dopo la conclusione del Servizio**, da entrambe le parti (Cliente verso Professionista e viceversa).

10.2 È vietato pubblicare recensioni:
- offensive, diffamatorie, discriminatorie o contrarie all'ordine pubblico
- false, inveritiere o manifestamente strumentali
- contenenti dati personali di terzi
- contenenti contatti diretti o link esterni in violazione dell'art. 8

10.3 CleanHome si riserva il diritto, a propria insindacabile valutazione, di rimuovere recensioni che violino i presenti Termini, fermi restando i diritti dell'utente di contestare la rimozione.

## 11. Obblighi del Professionista

Il Professionista si impegna a:
- completare la **verifica identità tramite Stripe Identity** (documento d'identità + selfie + liveness check) prima di poter ricevere prenotazioni
- erogare il Servizio con diligenza professionale, puntualità e nel rispetto degli standard qualitativi attesi
- presentarsi all'indirizzo concordato nell'orario stabilito, in condizioni idonee
- portare a termine la prestazione e caricare la **foto del lavoro completato** in App
- mantenere validi e aggiornati i dati KYC su Stripe Connect e l'esito di verifica Stripe Identity
- emettere, ove richiesto dalla normativa o dal Cliente, regolare fattura o documento commerciale
- rispettare la riservatezza sui beni e sugli ambienti del Cliente
- non utilizzare la Piattaforma per finalità illecite

CleanHome si riserva di **sospendere o revocare l'accesso al Servizio** ai Professionisti che non completano la verifica identità entro 30 giorni dall'iscrizione, o la cui verifica risulti fallita per documenti non validi/scaduti.

## 12. Obblighi del Cliente

Il Cliente si impegna a:
- fornire informazioni veritiere e accurate (indirizzo, metratura, accessi)
- garantire al Professionista l'accesso alla proprietà nell'orario concordato
- effettuare il pagamento secondo le modalità previste
- comportarsi con rispetto e correttezza nei confronti del Professionista
- non esercitare alcun potere direttivo o di subordinazione sul Professionista, che opera in autonomia

## 13. Limitazione di responsabilità

13.1 CleanHome non risponde dell'inadempimento o di danni derivanti dal rapporto tra Cliente e Professionista, salvo i casi di **dolo o colpa grave** propri o dei propri ausiliari, e fermi restando i diritti inderogabili del consumatore.

13.2 CleanHome non garantisce l'idoneità delle prestazioni a specifiche esigenze del Cliente né l'assenza di interruzioni temporanee del servizio dovute a manutenzioni, aggiornamenti o cause di forza maggiore.

13.3 Eventuali danni materiali alla proprietà del Cliente derivanti dall'attività del Professionista possono essere coperti, ove attivata, da apposita polizza assicurativa, le cui condizioni sono pubblicate separatamente.

13.4 Nei limiti di legge, la responsabilità complessiva di CleanHome verso un singolo utente non potrà comunque eccedere l'importo delle fee di Piattaforma effettivamente percepite dall'utente nei 12 mesi precedenti l'evento dannoso.

## 14. Proprietà intellettuale

14.1 Il marchio "CleanHome", il logo, il nome di dominio, il codice sorgente dell'App e ogni contenuto editoriale di CleanHome sono di esclusiva proprietà di Nino Mariano Lai (ditta individuale) e tutelati dalle norme su marchi, diritto d'autore e proprietà industriale.

14.2 È vietata qualsiasi riproduzione, modifica, distribuzione o utilizzo non autorizzato.

14.3 I contenuti caricati dagli utenti (foto, recensioni) restano di proprietà degli stessi, i quali concedono a CleanHome una **licenza non esclusiva, gratuita, mondiale** per il loro utilizzo nell'ambito della Piattaforma e per finalità connesse alla sua promozione.

## 15. Modifiche ai Termini

15.1 CleanHome si riserva il diritto di modificare i presenti Termini per esigenze normative, tecniche o organizzative.

15.2 Le modifiche saranno comunicate agli utenti tramite l'App o via email almeno **15 giorni** prima dell'entrata in vigore. Il proseguimento nell'utilizzo dell'App dopo tale termine costituisce accettazione delle modifiche.

15.3 In caso di mancata accettazione, l'utente ha diritto di recedere ai sensi dell'art. 16.

## 16. Recesso e risoluzione

16.1 L'utente può recedere in qualunque momento cancellando il proprio account dalle impostazioni dell'App, fermi restando gli obblighi maturati prima del recesso.

16.2 CleanHome può recedere dal contratto e chiudere l'account dell'utente, con preavviso di 7 giorni o anche immediatamente in caso di **gravi violazioni** dei Termini (frode, comportamenti illeciti, recidiva nelle violazioni dell'art. 8, dichiarazioni mendaci, danni reputazionali).

16.3 La chiusura dell'account non pregiudica le obbligazioni di pagamento, le sanzioni o i diritti di rimborso già maturati.

## 17. Diritto di recesso del consumatore

17.1 Ai sensi dell'art. 49 del Codice del Consumo (D.Lgs. 206/2005), il Cliente che riveste la qualifica di **consumatore** ha diritto di recedere dal contratto entro **14 giorni** dalla conclusione, senza necessità di motivazione.

17.2 Tuttavia, ai sensi dell'art. 59, comma 1, lett. **a)** e **o)** del Codice del Consumo, il diritto di recesso **non si applica** dopo che il Servizio sia stato integralmente eseguito, qualora l'esecuzione sia iniziata con l'accordo espresso del consumatore e con accettazione della perdita del diritto di recesso a seguito di esecuzione completa.

17.3 Per le cancellazioni delle Prenotazioni nei tempi consentiti si rinvia alla [Politica di Rimborso](./refund-policy.md).

## 18. Legge applicabile e foro competente

18.1 I presenti Termini sono regolati dalla **legge italiana**.

18.2 Per ogni controversia derivante dall'interpretazione, esecuzione o risoluzione dei presenti Termini, è competente in via esclusiva il **Foro di Milano**, salvo che l'utente rivesta la qualifica di consumatore: in tal caso, è competente il foro del luogo di residenza o domicilio elettivo del consumatore, ai sensi dell'art. 66-bis del Codice del Consumo.

18.3 Prima di adire l'autorità giudiziaria, le parti si impegnano a tentare una composizione amichevole della controversia. Il consumatore può inoltre avvalersi della piattaforma ODR della Commissione Europea (https://ec.europa.eu/consumers/odr).

## 19. Contatti

Per qualsiasi comunicazione relativa ai presenti Termini:

- Email: info@cleanhome.app
- Indirizzo postale: Via Sicilia 97, 09170 Oristano (OR)

---

## Documenti collegati

- [Informativa sulla Privacy](./privacy-policy.md)
- [Politica di Rimborso](./refund-policy.md)
