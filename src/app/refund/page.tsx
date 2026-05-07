import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Politica di Rimborso | CleanHome",
  description:
    "Politica di rimborso e cancellazione di CleanHome — tempistiche, percentuali di rimborso, contestazioni e diritto di recesso.",
  robots: "index, follow",
};

export default function RefundPage() {
  return (
    <LegalLayout
      title="Politica di Rimborso"
      lastUpdated="2026-04-28"
      version="v1.0"
    >
      <p className="italic text-muted-foreground text-sm mb-8 p-4 bg-muted rounded-xl">
        Documento generato come template di partenza. Si consiglia revisione
        legale da avvocato specializzato in diritto della tutela del consumatore
        prima della pubblicazione definitiva.
      </p>

      <p>
        La presente Politica di Rimborso disciplina cancellazioni, rimborsi e
        contestazioni relativi alle Prenotazioni effettuate sull&apos;applicazione
        CleanHome (bundle id <code>com.cleanhome.app</code>), gestita da [Nome
        Azienda/Privato], P.IVA / CF [P.IVA o CF], con sede in [Indirizzo sede
        legale].
      </p>
      <p>
        La presente Politica costituisce parte integrante dei{" "}
        <Link href="/terms">Termini di Servizio</Link> e va letta congiuntamente
        all&apos;<Link href="/privacy">Informativa sulla Privacy</Link>.
      </p>

      <h2>1. Principi generali</h2>
      <p>
        1.1 Tutti i pagamenti sono gestiti tramite Stripe. CleanHome non detiene
        direttamente i fondi ma li gestisce in custodia tramite Stripe Connect.
      </p>
      <p>
        1.2 Le percentuali di rimborso indicate si riferiscono all&apos;importo
        lordo pagato dal Cliente, comprensivo della fee di Piattaforma del{" "}
        <strong>9%</strong> trattenuta in sede di checkout (parte delle fee
        complessive del 18% sul valore del servizio).
      </p>
      <p>
        1.3 Salvo diversa indicazione, l&apos;eventuale fee di Piattaforma può
        essere trattenuta o rimborsata in funzione dello stato della Prenotazione
        al momento della cancellazione.
      </p>

      <h2>2. Cancellazione da parte del Cliente</h2>
      <table>
        <thead>
          <tr>
            <th>Tempistica della cancellazione</th>
            <th>Importo rimborsato</th>
            <th>Fee di Piattaforma</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Prima dell&apos;accettazione di un Professionista</td>
            <td>
              <strong>100%</strong>
            </td>
            <td>Rimborsata</td>
          </tr>
          <tr>
            <td>
              Almeno <strong>24 ore</strong> prima dell&apos;intervento (dopo
              accettazione)
            </td>
            <td>
              <strong>100%</strong> del prezzo del Servizio
            </td>
            <td>
              <strong>Trattenuta</strong> (9%)
            </td>
          </tr>
          <tr>
            <td>
              Tra <strong>24 ore e 2 ore</strong> prima dell&apos;intervento
            </td>
            <td>
              <strong>50%</strong>
            </td>
            <td>
              Trattenuta; il 50% restante è corrisposto al Professionista a
              titolo di compenso per riserva
            </td>
          </tr>
          <tr>
            <td>
              Meno di <strong>2 ore</strong> prima oppure{" "}
              <strong>mancata presentazione</strong>
            </td>
            <td>
              <strong>Nessun rimborso</strong>
            </td>
            <td>L&apos;intero importo è corrisposto al Professionista</td>
          </tr>
        </tbody>
      </table>
      <p>
        2.1 La finestra temporale è calcolata sulla base della data e ora di
        inizio Servizio confermate al momento della Prenotazione (fuso orario
        Europe/Rome).
      </p>
      <p>
        2.2 In caso di <strong>forza maggiore documentata</strong> (malattia
        improvvisa con certificato medico, lutto familiare, evento naturale), il
        Cliente può richiedere a CleanHome una valutazione discrezionale e
        ottenere il rimborso integrale o parziale anche al di fuori delle soglie
        temporali sopra indicate.
      </p>

      <h2>3. Cancellazione da parte del Professionista</h2>
      <p>
        3.1 <strong>Mancata accettazione entro 24 ore dalla richiesta:</strong>{" "}
        la Prenotazione si auto-cancella e il Cliente riceve{" "}
        <strong>rimborso del 100%</strong>, comprese le fee.
      </p>
      <p>
        3.2 <strong>Cancellazione del Professionista dopo l&apos;accettazione:</strong>{" "}
        il Cliente riceve <strong>rimborso del 100%</strong>. Al Professionista
        sono applicate le seguenti sanzioni:
      </p>
      <ul>
        <li>decurtazione del rating reputazionale</li>
        <li>
          sospensione temporanea dell&apos;account, di durata variabile in base
          alla recidiva
        </li>
        <li>nei casi gravi o ripetuti, ban definitivo</li>
      </ul>
      <p>
        3.3 <strong>Mancata presentazione del Professionista (no-show):</strong>{" "}
        il Cliente riceve <strong>rimborso del 100%</strong> e, a titolo di
        indennizzo per il disagio, un <strong>credito di € 15,00</strong>{" "}
        (&ldquo;supplemento di scuse&rdquo;) utilizzabile sulla prossima
        Prenotazione, accreditato automaticamente entro 48 ore. Il Professionista
        è soggetto alle sanzioni di cui all&apos;art. 3.2.
      </p>

      <h2>4. Lavoro mal eseguito o incompleto</h2>
      <p>
        4.1 Qualora il Cliente ritenga che il Servizio sia stato erogato in modo
        incompleto o non conforme agli standard attesi, può aprire una{" "}
        <strong>contestazione</strong> entro <strong>48 ore</strong> dal
        completamento del Servizio.
      </p>
      <p>4.2 La contestazione deve includere:</p>
      <ul>
        <li>descrizione testuale del problema</li>
        <li>
          <strong>foto evidenza</strong> del lavoro contestato
        </li>
        <li>eventuali ulteriori prove documentali</li>
      </ul>
      <p>
        4.3 La contestazione è valutata dal team CleanHome (con eventuale supporto
        di strumenti di analisi automatica AI) entro{" "}
        <strong>7 giorni lavorativi</strong>, sentite entrambe le parti. Gli esiti
        possibili sono:
      </p>
      <ul>
        <li>
          <strong>Rimborso 100%</strong> del prezzo del Servizio (al netto della
          fee di Piattaforma, salvo diversa decisione di CleanHome): in caso di
          evidente inesecuzione o esecuzione gravemente difforme.
        </li>
        <li>
          <strong>Rimborso parziale:</strong> percentuale determinata
          discrezionalmente dal team in funzione della gravità dell&apos;inadempimento.
        </li>
        <li>
          <strong>Rigetto della contestazione:</strong> in caso di richiesta non
          motivata, abusiva o non corredata da prove sufficienti.
        </li>
      </ul>
      <p>
        4.4 La decisione di CleanHome è comunicata al Cliente e al Professionista
        via email e tramite l&apos;App. Resta salvo il diritto delle parti di far
        valere ulteriori rimedi nelle sedi competenti.
      </p>

      <h2>5. Tempistiche di rimborso</h2>
      <p>
        5.1 I rimborsi approvati sono disposti tramite Stripe sul medesimo
        strumento di pagamento utilizzato per l&apos;acquisto.
      </p>
      <p>
        5.2 I tempi tecnici di accredito sulla carta del Cliente variano a seconda
        dell&apos;emittente e si attestano normalmente in{" "}
        <strong>5-10 giorni lavorativi</strong> dalla disposizione del rimborso.
      </p>
      <p>
        5.3 In caso di mancato accredito decorsi 14 giorni lavorativi, il Cliente
        è invitato a contattare il proprio istituto bancario; CleanHome resta a
        disposizione per fornire il riferimento Stripe della transazione di
        rimborso.
      </p>

      <h2>6. Come richiedere un rimborso</h2>
      <p>
        6.1 Tutte le richieste si gestiscono dall&apos;App, nella sezione{" "}
        <strong>&ldquo;Le mie prenotazioni&rdquo;</strong>, selezionando la
        Prenotazione di interesse e premendo:
      </p>
      <ul>
        <li>
          <strong>&ldquo;Annulla prenotazione&rdquo;</strong> per cancellazioni
          nei termini di cui all&apos;art. 2;
        </li>
        <li>
          <strong>&ldquo;Apri contestazione&rdquo;</strong> per le ipotesi
          dell&apos;art. 4 (lavoro mal eseguito o incompleto).
        </li>
      </ul>
      <p>
        6.2 In caso di impossibilità tecnica all&apos;utilizzo dell&apos;App, le
        richieste possono essere inviate via email a [Email contatto utenti],
        indicando: ID Prenotazione, data del Servizio, oggetto della richiesta e
        motivazione.
      </p>

      <h2>7. Diritto di recesso del consumatore (Codice del Consumo)</h2>
      <p>
        7.1 Ai sensi dell&apos;art. 52 del D.Lgs. 206/2005 (&ldquo;Codice del
        Consumo&rdquo;), il Cliente consumatore ha diritto di recedere dal
        contratto a distanza entro <strong>14 giorni</strong> dalla conclusione,
        senza dover fornire alcuna motivazione.
      </p>
      <p>
        7.2 Tuttavia, ai sensi dell&apos;
        <strong>art. 59, comma 1, lett. a) e o)</strong> del Codice del Consumo,
        il diritto di recesso <strong>non si applica</strong> ai contratti di
        servizi una volta che la prestazione sia stata{" "}
        <strong>integralmente eseguita</strong>, qualora l&apos;esecuzione sia
        iniziata con l&apos;accordo espresso del consumatore e con la sua
        accettazione della perdita del diritto di recesso a seguito
        dell&apos;esecuzione completa del contratto.
      </p>
      <p>
        7.3 Per i Servizi non ancora eseguiti, il diritto di recesso può essere
        esercitato secondo le tempistiche previste all&apos;art. 2 della presente
        Politica, che integra e attua le tutele del Codice del Consumo
        nell&apos;ambito specifico della Piattaforma.
      </p>

      <h2>8. Composizione amichevole e ODR</h2>
      <p>
        8.1 Le parti si impegnano a tentare la composizione amichevole di ogni
        controversia prima di adire l&apos;autorità giudiziaria.
      </p>
      <p>
        8.2 Il consumatore può ricorrere alla piattaforma di Online Dispute
        Resolution della Commissione Europea:{" "}
        <a
          href="https://ec.europa.eu/consumers/odr"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://ec.europa.eu/consumers/odr
        </a>
      </p>

      <h2>9. Contatti</h2>
      <p>
        Per qualsiasi richiesta o chiarimento sulla presente Politica:
      </p>
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
          <Link href="/terms">Termini di Servizio</Link>
        </li>
      </ul>
    </LegalLayout>
  );
}
