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
          heading: "Prenotazioni e pagamenti (escrow)",
          body: "Le prenotazioni vengono confermate quando un professionista accetta la richiesta. I pagamenti sono processati tramite Stripe (PCI-DSS Level 1). L'addebito è immediato al momento della prenotazione, ma i fondi restano custoditi da CleanHome in modalità escrow: il pagamento viene rilasciato al professionista solo dopo la conferma esplicita del cliente o automaticamente dopo 48 ore dal completamento del servizio. CleanHome trattiene una commissione del 9% al cliente e una commissione del 9% al professionista (commissione totale 18%).",
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
          body: "Cancellazione con più di 24 ore di anticipo: rimborso completo. Cancellazione tra 24 e 2 ore prima del servizio: rimborso del 50% del prezzo del servizio. Cancellazione meno di 2 ore prima o no-show del cliente: nessun rimborso. Se nessun professionista accetta la richiesta entro 20 minuti, il rimborso è automatico e completo. In caso di servizio non conforme il cliente può aprire una contestazione entro le 48 ore successive al completamento del lavoro. CleanHome processa il rimborso immediatamente verso la carta originale; l'accredito sulla carta dipende dalla banca emittente e avviene tipicamente in 3-7 giorni lavorativi (in alcuni casi fino a 10).",
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
