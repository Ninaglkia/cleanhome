import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Termini e Condizioni | CleanHome",
  description:
    "Termini di Servizio di CleanHome — regole di utilizzo, prenotazioni, pagamenti, commissioni e diritti degli utenti.",
  robots: "index, follow",
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Termini di Servizio"
      lastUpdated="2026-04-28"
      version="v1.0"
    >
      <p className="italic text-muted-foreground text-sm mb-8 p-4 bg-muted rounded-xl">
        Documento generato come template di partenza. Si consiglia revisione
        legale da avvocato specializzato in diritto della tutela del consumatore
        prima della pubblicazione definitiva.
      </p>

      <p>
        I presenti Termini di Servizio (di seguito &ldquo;Termini&rdquo;) regolano
        l&apos;utilizzo dell&apos;applicazione mobile CleanHome (bundle id{" "}
        <code>com.cleanhome.app</code>) e dei servizi offerti da [Nome
        Azienda/Privato], P.IVA / CF [P.IVA o CF], con sede legale in [Indirizzo
        sede legale] (di seguito &ldquo;CleanHome&rdquo;,
        &ldquo;Piattaforma&rdquo;, &ldquo;noi&rdquo;).
      </p>
      <p>
        L&apos;accesso e l&apos;utilizzo dell&apos;App comportano l&apos;integrale
        e incondizionata accettazione dei presenti Termini. Si invita l&apos;utente
        a leggerli attentamente prima di procedere alla registrazione.
      </p>

      <h2>1. Oggetto del contratto</h2>
      <p>
        CleanHome è una <strong>piattaforma tecnologica di intermediazione</strong>{" "}
        che mette in contatto soggetti privati che richiedono servizi di pulizia
        domestica (di seguito &ldquo;Clienti&rdquo;) con professionisti autonomi
        che erogano tali servizi (di seguito &ldquo;Professionisti&rdquo;).
      </p>
      <p>
        CleanHome <strong>non eroga direttamente alcun servizio di pulizia</strong>
        . Le attività di pulizia sono svolte in piena autonomia dai Professionisti,
        i quali sono lavoratori indipendenti, non dipendenti né collaboratori di
        CleanHome. CleanHome non assume alcun obbligo di risultato in relazione ai
        servizi prestati dai Professionisti, salvo i limiti di legge.
      </p>

      <h2>2. Definizioni</h2>
      <ul>
        <li>
          <strong>Piattaforma:</strong> l&apos;App mobile CleanHome, il sito web e
          i servizi tecnologici associati.
        </li>
        <li>
          <strong>Cliente:</strong> persona fisica o giuridica che, tramite la
          Piattaforma, richiede un servizio di pulizia.
        </li>
        <li>
          <strong>Professionista:</strong> persona fisica o giuridica che, tramite
          la Piattaforma, offre servizi di pulizia ed esegue le prenotazioni
          accettate.
        </li>
        <li>
          <strong>Servizio:</strong> la prestazione di pulizia domestica oggetto
          della Prenotazione.
        </li>
        <li>
          <strong>Prenotazione:</strong> la richiesta inoltrata dal Cliente
          attraverso l&apos;App e accettata da un Professionista, che dà luogo a
          un contratto bilaterale tra Cliente e Professionista.
        </li>
        <li>
          <strong>Fee di Piattaforma:</strong> la commissione applicata da
          CleanHome a fronte del servizio di intermediazione.
        </li>
        <li>
          <strong>Account:</strong> il profilo personale dell&apos;utente sulla
          Piattaforma.
        </li>
      </ul>

      <h2>3. Registrazione e account</h2>
      <p>
        3.1 La registrazione è gratuita e richiede il conferimento di dati
        veritieri (nome, cognome, email, numero di telefono).
      </p>
      <p>
        3.2 Per i <strong>Professionisti</strong> sono richiesti, in aggiunta:
      </p>
      <ul>
        <li>Codice fiscale e/o Partita IVA</li>
        <li>
          Verifica KYC (&ldquo;Know Your Customer&rdquo;) tramite Stripe Connect
          Express, con caricamento di documento d&apos;identità e dati bancari
        </li>
        <li>Dichiarazione delle zone geografiche di copertura</li>
      </ul>
      <p>
        3.3 L&apos;utente è tenuto a mantenere riservate le proprie credenziali di
        accesso e a notificare tempestivamente a CleanHome qualunque utilizzo non
        autorizzato del proprio account.
      </p>
      <p>
        3.4 È vietato registrare più account per la stessa persona fisica, salvo
        casi specificamente autorizzati da CleanHome.
      </p>
      <p>
        3.5 L&apos;utente garantisce la veridicità e l&apos;accuratezza dei dati
        forniti. CleanHome si riserva il diritto di sospendere o chiudere account
        contenenti dati falsi, incompleti o fraudolenti.
      </p>

      <h2>4. Ruolo della Piattaforma</h2>
      <p>
        4.1 CleanHome agisce esclusivamente come{" "}
        <strong>intermediario tecnologico</strong>. Il contratto di prestazione di
        servizi si perfeziona unicamente tra Cliente e Professionista al momento
        dell&apos;accettazione della Prenotazione.
      </p>
      <p>
        4.2 CleanHome{" "}
        <strong>non è datore di lavoro né committente</strong> dei Professionisti,
        che operano in piena autonomia organizzativa e gestionale. Ciascun
        Professionista è responsabile dei propri obblighi fiscali, previdenziali e
        assicurativi.
      </p>
      <p>
        4.3 CleanHome non garantisce la disponibilità di Professionisti in ogni
        zona o orario, né la qualità soggettiva del servizio reso, salvo
        l&apos;attività di moderazione e controllo svolta in forma di legittimo
        interesse.
      </p>

      <h2>5. Modalità di prenotazione</h2>
      <p>
        5.1 Il Cliente richiede un Servizio tramite l&apos;App, indicando
        indirizzo, metratura dichiarata, data, orario e tipologia di pulizia. Le
        foto della casa sono caricate facoltativamente per descrivere meglio il
        servizio.
      </p>
      <p>
        5.2 Il sistema applica un meccanismo di dispatch
        (&ldquo;modello tipo Deliveroo&rdquo;):
      </p>
      <ul>
        <li>
          la richiesta viene inviata fino a un massimo di{" "}
          <strong>6 Professionisti preferiti</strong> del Cliente, oppure
        </li>
        <li>
          in modalità broadcast, ai Professionisti più vicini disponibili nella
          zona di copertura PostGIS.
        </li>
      </ul>
      <p>
        5.3 Il <strong>primo Professionista che accetta</strong> la richiesta si
        aggiudica la Prenotazione. Le richieste non accettate entro il timeout
        impostato sono automaticamente annullate (vedi Politica di Rimborso).
      </p>
      <p>
        5.4 La conferma della Prenotazione è notificata al Cliente tramite push
        notification ed email transazionale.
      </p>

      <h2>6. Prezzo e pagamenti</h2>
      <p>
        6.1 Il prezzo del Servizio è calcolato automaticamente dalla Piattaforma
        sulla base della metratura dichiarata dal Cliente, secondo la tariffa in
        vigore al momento della Prenotazione, con un importo minimo previsto.
      </p>
      <p>
        6.2 Sul prezzo del Servizio CleanHome applica una{" "}
        <strong>fee di Piattaforma complessiva pari al 18%</strong>, ripartita
        come segue:
      </p>
      <ul>
        <li>
          <strong>9% trattenuto al Cliente</strong> in fase di checkout
        </li>
        <li>
          <strong>9% trattenuto al Professionista</strong> sul payout
        </li>
      </ul>
      <p>
        6.3 I pagamenti sono gestiti tramite{" "}
        <strong>Stripe Connect Express</strong>. CleanHome non tratta direttamente
        né conserva i dati delle carte di pagamento.
      </p>
      <p>
        6.4 I fondi sono trattenuti in custodia (&ldquo;hold&rdquo;) fino al
        completamento del Servizio. Il payout al Professionista avviene secondo i
        tempi tecnici di Stripe (tipicamente 1-7 giorni lavorativi successivi al
        completamento).
      </p>
      <p>
        6.5 Il Cliente autorizza CleanHome a gestire, tramite Stripe, eventuali
        rimborsi, supplementi o storni come previsto dai presenti Termini e dalla
        Politica di Rimborso.
      </p>

      <h2>7. Cancellazioni e rimborsi</h2>
      <p>
        Le condizioni di cancellazione, le percentuali di rimborso e le
        tempistiche sono integralmente disciplinate dalla{" "}
        <Link href="/refund">Politica di Rimborso</Link>, che costituisce parte
        integrante dei presenti Termini.
      </p>

      <h2>8. Anti-bypass dei contatti</h2>
      <p>
        8.1 Allo scopo di garantire la sicurezza degli utenti, la qualità del
        servizio e la tutela del modello economico, è{" "}
        <strong>espressamente vietato</strong> scambiare, sollecitare o tentare di
        acquisire al di fuori della chat di Piattaforma:
      </p>
      <ul>
        <li>numeri di telefono personali</li>
        <li>indirizzi email privati</li>
        <li>
          profili di social network (Instagram, WhatsApp, Telegram, Facebook,
          ecc.)
        </li>
        <li>
          qualsiasi altro recapito che consenta di aggirare il sistema di
          prenotazione e pagamento di CleanHome
        </li>
      </ul>
      <p>
        8.2 La chat in-app è soggetta a moderazione automatica e manuale. La
        violazione del presente articolo comporta l&apos;applicazione delle
        seguenti <strong>sanzioni progressive</strong>:
      </p>
      <ul>
        <li>
          <strong>Primo episodio:</strong> ammonizione formale, sospensione
          dell&apos;account per <strong>30 giorni</strong> e applicazione
          automatica di una <strong>sanzione di € 50,00</strong> sulla prossima
          Prenotazione effettuata.
        </li>
        <li>
          <strong>Secondo episodio:</strong> <strong>ban definitivo</strong>{" "}
          dell&apos;account, con eventuale escussione di importi maturati a
          copertura dei danni, nei limiti di legge.
        </li>
      </ul>
      <p>
        8.3 La sanzione e la sospensione sono comminate da CleanHome previa
        valutazione dei contenuti della chat e costituiscono clausola penale ai
        sensi dell&apos;art. 1382 c.c., senza pregiudizio del risarcimento
        dell&apos;eventuale maggior danno.
      </p>

      <h2>9. Penalità per dichiarazioni mendaci</h2>
      <p>
        9.1 Il Cliente è tenuto a dichiarare con accuratezza la metratura
        dell&apos;immobile e la tipologia di intervento richiesta.
      </p>
      <p>
        9.2 Qualora il Professionista, all&apos;arrivo sul posto, rilevi una
        difformità sostanziale tra quanto dichiarato e la realtà (ad esempio
        metratura significativamente superiore), può aprire un{" "}
        <strong>ricorso documentato con foto evidenza</strong> entro 24 ore dal
        sopralluogo.
      </p>
      <p>
        9.3 Se il ricorso è accolto da CleanHome, sulla{" "}
        <strong>prossima Prenotazione del Cliente</strong> sarà applicato un{" "}
        <strong>supplemento automatico</strong> pari alla differenza dovuta,
        eventualmente maggiorato di un importo a titolo di indennizzo per il tempo
        perso dal Professionista. Il Cliente è informato preventivamente.
      </p>

      <h2>10. Recensioni</h2>
      <p>
        10.1 Le recensioni sono ammesse{" "}
        <strong>soltanto dopo la conclusione del Servizio</strong>, da entrambe le
        parti (Cliente verso Professionista e viceversa).
      </p>
      <p>10.2 È vietato pubblicare recensioni:</p>
      <ul>
        <li>offensive, diffamatorie, discriminatorie o contrarie all&apos;ordine pubblico</li>
        <li>false, inveritiere o manifestamente strumentali</li>
        <li>contenenti dati personali di terzi</li>
        <li>contenenti contatti diretti o link esterni in violazione dell&apos;art. 8</li>
      </ul>
      <p>
        10.3 CleanHome si riserva il diritto, a propria insindacabile valutazione,
        di rimuovere recensioni che violino i presenti Termini, fermi restando i
        diritti dell&apos;utente di contestare la rimozione.
      </p>

      <h2>11. Obblighi del Professionista</h2>
      <p>Il Professionista si impegna a:</p>
      <ul>
        <li>
          completare la{" "}
          <strong>verifica identità tramite Stripe Identity</strong> (documento
          d&apos;identità + selfie + liveness check) prima di poter ricevere
          prenotazioni
        </li>
        <li>
          erogare il Servizio con diligenza professionale, puntualità e nel
          rispetto degli standard qualitativi attesi
        </li>
        <li>
          presentarsi all&apos;indirizzo concordato nell&apos;orario stabilito, in
          condizioni idonee
        </li>
        <li>
          portare a termine la prestazione e caricare la{" "}
          <strong>foto del lavoro completato</strong> in App
        </li>
        <li>
          mantenere validi e aggiornati i dati KYC su Stripe Connect e l&apos;esito
          di verifica Stripe Identity
        </li>
        <li>
          emettere, ove richiesto dalla normativa o dal Cliente, regolare fattura o
          documento commerciale
        </li>
        <li>rispettare la riservatezza sui beni e sugli ambienti del Cliente</li>
        <li>non utilizzare la Piattaforma per finalità illecite</li>
      </ul>
      <p>
        CleanHome si riserva di{" "}
        <strong>sospendere o revocare l&apos;accesso al Servizio</strong> ai
        Professionisti che non completano la verifica identità entro 30 giorni
        dall&apos;iscrizione, o la cui verifica risulti fallita per documenti non
        validi/scaduti.
      </p>

      <h2>12. Obblighi del Cliente</h2>
      <p>Il Cliente si impegna a:</p>
      <ul>
        <li>fornire informazioni veritiere e accurate (indirizzo, metratura, accessi)</li>
        <li>
          garantire al Professionista l&apos;accesso alla proprietà nell&apos;orario
          concordato
        </li>
        <li>effettuare il pagamento secondo le modalità previste</li>
        <li>
          comportarsi con rispetto e correttezza nei confronti del Professionista
        </li>
        <li>
          non esercitare alcun potere direttivo o di subordinazione sul
          Professionista, che opera in autonomia
        </li>
      </ul>

      <h2>13. Limitazione di responsabilità</h2>
      <p>
        13.1 CleanHome non risponde dell&apos;inadempimento o di danni derivanti
        dal rapporto tra Cliente e Professionista, salvo i casi di{" "}
        <strong>dolo o colpa grave</strong> propri o dei propri ausiliari, e fermi
        restando i diritti inderogabili del consumatore.
      </p>
      <p>
        13.2 CleanHome non garantisce l&apos;idoneità delle prestazioni a
        specifiche esigenze del Cliente né l&apos;assenza di interruzioni temporanee
        del servizio dovute a manutenzioni, aggiornamenti o cause di forza
        maggiore.
      </p>
      <p>
        13.3 Eventuali danni materiali alla proprietà del Cliente derivanti
        dall&apos;attività del Professionista possono essere coperti, ove attivata,
        da apposita polizza assicurativa, le cui condizioni sono pubblicate
        separatamente.
      </p>
      <p>
        13.4 Nei limiti di legge, la responsabilità complessiva di CleanHome verso
        un singolo utente non potrà comunque eccedere l&apos;importo delle fee di
        Piattaforma effettivamente percepite dall&apos;utente nei 12 mesi precedenti
        l&apos;evento dannoso.
      </p>

      <h2>14. Proprietà intellettuale</h2>
      <p>
        14.1 Il marchio &ldquo;CleanHome&rdquo;, il logo, il nome di dominio, il
        codice sorgente dell&apos;App e ogni contenuto editoriale di CleanHome sono
        di esclusiva proprietà di [Nome Azienda/Privato] e tutelati dalle norme su
        marchi, diritto d&apos;autore e proprietà industriale.
      </p>
      <p>14.2 È vietata qualsiasi riproduzione, modifica, distribuzione o utilizzo non autorizzato.</p>
      <p>
        14.3 I contenuti caricati dagli utenti (foto, recensioni) restano di
        proprietà degli stessi, i quali concedono a CleanHome una{" "}
        <strong>licenza non esclusiva, gratuita, mondiale</strong> per il loro
        utilizzo nell&apos;ambito della Piattaforma e per finalità connesse alla
        sua promozione.
      </p>

      <h2>15. Modifiche ai Termini</h2>
      <p>
        15.1 CleanHome si riserva il diritto di modificare i presenti Termini per
        esigenze normative, tecniche o organizzative.
      </p>
      <p>
        15.2 Le modifiche saranno comunicate agli utenti tramite l&apos;App o via
        email almeno <strong>15 giorni</strong> prima dell&apos;entrata in vigore.
        Il proseguimento nell&apos;utilizzo dell&apos;App dopo tale termine
        costituisce accettazione delle modifiche.
      </p>
      <p>
        15.3 In caso di mancata accettazione, l&apos;utente ha diritto di recedere
        ai sensi dell&apos;art. 16.
      </p>

      <h2>16. Recesso e risoluzione</h2>
      <p>
        16.1 L&apos;utente può recedere in qualunque momento cancellando il proprio
        account dalle impostazioni dell&apos;App, fermi restando gli obblighi
        maturati prima del recesso.
      </p>
      <p>
        16.2 CleanHome può recedere dal contratto e chiudere l&apos;account
        dell&apos;utente, con preavviso di 7 giorni o anche immediatamente in caso
        di <strong>gravi violazioni</strong> dei Termini (frode, comportamenti
        illeciti, recidiva nelle violazioni dell&apos;art. 8, dichiarazioni mendaci,
        danni reputazionali).
      </p>
      <p>
        16.3 La chiusura dell&apos;account non pregiudica le obbligazioni di
        pagamento, le sanzioni o i diritti di rimborso già maturati.
      </p>

      <h2>17. Diritto di recesso del consumatore</h2>
      <p>
        17.1 Ai sensi dell&apos;art. 49 del Codice del Consumo (D.Lgs. 206/2005),
        il Cliente che riveste la qualifica di <strong>consumatore</strong> ha
        diritto di recedere dal contratto entro <strong>14 giorni</strong> dalla
        conclusione, senza necessità di motivazione.
      </p>
      <p>
        17.2 Tuttavia, ai sensi dell&apos;art. 59, comma 1, lett.{" "}
        <strong>a)</strong> e <strong>o)</strong> del Codice del Consumo, il
        diritto di recesso <strong>non si applica</strong> dopo che il Servizio sia
        stato integralmente eseguito, qualora l&apos;esecuzione sia iniziata con
        l&apos;accordo espresso del consumatore e con accettazione della perdita del
        diritto di recesso a seguito di esecuzione completa.
      </p>
      <p>
        17.3 Per le cancellazioni delle Prenotazioni nei tempi consentiti si rinvia
        alla <Link href="/refund">Politica di Rimborso</Link>.
      </p>

      <h2>18. Legge applicabile e foro competente</h2>
      <p>
        18.1 I presenti Termini sono regolati dalla <strong>legge italiana</strong>.
      </p>
      <p>
        18.2 Per ogni controversia derivante dall&apos;interpretazione, esecuzione o
        risoluzione dei presenti Termini, è competente in via esclusiva il{" "}
        <strong>Foro di Milano</strong>, salvo che l&apos;utente rivesta la
        qualifica di consumatore: in tal caso, è competente il foro del luogo di
        residenza o domicilio elettivo del consumatore, ai sensi dell&apos;art.
        66-bis del Codice del Consumo.
      </p>
      <p>
        18.3 Prima di adire l&apos;autorità giudiziaria, le parti si impegnano a
        tentare una composizione amichevole della controversia. Il consumatore può
        inoltre avvalersi della piattaforma ODR della Commissione Europea (
        <a
          href="https://ec.europa.eu/consumers/odr"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://ec.europa.eu/consumers/odr
        </a>
        ).
      </p>

      <h2>19. Contatti</h2>
      <p>Per qualsiasi comunicazione relativa ai presenti Termini:</p>
      <ul>
        <li>Email: [Email contatto utenti]</li>
        <li>Indirizzo postale: [Indirizzo sede legale]</li>
      </ul>

      <hr />

      <h2>Documenti collegati</h2>
      <ul>
        <li>
          <Link href="/privacy">Informativa sulla Privacy</Link>
        </li>
        <li>
          <Link href="/refund">Politica di Rimborso</Link>
        </li>
      </ul>
    </LegalLayout>
  );
}
