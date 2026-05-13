# Store listing — CleanHome v1.0.0

Tutti i testi italiani, pronti per App Store Connect e Google Play Console.
Bundle ID / Package: `com.cleanhome.app`.

---

## Apple App Store Connect

### Nome
`CleanHome`

### Sottotitolo (max 30 caratteri)
`Pulizie a casa, in pochi tap`

### Descrizione promozionale (max 170 caratteri, modificabile senza review)
`Prenota un cleaner verificato vicino a te, paga in app e segui il servizio in tempo reale. Senza contanti, senza trattative.`

### Descrizione (max 4000 caratteri)
```
CleanHome è il modo più semplice per prenotare un servizio di pulizia domestica in Italia. Niente telefonate, niente preventivi a voce, niente contanti: scegli il giorno, conferma e in pochi minuti un professionista verificato accetta la tua richiesta.

COME FUNZIONA
- Inserisci la tua casa: indirizzo, metri quadri, tipo di pulizia
- Ricevi un prezzo trasparente calcolato sulla superficie
- Un cleaner della tua zona accetta in pochi minuti
- Paghi in app con carta o Apple Pay, l’importo resta in escrow
- Segui il cleaner in arrivo sulla mappa
- A lavoro fatto confermi e il pagamento viene rilasciato
- Lascia una recensione per aiutare la community

PERCHÉ CLEANHOME
- Professionisti verificati con identità Stripe Identity (documento + selfie)
- Prezzi chiari basati sui metri quadri, niente sorprese
- Pagamento protetto in escrow: paghi solo a servizio confermato
- Possibilità di aprire una contestazione con rimborso parziale o totale
- Chat in app con il cleaner, sempre dentro la piattaforma
- Recensioni reali, solo da chi ha completato un servizio

PER I PROFESSIONISTI
Sei un cleaner? CleanHome è anche per te:
- Crea un annuncio con servizi e zona di copertura
- Ricevi richieste nella tua area
- Accetta in un tap, lavora con clienti già verificati
- Incassi diretti via Stripe Connect entro pochi giorni
- Costruisci la tua reputazione con recensioni vere

TRASPARENZA E SICUREZZA
- Pagamenti gestiti da Stripe, mai sul nostro server
- Comunicazioni protette: la chat blocca tentativi di contatto fuori piattaforma
- Foto del lavoro per verifiche e contestazioni
- Conformità GDPR, server in Unione Europea

CleanHome è disponibile in tutta Italia. Stiamo iniziando dalle grandi città e ci espandiamo settimana dopo settimana — se non vedi cleaner nella tua zona, prova fra qualche giorno.

Privacy: https://www.cleanhomeapp.com/privacy
Termini: https://www.cleanhomeapp.com/terms
Rimborsi: https://www.cleanhomeapp.com/refund
Supporto: info@cleanhomeapp.com
```

### Parole chiave (max 100 caratteri, separate da virgola, no spazi dopo virgola)
```
pulizie,casa,cleaner,prenotazione,colf,domestica,servizi,pulizia
```

### URL di supporto
`https://www.cleanhomeapp.com`

### URL marketing (opzionale)
`https://www.cleanhomeapp.com`

### Note per la review (Apple App Review Information)
```
Test account per la review:
- Email: review-apple@cleanhomeapp.com
- Password: <da generare prima della submission>

Demo flow:
1. Login con l'account sopra (ruolo Cliente preimpostato)
2. Home → la mappa mostra cleaner mock nella zona di Milano
3. Tap su un cleaner → schermata di prenotazione
4. Conferma → carta di test 4242 4242 4242 4242, qualsiasi data futura, qualsiasi CVC
5. Visualizza tracking realtime (mock fixture attiva in modalità review)

L'app integra Stripe Connect (marketplace), Stripe Identity per la verifica KYC dei cleaner e PostGIS per la ricerca geospaziale. Tutti i pagamenti sono in modalità live; le carte di test funzionano perché abbiamo abilitato il flag review_mode sull'account di test.

Note: l'app è in italiano. La descrizione marketing è in italiano. La review può essere effettuata in italiano o inglese — i copy in-app sono brevi e auto-esplicativi.
```

### Versione (Cosa c'è di nuovo — what's new in v1.0.0)
```
Prima versione di CleanHome 🎉
- Prenotazione pulizie in pochi tap
- Pagamento sicuro con escrow
- Tracking del cleaner in tempo reale
- Chat protetta in app
- Recensioni verificate
```

### App Privacy (Data Types collected)
Compila in App Store Connect → App Privacy. Per ciascuna sezione segna i tipi raccolti e se sono linkati all'identità dell'utente.

| Categoria | Tipo dato | Raccolto | Usato per | Linked to user |
|---|---|---|---|---|
| Contact Info | Nome | Sì | App functionality | Sì |
| Contact Info | Email | Sì | App functionality | Sì |
| Contact Info | Telefono | Sì (opt-in da cleaner per Stripe Identity) | App functionality | Sì |
| Identifiers | User ID | Sì | App functionality | Sì |
| Identifiers | Device ID | Sì (push token) | App functionality | Sì |
| Location | Precise Location | Sì | App functionality (matching cleaner-cliente) | Sì |
| User Content | Foto | Sì (avatar, foto lavoro) | App functionality | Sì |
| Diagnostics | Crash data | Sì (Sentry) | Diagnostics | No (aggregato) |
| Diagnostics | Performance data | Sì (Sentry) | Diagnostics | No |
| Financial Info | Payment Info | Sì (gestito da Stripe, non memorizzato da noi) | Purchases | Sì |
| Sensitive Info | Documento identità | Sì (cleaner only, gestito da Stripe Identity) | App functionality | Sì |

Non vengono raccolti: contatti dalla rubrica, dati di salute, dati di tracking pubblicitario cross-app (l'app non integra SDK pubblicitari).

### Age rating
4+ (nessun contenuto adulto, gambling, alcohol, violenza).

### Categoria
Primary: `Lifestyle`
Secondary: `Productivity`

### Copyright
`© 2026 Nino Mariano Lai — ditta individuale`

---

## Google Play Console

### Titolo (max 30 caratteri)
`CleanHome — Pulizie casa`

### Descrizione breve (max 80 caratteri)
`Prenota un cleaner verificato vicino a te. Paga in app, niente contanti.`

### Descrizione completa (max 4000 caratteri)
Usa la stessa descrizione di Apple sopra.

### Categoria
`House & Home` (Casa e arredamento)

### Tag (massimo 5)
`Pulizie`, `Servizi`, `Casa`, `Prenotazione`, `Professionisti`

### Data Safety (Play Console)
- Identità: nome, email, indirizzo, telefono, doc. identità (cleaner) — raccolti, condivisi con Stripe per pagamenti e verifica
- Posizione: precise location — raccolta per matching
- Foto e video: foto profilo + foto lavoro — caricate dall'utente
- Identificatori app: device push token — raccolto per notifiche
- Acquisti in-app: gestione tramite Stripe (non memorizziamo carte)
- Diagnostica: crash + performance tramite Sentry (anonimizzati)
- Crittografia in transito: TLS su tutte le chiamate
- Possibilità di richiedere cancellazione: sì, da Impostazioni → Account → Elimina

### Contenuto pubblicitario
No (l'app non mostra annunci, nessun SDK pubblicitario).

### Privacy policy URL
`https://www.cleanhomeapp.com/privacy`

### Test account (Play Console review)
Stesso pattern dell'App Store. Crea un account `review-google@cleanhomeapp.com`.

---

## Asset richiesti

### Screenshots iOS (minimo set)
Dimensioni: 6.7" (1290×2796), 6.5" (1242×2688), 5.5" (1242×2208). Almeno 3 screenshot, idealmente 5.

Da catturare prima della submission:
1. Home cliente (mappa + lista cleaner)
2. Dettaglio cleaner (profilo + recensioni)
3. Flusso di prenotazione (Step prezzo)
4. Tracking realtime cleaner
5. Schermata cleaner-home (per mostrare la doppia anima dell'app)

### Screenshots Android (minimo set)
2-8 screenshots per orientamento `phone`, minimo 320px lato lungo, max 3840px. Stessi 5 sopra in formato portrait.

### Feature Graphic (Android)
1024×500, JPG o PNG no trasparenza. Mostra logo + claim "Pulizie verificate in pochi tap".

### Promo Video (opzionale, raccomandato)
30-60 secondi, screen recording dell'app + voice-over italiano. Da fare dopo la submission iniziale.

---

## Checklist pre-submit

- [ ] Apple Developer Program $99/anno acquistato
- [ ] Google Play Console $25 acquistato
- [ ] EAS profile production: `eas.json` placeholder Apple ID + ASC App ID + Team ID compilati
- [ ] Service account Play Store generato e linkato a `play-store-service-account.json`
- [ ] Build production iOS: `eas build --platform ios --profile production`
- [ ] Build production Android: `eas build --platform android --profile production`
- [ ] Screenshots presi e caricati
- [ ] Test account creati con Stripe `review_mode` flag (se applicabile) per consentire alla review di provare il flusso
- [ ] App Privacy compilata su entrambe le store
- [ ] Submission: `eas submit --platform ios --profile production` + idem per android
