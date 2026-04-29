# Politica di Cancellazione e Rimborso — CleanHome

**Ultimo aggiornamento:** 29 aprile 2026
**Versione:** 1.0

---

Questa policy disciplina cancellazioni e rimborsi per booking effettuati tramite CleanHome. Va letta insieme a [Termini di Servizio](./terms.md) e [Privacy Policy](./privacy.md).

## 1. Principi generali

CleanHome agisce come **piattaforma di intermediazione**. I rimborsi sono erogati tramite **Stripe** sullo stesso strumento di pagamento usato per il booking. Tempi tecnici di accredito: **5–10 giorni lavorativi** (dipende dalla banca emittente).

## 2. Cancellazione da parte del cliente

| Tempo prima dell'orario booking | Rimborso al cliente |
|---|---|
| **> 24 ore prima** | 100% (servizio + commissione cliente) |
| **24h – 2h prima** | 50% del prezzo servizio + commissione cliente intera |
| **< 2h prima** | 0% (no rimborso) |
| **No-show del cliente** | 0% (no rimborso) |

### 2.1 Casi di forza maggiore
In caso di emergenze documentabili (malattia con certificato medico, lutto familiare, calamità naturali) il cliente può richiedere rimborso integrale a **[NINO: COMPILARE — support@cleanhome.it]** entro 7 giorni. CleanHome valuta caso per caso.

## 3. Cancellazione da parte del cleaner

Se il cleaner cancella un booking confermato:
- **Rimborso integrale al cliente** (100% servizio + commissione)
- Il cliente riceve notifica push e può ribookare un altro cleaner
- Il cleaner subisce penalità sul rating; cancellazioni ripetute → sospensione account

## 4. Booking non eseguito (no-show del cleaner)

Se il cleaner non si presenta:
- **Rimborso integrale al cliente** (100% servizio + commissione)
- Compensazione al cliente: voucher €10 sul prossimo booking (a discrezione di CleanHome)
- Il cleaner subisce penalità severa sul rating

Il cliente segnala il no-show dall'app: Booking → "Il cleaner non si è presentato".

## 5. Servizio non conforme (contestazione qualità)

CleanHome adotta un modello **hold-until-confirm** che protegge il cliente da servizi non conformi prima che il pagamento raggiunga il cleaner.

### 5.1 Finestra di 48 ore

Dopo che il cleaner segna il lavoro come completato (`work_done_at`), il cliente ha **48 ore** per agire:

| Azione del cliente | Effetto |
|---|---|
| **Confermare il servizio** | Pagamento rilasciato immediatamente al cleaner |
| **Aprire contestazione** motivata | Fondi congelati, CleanHome esamina il caso |
| **Nessuna azione entro 48h** | Auto-conferma silente, pagamento rilasciato al cleaner |

### 5.2 Come aprire una contestazione

Dall'app: Booking → "Segnala un problema". Il cliente deve fornire:
- Motivazione testuale (almeno 50 caratteri)
- **Foto** del servizio non conforme (consigliato anche prima/dopo se disponibili)
- Eventuali messaggi della chat con il cleaner

### 5.3 Esiti possibili della contestazione

CleanHome esamina la contestazione entro **5 giorni lavorativi** sulla base delle prove fornite e di eventuali repliche del cleaner:

| Esito | Rimborso cliente | Payout cleaner |
|---|---|---|
| **Servizio conforme** | Nessuno | 100% (€54,60 su €60 base) |
| **Parzialmente conforme** | Parziale (importo a discrezione di CleanHome) | Parziale |
| **Non eseguito o gravemente non conforme** | 100% (servizio + commissione) | Nessuno |

### 5.4 Onere della prova

In caso di contestazione, l'onere della prova è ripartito:
- **Cliente:** deve dimostrare la non conformità (foto, descrizione)
- **Cleaner:** può replicare con foto del lavoro eseguito e/o messaggi chat

CleanHome decide sulla base del materiale fornito. La decisione di CleanHome è **vincolante in via stragiudiziale**, fermo restando il diritto delle parti di adire l'autorità giudiziaria.

## 6. Frodi e chargeback

### 6.1 Chargeback ingiustificati
In caso di chargeback aperto dal cliente sulla propria carta senza prima aver tentato risoluzione tramite CleanHome, l'account può essere sospeso e CleanHome può contestare il chargeback presso Stripe fornendo le prove di erogazione del servizio.

### 6.2 Frode del cleaner
Se emerge che il cleaner non ha realmente erogato il servizio o ha caricato foto false, CleanHome:
- Rimborsa integralmente il cliente
- Banna il cleaner dalla piattaforma
- Trattiene gli importi dal saldo Stripe Connect del cleaner
- In casi gravi denuncia all'autorità competente

## 7. Abbonamento listings cleaner (€4,99/mese)

### 7.1 Cancellazione
Il cleaner può cancellare l'abbonamento dall'app: Listings → Gestisci abbonamento.

### 7.2 Rimborso
- L'abbonamento mensile **non è rimborsabile pro-rata**: il listing rimane attivo fino alla fine del periodo già pagato, poi viene archiviato
- Eccezioni per malfunzionamenti tecnici della piattaforma valutate caso per caso

### 7.3 Diritto di recesso 14gg (consumatori)
Se il cleaner sottoscrive l'abbonamento come consumatore (caso raro essendo richiesta P.IVA), può recedere entro 14 giorni dalla sottoscrizione tramite email a [NINO: COMPILARE — support@cleanhome.it], a meno che non abbia già pubblicato listings durante quel periodo (esecuzione del servizio digitale con consenso espresso).

## 8. Tempistiche dei rimborsi

| Operazione | Tempo |
|---|---|
| Rimborso processato da CleanHome (post approvazione) | Entro **3 giorni lavorativi** |
| Tempo Stripe per accredito carta | **5–10 giorni lavorativi** |
| Tempo totale percepito dal cliente | Tipicamente **7–14 giorni** |

## 9. Come richiedere un rimborso

1. **Dall'app:** Booking specifico → "Richiedi rimborso" (motivare)
2. **Via email:** [NINO: COMPILARE — refund@cleanhome.it]
3. **Documenti utili:** screenshot, foto, eventuali comunicazioni con il cleaner

CleanHome risponde entro **5 giorni lavorativi**.

## 10. Controversie irrisolte

In caso di mancato accordo:

- **Conciliazione:** consigliata tramite organismi di mediazione accreditati
- **ODR Commissione UE:** https://ec.europa.eu/consumers/odr/
- **Foro competente:** secondo §16 dei [Termini](./terms.md)

## 11. Contatti

- **Customer support:** [NINO: COMPILARE — support@cleanhome.it]
- **Rimborsi:** [NINO: COMPILARE — refund@cleanhome.it]
