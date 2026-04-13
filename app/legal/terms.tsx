import { LegalPage } from "../../components/LegalPage";

export default function TermsScreen() {
  return (
    <LegalPage
      title="Termini di Servizio"
      lastUpdated="Aprile 2026"
      intro="Benvenuto su CleanHome. Utilizzando la nostra app, accetti i seguenti termini e condizioni. Ti invitiamo a leggerli attentamente."
      sections={[
        {
          heading: "Oggetto del servizio",
          body: "CleanHome è una piattaforma che mette in contatto clienti privati con professionisti della pulizia (individuali o imprese) operanti in Italia. CleanHome non fornisce direttamente servizi di pulizia: agisce come intermediario tecnologico.",
        },
        {
          heading: "Registrazione e account",
          body: "Per utilizzare CleanHome devi registrarti fornendo informazioni veritiere e complete. Sei responsabile della riservatezza delle tue credenziali e di tutte le attività che avvengono sul tuo account.",
        },
        {
          heading: "Prenotazioni e pagamenti",
          body: "Le prenotazioni vengono confermate quando il professionista accetta la richiesta. I pagamenti sono processati tramite Stripe in modalità sicura. CleanHome trattiene una commissione di servizio sulla transazione totale.",
        },
        {
          heading: "Obblighi dei professionisti",
          body: "I professionisti iscritti devono essere regolarmente abilitati a svolgere attività di pulizia secondo la normativa italiana, disporre di documenti fiscali validi (P.IVA dove richiesta), e offrire il servizio nel rispetto degli orari concordati con il cliente.",
        },
        {
          heading: "Obblighi dei clienti",
          body: "I clienti si impegnano a garantire l'accesso ai locali nell'orario concordato, a pagare il servizio secondo quanto concordato in fase di prenotazione, e a trattare il professionista con rispetto.",
        },
        {
          heading: "Cancellazioni e rimborsi",
          body: "Le cancellazioni effettuate con almeno 24 ore di anticipo sono gratuite. Cancellazioni tardive possono comportare l'addebito di una commissione pari al 50% del valore del servizio. I rimborsi vengono processati automaticamente su richiesta dell'utente tramite il supporto.",
        },
        {
          heading: "Recensioni",
          body: "Dopo ogni servizio completato il cliente può lasciare una recensione con voto da 1 a 5 stelle. Le recensioni devono essere veritiere, rispettose, e riferite al servizio ricevuto. CleanHome si riserva il diritto di rimuovere recensioni che violino queste regole.",
        },
        {
          heading: "Limitazione di responsabilità",
          body: "CleanHome non è responsabile per la qualità del servizio fornito dai professionisti, né per eventuali danni causati durante l'esecuzione del lavoro. Eventuali controversie devono essere gestite tra cliente e professionista, con la possibilità di richiedere l'intervento del supporto CleanHome come mediatore.",
        },
        {
          heading: "Modifiche ai termini",
          body: "CleanHome si riserva il diritto di modificare i presenti termini in qualsiasi momento. Le modifiche entreranno in vigore dalla data di pubblicazione e saranno notificate agli utenti tramite l'app.",
        },
        {
          heading: "Foro competente",
          body: "Per qualsiasi controversia derivante dall'uso del servizio il foro competente è quello di residenza dell'utente consumatore, in conformità con il Codice del Consumo italiano.",
        },
      ]}
    />
  );
}
