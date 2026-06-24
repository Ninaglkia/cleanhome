# 🎨 CleanHome — Design Audit — README per Claude Design

## Contesto progetto

**CleanHome** è un marketplace iOS/Android di pulizie professionali in Italia (modello Deliveroo per servizi domestici).

- **Stack:** React Native + Expo Router v3 + NativeWind (Tailwind) + TypeScript
- **Backend:** Supabase (auth, db, RLS, PostGIS, storage)
- **Pagamenti:** Stripe Connect (split: 9% fee cliente + 9% fee cleaner = 18% piattaforma)
- **Lingua:** Italiano (testo UI in italiano)
- **Target:** clienti privati B2C (prenotano pulizie) + cleaner professionisti (prestano servizio)
- **Stato:** pre-lancio, in fase di rifinitura design

## Identità visiva attuale

- **Palette dominante:** verde menta/sage (`#9DD9C0` circa) + nero `#0F1A1A` + bianco
- **Tipografia:** sans-serif (probabilmente system default, Inter o SF Pro)
- **Stile:** clean, minimal, ispirazione luxury/sanctuary
- **Logo:** casetta verde scuro su sfondo menta chiaro

## Cosa serve

Audit design completo + proposta restyle per le pagine che hanno UX scadente o look generico.

### Priorità note dal proprietario

Le pagine che **NON convincono** visualmente:

1. **`app/support/index.tsx`** — Help center
   - Icona ⚙️ flottante in basso-sx si sovrappone alla card "Hai ancora bisogno di aiuto?"
   - Header "CleanHome" col logo gigante sembra debug indicator
   - Card "Hai ancora bisogno di aiuto?" centrata mentre resto è left-aligned
   - Cards generiche, mancano contrasto/ombre/dettagli premium

2. **`app/payments/index.tsx`** — Pagamenti e rimborsi
   - **I pulsanti "Chat con noi" + "Scrivi via email" non funzionano** (righe 289-318)
     - Pulsante primario scuro grande + secondario è un linkino verde minuscolo → squilibrio gerarchico
     - Icone di dimensioni diverse (18 vs 14)
     - Email come link sottolineato sembra deprecato
     - Dovrebbero essere **due CTA pari livello affiancate o stackate**, entrambe pesate uguali
   - Stessa card "Hai ancora bisogno di aiuto?" del support page → andrebbe **estratta in componente condiviso** (es. `<AssistanceFooter />`) e ridisegnata UNA volta sola

3. **Da aggiungere durante audit:** altre pagine che il proprietario indicherà successivamente

### Output desiderato

Per ogni pagina problematica:
1. **Diagnosi** — cosa non funziona (spacing, gerarchia, contrasto, info architecture)
2. **Proposta** — wireframe testuale o ASCII della versione migliorata
3. **Snippet codice NativeWind** pronto da applicare (preserva la logica esistente, cambia solo styling/struttura JSX)
4. **Token design coerenti** — se servono nuovi colori/spazi, dichiararli per `tailwind.config.js`

## Vincoli tecnici

- ✅ Mantieni NativeWind / Tailwind classes (NO StyleSheet.create)
- ✅ Mantieni Expo Router file-based routing
- ✅ Mantieni SafeAreaView dove presente
- ✅ Mantieni i nomi delle props e dei file
- ❌ Non introdurre librerie nuove senza giustificazione (no Reanimated v4 se v3 basta, no Skia se non strettamente necessario)
- ❌ Non riscrivere la business logic — solo presentation layer

## Cosa NON modificare

- Stripe Connect flow (`/payments`)
- Logica RLS / Supabase queries
- Tracking realtime (`lib/realtime-tracking.ts`)
- Pricing computation (`lib/pricing.ts` — €1.30/mq, min €50, +9%/-9%)

## File allegati

- `DESIGN-AUDIT-PACK.md` — Tutto il codice rilevante (1.2 MB, 42k righe). Se troppo grosso per la tua chat usa i chunk:
  - `DESIGN-PACK-1-CONFIG.md` — Theme + Tailwind + layout root
  - `DESIGN-PACK-2-AUTH-ONBOARDING.md` — Auth + onboarding
  - `DESIGN-PACK-3-TABS.md` — Home, profile, bookings, messages
  - `DESIGN-PACK-4-BOOKING.md` — Booking flow
  - `DESIGN-PACK-5-LISTINGS-CLEANER.md` — Discover/search
  - `DESIGN-PACK-6-PROPERTIES-DOCS-SUPPORT.md` — Properties, docs, support, legal
  - `DESIGN-PACK-7-COMPONENTS.md` — Componenti riusabili
