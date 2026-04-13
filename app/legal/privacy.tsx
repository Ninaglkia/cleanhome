import { LegalPage } from "../../components/LegalPage";

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Informativa Privacy"
      lastUpdated="Aprile 2026"
      intro="CleanHome tratta i tuoi dati personali nel rispetto del Regolamento UE 2016/679 (GDPR). Questa informativa spiega quali dati raccogliamo, come li utilizziamo e quali sono i tuoi diritti."
      sections={[
        {
          heading: "Titolare del trattamento",
          body: "Titolare del trattamento è CleanHome S.r.l., con sede legale in Italia. Per esercitare i tuoi diritti puoi contattarci all'indirizzo privacy@cleanhome.app.",
        },
        {
          heading: "Dati raccolti",
          body: "Raccogliamo: (a) dati di registrazione (nome, email, password cifrata), (b) dati di profilo (foto, biografia per i professionisti), (c) dati di localizzazione approssimativa per mostrarti i professionisti vicini, (d) dati di prenotazione (indirizzo, orari, servizio richiesto), (e) dati di pagamento tramite Stripe (noi non memorizziamo i numeri di carta), (f) dati tecnici (dispositivo, versione app, log di errore).",
        },
        {
          heading: "Finalità del trattamento",
          body: "Utilizziamo i tuoi dati per: fornire il servizio di prenotazione, processare i pagamenti, inviarti notifiche sullo stato delle prenotazioni, migliorare la sicurezza della piattaforma, adempiere a obblighi di legge, e — solo con il tuo consenso esplicito — per comunicazioni commerciali.",
        },
        {
          heading: "Base giuridica",
          body: "Il trattamento si basa sull'esecuzione del contratto (art. 6.1.b GDPR) per la fornitura del servizio, sul consenso (art. 6.1.a) per le comunicazioni commerciali, e sul legittimo interesse (art. 6.1.f) per la prevenzione frodi.",
        },
        {
          heading: "Condivisione con terzi",
          body: "I tuoi dati sono condivisi con: (1) Supabase (hosting e database, server in UE), (2) Stripe (processore pagamenti certificato PCI DSS), (3) Google Maps / Places per la geolocalizzazione, (4) Sentry per il monitoraggio errori. Tutti i provider rispettano il GDPR e trattano i dati come responsabili del trattamento.",
        },
        {
          heading: "Geolocalizzazione",
          body: "L'app richiede l'accesso alla tua posizione per mostrarti professionisti vicini e per consentire ai clienti di trovare il tuo servizio. Puoi revocare il permesso in qualsiasi momento dalle impostazioni del dispositivo.",
        },
        {
          heading: "Periodo di conservazione",
          body: "Conserviamo i dati di account finché l'utente mantiene attivo il profilo. Le ricevute di pagamento sono conservate per 10 anni in conformità con gli obblighi fiscali italiani. I log tecnici sono conservati al massimo 90 giorni.",
        },
        {
          heading: "I tuoi diritti",
          body: "Hai diritto di: accedere ai tuoi dati, chiederne la rettifica o la cancellazione, limitarne o opporti al trattamento, richiedere la portabilità. Per esercitare questi diritti scrivi a privacy@cleanhome.app. In caso di violazione puoi presentare reclamo al Garante Privacy italiano.",
        },
        {
          heading: "Cancellazione account",
          body: "Puoi richiedere la cancellazione completa del tuo account contattando support@cleanhome.app. Entro 30 giorni lavorativi tutti i tuoi dati personali verranno cancellati, ad eccezione di quelli che devono essere conservati per obblighi di legge.",
        },
        {
          heading: "Minori",
          body: "Il servizio non è destinato ai minori di 18 anni. Non raccogliamo consapevolmente dati di minori. Se veniamo a conoscenza di un account intestato a un minore, procederemo alla sua chiusura.",
        },
      ]}
    />
  );
}
