import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy | CleanHome",
  description:
    "Informativa privacy GDPR di CleanHome — gestione dati personali, Stripe Identity, cookie.",
  robots: "index, follow",
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Informativa sulla Privacy"
      lastUpdated="2026-04-28"
      version="v1.0"
    >
      <p className="italic text-muted-foreground text-sm mb-8 p-4 bg-muted rounded-xl">
        Documento generato come template di partenza. Si consiglia revisione
        legale da avvocato specializzato in diritto della tutela del consumatore
        prima della pubblicazione definitiva.
      </p>

      <p>
        La presente Informativa sulla Privacy descrive le modalità con cui
        CleanHome (di seguito &ldquo;CleanHome&rdquo;, &ldquo;noi&rdquo;,
        &ldquo;la Piattaforma&rdquo;) raccoglie, utilizza e protegge i dati
        personali degli utenti dell&apos;applicazione mobile CleanHome (bundle
        id <code>com.cleanhome.app</code>, di seguito &ldquo;App&rdquo;) e del
        sito web associato.
      </p>
      <p>
        Il documento è redatto ai sensi del Regolamento (UE) 2016/679
        (&ldquo;GDPR&rdquo;), del D.Lgs. 196/2003 e successive modifiche
        (&ldquo;Codice Privacy&rdquo;), nonché dei provvedimenti del Garante per
        la protezione dei dati personali italiano.
      </p>

      <h2>1. Titolare del trattamento</h2>
      <p>Il Titolare del trattamento dei dati personali è:</p>
      <ul>
        <li>
          <strong>Denominazione:</strong> [Nome Azienda/Privato]
        </li>
        <li>
          <strong>Sede legale:</strong> [Indirizzo sede legale]
        </li>
        <li>
          <strong>P.IVA / Codice Fiscale:</strong> [P.IVA o CF]
        </li>
        <li>
          <strong>Email di contatto utenti:</strong> [Email contatto utenti]
        </li>
        <li>
          <strong>Email del Responsabile della protezione dei dati (DPO):</strong>{" "}
          [Email DPO se nominato]
        </li>
      </ul>
      <p>
        L&apos;utente può rivolgersi ai recapiti sopra indicati per esercitare i
        propri diritti o richiedere chiarimenti relativi al trattamento dei
        propri dati.
      </p>

      <h2>2. Tipologie di dati raccolti</h2>
      <p>
        CleanHome raccoglie le seguenti categorie di dati personali, in funzione
        del ruolo dell&apos;utente (Cliente o Professionista):
      </p>

      <h3>2.1 Dati di registrazione e profilo</h3>
      <ul>
        <li>Nome e cognome</li>
        <li>Indirizzo email</li>
        <li>Numero di telefono</li>
        <li>Foto profilo (facoltativa)</li>
        <li>Password (conservata in forma criptata, mai in chiaro)</li>
      </ul>

      <h3>2.2 Dati fiscali (solo Professionisti)</h3>
      <ul>
        <li>Codice fiscale e/o Partita IVA</li>
        <li>
          Dati bancari per ricezione pagamenti (gestiti direttamente da Stripe
          Connect)
        </li>
      </ul>

      <h3>2.2.bis Verifica identità tramite Stripe Identity (solo Professionisti)</h3>
      <p>
        Prima di poter ricevere prenotazioni, ogni Professionista deve completare
        la verifica identità tramite <strong>Stripe Identity</strong> (servizio
        di Stripe Payments Europe Ltd.). La verifica include:
      </p>
      <ul>
        <li>
          Scansione del documento d&apos;identità (carta d&apos;identità,
          passaporto o patente di guida)
        </li>
        <li>
          Selfie con <strong>liveness check 3D</strong> (rilevamento di
          movimento e profondità del volto)
        </li>
        <li>Confronto automatico tra foto del documento e selfie</li>
      </ul>
      <p>
        I <strong>dati biometrici</strong> (struttura del volto, pattern di
        liveness) sono trattati <strong>direttamente da Stripe Inc.</strong>, non
        sono mai accessibili a CleanHome né conservati sui nostri server.
        CleanHome riceve esclusivamente:
      </p>
      <ul>
        <li>Esito della verifica (verificato / fallito / da reinviare)</li>
        <li>
          Nome, cognome e data di nascita estratti dal documento (necessari per
          le comunicazioni e la fatturazione)
        </li>
        <li>
          ID interno della verifica (<code>verification_session_id</code>) per
          riferimento
        </li>
      </ul>
      <p>
        Base giuridica del trattamento: art. 6.1.b GDPR (esecuzione del
        contratto), art. 9.2.b (necessità per adempimento di obblighi e diritti
        in materia di lavoro/sicurezza). Per ulteriori dettagli sul trattamento
        dei dati biometrici da parte di Stripe:{" "}
        <a
          href="https://stripe.com/legal/identity"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://stripe.com/legal/identity
        </a>
      </p>

      <h3>2.3 Dati di geolocalizzazione</h3>
      <ul>
        <li>
          Latitudine e longitudine dell&apos;indirizzo del Cliente (per
          consentire il dispatch al Professionista più vicino)
        </li>
        <li>
          Zona di copertura dichiarata dal Professionista (poligono geografico
          gestito tramite PostGIS)
        </li>
        <li>
          Posizione GPS dell&apos;App al momento della prenotazione (con consenso
          esplicito dell&apos;utente)
        </li>
      </ul>

      <h3>2.4 Contenuti caricati dagli utenti</h3>
      <ul>
        <li>
          Foto della casa o degli ambienti, caricate dal Cliente per descrivere
          il servizio richiesto
        </li>
        <li>
          Foto del lavoro completato, caricate dal Professionista a conclusione
          dell&apos;intervento
        </li>
        <li>
          Recensioni e valutazioni (rating) scambiate tra Cliente e
          Professionista
        </li>
      </ul>

      <h3>2.5 Dati di pagamento</h3>
      <p>
        CleanHome <strong>non</strong> memorizza direttamente i dati delle carte
        di pagamento, che sono gestiti integralmente da Stripe Payments Europe
        Ltd. e dalla piattaforma Stripe Connect. CleanHome riceve unicamente
        identificativi di transazione (<code>PaymentIntent ID</code>,{" "}
        <code>Charge ID</code>) e l&apos;esito del pagamento.
      </p>

      <h3>2.6 Comunicazioni</h3>
      <ul>
        <li>
          Conversazioni in chat tra Cliente e Professionista, conservate sulla
          tabella <code>messages</code> del database
        </li>
        <li>
          Email transazionali inviate per conferme di prenotazione, ricevute,
          notifiche di stato
        </li>
      </ul>

      <h3>2.7 Dati tecnici</h3>
      <ul>
        <li>Token push notification Expo (per invio notifiche al dispositivo)</li>
        <li>Indirizzo IP, modello di dispositivo, sistema operativo, versione App</li>
        <li>Log di accesso e di sicurezza</li>
      </ul>

      <h2>3. Finalità del trattamento e base giuridica</h2>
      <table>
        <thead>
          <tr>
            <th>Finalità</th>
            <th>Base giuridica (art. 6 GDPR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Esecuzione del contratto di intermediazione (creazione account,
              gestione prenotazioni, pagamenti, chat)
            </td>
            <td>Art. 6.1.b — esecuzione di un contratto</td>
          </tr>
          <tr>
            <td>Adempimento obblighi fiscali e contabili</td>
            <td>Art. 6.1.c — obbligo legale</td>
          </tr>
          <tr>
            <td>
              Prevenzione frodi, sicurezza dell&apos;App, tutela contro abusi
              (es. anti-bypass contatti)
            </td>
            <td>Art. 6.1.f — legittimo interesse</td>
          </tr>
          <tr>
            <td>
              Invio comunicazioni di marketing, newsletter, offerte promozionali
            </td>
            <td>Art. 6.1.a — consenso esplicito (opt-in)</td>
          </tr>
          <tr>
            <td>Miglioramento del servizio e analisi statistiche aggregate</td>
            <td>Art. 6.1.f — legittimo interesse</td>
          </tr>
          <tr>
            <td>
              Risposta a richieste delle autorità giudiziarie o amministrative
            </td>
            <td>Art. 6.1.c — obbligo legale</td>
          </tr>
        </tbody>
      </table>
      <p>
        Il consenso al marketing è facoltativo, revocabile in qualsiasi momento,
        e non condiziona l&apos;utilizzo del servizio.
      </p>

      <h2>4. Modalità di trattamento</h2>
      <p>
        I dati sono trattati con strumenti informatici, su server collocati
        nell&apos;Unione Europea (Francoforte, Germania), tramite
        l&apos;infrastruttura cloud di Supabase. Sono adottate misure tecniche e
        organizzative adeguate (cifratura in transito tramite TLS, cifratura
        at-rest del database, accessi controllati con autenticazione a più fattori
        per il personale autorizzato, backup periodici).
      </p>
      <p>
        Il trattamento avviene esclusivamente da parte di personale autorizzato e
        di responsabili esterni nominati ai sensi dell&apos;art. 28 GDPR.
      </p>

      <h2>5. Periodi di conservazione</h2>
      <p>
        I dati sono conservati per i periodi minimi necessari alle finalità per
        cui sono stati raccolti:
      </p>
      <ul>
        <li>
          <strong>Dati account:</strong> per l&apos;intera durata del rapporto e
          per ulteriori <strong>2 anni</strong> dopo la cancellazione, al fine di
          tutelare CleanHome in caso di contenzioso e di rispettare obblighi
          fiscali residui.
        </li>
        <li>
          <strong>Conversazioni in chat:</strong> <strong>12 mesi</strong> dalla
          data dell&apos;ultimo messaggio.
        </li>
        <li>
          <strong>Foto del lavoro completato e foto della casa:</strong>{" "}
          <strong>24 mesi</strong> dalla data di caricamento, per consentire la
          gestione di eventuali contestazioni.
        </li>
        <li>
          <strong>Dati fiscali e di transazione:</strong> <strong>10 anni</strong>
          , ai sensi dell&apos;art. 2220 c.c. e della normativa fiscale italiana.
        </li>
        <li>
          <strong>Recensioni e rating:</strong> mantenuti in forma anonimizzata
          anche dopo cancellazione dell&apos;account, a tutela dell&apos;integrità
          del sistema reputazionale della Piattaforma.
        </li>
        <li>
          <strong>Token push notification:</strong> fino a revoca o
          disinstallazione dell&apos;App.
        </li>
        <li>
          <strong>Log di accesso:</strong> <strong>6 mesi</strong>.
        </li>
      </ul>
      <p>
        Al termine dei periodi di conservazione i dati vengono cancellati o
        anonimizzati in modo irreversibile.
      </p>

      <h2>6. Destinatari dei dati</h2>
      <p>
        I dati possono essere comunicati ai seguenti soggetti, in qualità di
        Responsabili del trattamento ex art. 28 GDPR o titolari autonomi:
      </p>
      <ul>
        <li>
          <strong>Stripe Payments Europe Ltd.</strong> (Irlanda) e{" "}
          <strong>Stripe Inc.</strong> (USA): gestione pagamenti, custodia fondi,
          KYC dei Professionisti tramite Stripe Connect Express
        </li>
        <li>
          <strong>Supabase Inc.</strong> (con server EU a Francoforte): hosting
          database, autenticazione, storage delle immagini
        </li>
        <li>
          <strong>Expo (650 Industries, Inc.)</strong> (USA): invio notifiche
          push tramite servizio Expo Push
        </li>
        <li>
          <strong>Google LLC / Google Cloud EMEA Ltd.</strong>: Maps API,
          geocoding, eventuali servizi di posta elettronica
        </li>
        <li>
          Fornitori SMTP per invio email transazionali (es. Resend, Postmark o
          equivalenti)
        </li>
        <li>
          Consulenti fiscali, legali e contabili, vincolati da obblighi di
          riservatezza
        </li>
        <li>Autorità giudiziarie o amministrative, su richiesta legittima</li>
      </ul>
      <p>
        L&apos;elenco aggiornato dei Responsabili del trattamento può essere
        richiesto scrivendo all&apos;indirizzo [Email contatto utenti].
      </p>

      <h2>7. Trasferimento dei dati extra-UE</h2>
      <p>
        Alcuni Responsabili hanno sede o effettuano trattamenti negli Stati Uniti
        d&apos;America. In tali casi il trasferimento avviene sulla base di adeguate
        garanzie ai sensi degli artt. 44 e ss. GDPR:
      </p>
      <ul>
        <li>
          <strong>Stripe Inc. (USA):</strong> Standard Contractual Clauses (SCC)
          approvate dalla Commissione UE, integrate da misure tecniche
          supplementari
        </li>
        <li>
          <strong>Google LLC (USA):</strong> adesione al{" "}
          <strong>Data Privacy Framework UE-USA</strong> (DPF)
        </li>
        <li>
          <strong>Expo / 650 Industries (USA):</strong> Standard Contractual
          Clauses (SCC)
        </li>
      </ul>
      <p>
        Una copia delle garanzie applicabili può essere richiesta scrivendo a
        [Email contatto utenti].
      </p>

      <h2>8. Diritti dell&apos;interessato</h2>
      <p>
        In ogni momento l&apos;utente può esercitare, ai sensi degli artt. 15-22
        GDPR, i seguenti diritti:
      </p>
      <ul>
        <li>
          <strong>Accesso</strong> ai propri dati personali (art. 15)
        </li>
        <li>
          <strong>Rettifica</strong> dei dati inesatti (art. 16)
        </li>
        <li>
          <strong>Cancellazione</strong> (&ldquo;diritto all&apos;oblio&rdquo;)
          nei limiti consentiti dalla legge (art. 17)
        </li>
        <li>
          <strong>Limitazione</strong> del trattamento (art. 18)
        </li>
        <li>
          <strong>Portabilità</strong> dei dati in formato strutturato e leggibile
          (art. 20)
        </li>
        <li>
          <strong>Opposizione</strong> al trattamento basato sul legittimo
          interesse (art. 21)
        </li>
        <li>
          <strong>Revoca del consenso</strong> in qualunque momento, senza
          pregiudicare la liceità dei trattamenti già effettuati
        </li>
        <li>
          <strong>Reclamo</strong> all&apos;Autorità Garante per la protezione dei
          dati personali (
          <a
            href="https://www.garanteprivacy.it"
            target="_blank"
            rel="noopener noreferrer"
          >
            www.garanteprivacy.it
          </a>
          )
        </li>
      </ul>
      <p>
        Per esercitare tali diritti è sufficiente inviare una richiesta a [Email
        contatto utenti] o, se nominato, al DPO all&apos;indirizzo [Email DPO se
        nominato]. La risposta sarà fornita entro <strong>30 giorni</strong> dalla
        ricezione, prorogabili di ulteriori 60 giorni in caso di richieste
        complesse.
      </p>

      <h2>9. Cookie e tecnologie di tracciamento</h2>
      <p>
        L&apos;App mobile CleanHome <strong>non utilizza cookie</strong>.
        L&apos;eventuale sito web associato (landing page e pagine legali ospitate
        su Vercel) può utilizzare unicamente <strong>cookie tecnici</strong>{" "}
        strettamente necessari al funzionamento del sito, per i quali non è
        richiesto consenso ai sensi dell&apos;art. 122 del Codice Privacy. Non
        sono utilizzati cookie di profilazione, analitici di terze parti o di
        marketing senza preventivo consenso.
      </p>

      <h2>10. Minori</h2>
      <p>
        Il servizio CleanHome non è destinato a soggetti di età inferiore ai{" "}
        <strong>18 anni</strong>. CleanHome non raccoglie consapevolmente dati di
        minori. Qualora un genitore o tutore dovesse riscontrare la registrazione
        di un minore, è invitato a segnalarlo immediatamente a [Email contatto
        utenti] per la tempestiva cancellazione dell&apos;account.
      </p>

      <h2>11. Modifiche alla presente Informativa</h2>
      <p>
        CleanHome si riserva il diritto di aggiornare la presente Informativa per
        riflettere modifiche normative, organizzative o tecniche. Le modifiche
        sostanziali saranno notificate agli utenti tramite l&apos;App o via email
        almeno <strong>15 giorni</strong> prima della loro entrata in vigore. La
        data di &ldquo;Ultimo aggiornamento&rdquo; in cima al documento indica
        sempre la versione vigente.
      </p>

      <h2>12. Contatti</h2>
      <p>Per qualsiasi domanda relativa al trattamento dei dati personali:</p>
      <ul>
        <li>Email generale: [Email contatto utenti]</li>
        <li>Email DPO (se nominato): [Email DPO se nominato]</li>
        <li>Indirizzo postale: [Indirizzo sede legale]</li>
      </ul>

      <hr />

      <h2>Documenti collegati</h2>
      <ul>
        <li>
          <Link href="/terms">Termini di Servizio</Link>
        </li>
        <li>
          <Link href="/refund">Politica di Rimborso</Link>
        </li>
      </ul>
    </LegalLayout>
  );
}
