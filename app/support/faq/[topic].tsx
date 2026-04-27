import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Colors, Radius, Shadows, Spacing } from "../../../lib/theme";

// ─── FAQ data ─────────────────────────────────────────────────────────────────

interface FaqItem {
  q: string;
  a: string;
}

interface TopicData {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  items: FaqItem[];
}

const FAQ_DATA: Record<string, TopicData> = {
  booking: {
    label: "Prenotazioni & Programmazione",
    icon: "calendar-outline",
    items: [
      {
        q: "Come cancello una prenotazione?",
        a: "Vai in \"Le mie prenotazioni\", apri quella che vuoi cancellare e tocca \"Cancella prenotazione\". Puoi cancellare gratuitamente fino a 24 ore prima. Dopo tale termine si applica la policy di rimborso parziale.",
      },
      {
        q: "Posso riprogrammare una prenotazione?",
        a: "Sì, puoi modificare la data e l'orario fino a 12 ore prima dell'appuntamento. Apri la prenotazione e tocca \"Modifica orario\".",
      },
      {
        q: "Il cleaner non si è presentato. Cosa faccio?",
        a: "Se il cleaner non arriva entro 15 minuti dall'orario concordato, apri la prenotazione e tocca \"Segnala problema\". Verrai rimborsato completamente e potrai scegliere un altro professionista.",
      },
      {
        q: "Posso prenotare lo stesso cleaner ogni settimana?",
        a: "Assolutamente sì. Nella schermata di prenotazione scegli \"Prenotazione ricorrente\" e imposta la frequenza che preferisci (settimanale, bisettimanale, mensile).",
      },
      {
        q: "Come funziona la valutazione post-pulizia?",
        a: "Al termine del servizio riceverai una notifica per lasciare una recensione. Hai 7 giorni per farlo. Le recensioni sono pubbliche e aiutano gli altri utenti a scegliere il professionista giusto.",
      },
    ],
  },
  payments: {
    label: "Pagamenti & Rimborsi",
    icon: "card-outline",
    items: [
      {
        q: "Quali metodi di pagamento sono accettati?",
        a: "Accettiamo tutte le principali carte di credito e debito (Visa, Mastercard, American Express) tramite Stripe. I pagamenti sono sicuri e criptati.",
      },
      {
        q: "Quando mi viene addebitato il pagamento?",
        a: "Il pagamento viene pre-autorizzato al momento della prenotazione, ma l'addebito avviene solo quando il cleaner accetta il lavoro. Se rifiuta, l'importo viene sbloccato entro 3-5 giorni lavorativi.",
      },
      {
        q: "Come funziona il rimborso in caso di cancellazione?",
        a: "Cancellazione con oltre 24h di anticipo: rimborso completo. Tra 12 e 24h: rimborso 50%. Meno di 12h: nessun rimborso. In caso di problemi gravi con il servizio, contattaci entro 24h dalla pulizia.",
      },
      {
        q: "Dove trovo le mie fatture?",
        a: "Tutte le fatture sono disponibili in Profilo → Pagamenti → Fatture. Puoi scaricarle in PDF per uso fiscale.",
      },
      {
        q: "C'è una commissione di servizio?",
        a: "Sì, applichiamo una commissione del 9% sul totale della prenotazione a copertura dei costi di piattaforma, assicurazione e supporto clienti.",
      },
    ],
  },
  account: {
    label: "Impostazioni Account",
    icon: "person-circle-outline",
    items: [
      {
        q: "Come cambio la mia email?",
        a: "Vai in Profilo → Modifica profilo → Email. Riceverai una email di conferma al nuovo indirizzo. La modifica sarà effettiva dopo la conferma.",
      },
      {
        q: "Come cambio la password?",
        a: "Vai in Profilo → Sicurezza → Cambia password. Per sicurezza, ti chiediamo di inserire prima la password attuale.",
      },
      {
        q: "Come elimino il mio account?",
        a: "Vai in Profilo → Account → Elimina account. Attenzione: questa azione è irreversibile e cancellerà tutte le tue prenotazioni, messaggi e dati personali nel rispetto del GDPR.",
      },
      {
        q: "Come gestisco le notifiche push?",
        a: "Vai in Profilo → Notifiche per scegliere quali notifiche ricevere. Puoi gestire le notifiche anche dalle impostazioni del tuo dispositivo.",
      },
      {
        q: "Posso avere sia un account cliente che cleaner?",
        a: "Sì! Con un unico account puoi passare da cliente a professionista e viceversa. Tocca l'icona del profilo e scegli \"Cambia ruolo\" dal menu.",
      },
    ],
  },
  trust: {
    label: "Fiducia & Sicurezza",
    icon: "shield-checkmark-outline",
    items: [
      {
        q: "Come vengono verificati i cleaner?",
        a: "Ogni professionista deve caricare un documento d'identità valido e completare la verifica Stripe per ricevere i pagamenti. Controlliamo le recensioni e monitoriamo costantemente la qualità del servizio.",
      },
      {
        q: "Cosa succede se qualcosa viene danneggiato?",
        a: "CleanHome offre una protezione base per danni accidentali. Apri la prenotazione entro 24 ore dalla pulizia e tocca \"Segnala danno\". Il nostro team gestirà la pratica e ti contatterà.",
      },
      {
        q: "Come segnalo un cleaner?",
        a: "Apri la prenotazione o il profilo del cleaner e tocca il menu (⋮) poi \"Segnala\". Descrivi il problema nel dettaglio. Ogni segnalazione viene esaminata entro 48 ore.",
      },
      {
        q: "I miei dati sono al sicuro?",
        a: "Sì. Non condividiamo mai il tuo indirizzo o numero di telefono con i cleaner prima della conferma della prenotazione. Tutti i dati sono criptati e conservati in conformità al GDPR.",
      },
      {
        q: "Come funziona la garanzia soddisfatti o rimborsati?",
        a: "Se non sei soddisfatto del servizio, segnalacelo entro 24 ore dalla pulizia con foto e descrizione. Valuteremo il caso e, se confermato, riceverai un rimborso o una pulizia gratuita.",
      },
    ],
  },
};

// ─── FAQ item ──────────────────────────────────────────────────────────────────

interface FaqRowProps {
  item: FaqItem;
  index: number;
}

function FaqRow({ item, index }: FaqRowProps) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((p) => !p), []);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(22)}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.faqRow,
          expanded && styles.faqRowExpanded,
          pressed && { opacity: 0.85 },
        ]}
        accessibilityLabel={item.q}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.faqQuestion}>
          <Text style={styles.faqQuestionText}>{item.q}</Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={Colors.textSecondary}
          />
        </View>
        {expanded && (
          <Text style={styles.faqAnswer}>{item.a}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FaqTopicScreen() {
  const router = useRouter();
  const { topic } = useLocalSearchParams<{ topic: string }>();

  const topicData = topic ? FAQ_DATA[topic] : null;

  if (!topicData) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.notFound}>
          <Ionicons name="search-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.notFoundTitle}>Argomento non trovato</Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.backLinkBtn}
            accessibilityLabel="Torna al supporto"
            accessibilityRole="button"
          >
            <Text style={styles.backLinkText}>Torna al supporto</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {topicData.label}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Hero block ── */}
        <View style={styles.heroBlock}>
          <View style={styles.heroIconWrap}>
            <Ionicons name={topicData.icon} size={28} color={Colors.secondary} />
          </View>
          <Text style={styles.heroLabel}>FAQ</Text>
          <Text style={styles.heroTitle}>{topicData.label}</Text>
          <Text style={styles.heroSub}>
            {topicData.items.length} domande frequenti su questo argomento
          </Text>
        </View>

        {/* ── FAQ list ── */}
        <View style={styles.faqList}>
          {topicData.items.map((item, idx) => (
            <FaqRow key={item.q} item={item} index={idx} />
          ))}
        </View>

        {/* ── Still need help ── */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Non hai trovato risposta?</Text>
          <Text style={styles.helpSub}>
            Il nostro team è disponibile via email.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.helpBtn, pressed && { opacity: 0.88 }]}
            onPress={() => Linking.openURL("mailto:support@cleanhome.app")}
            accessibilityLabel="Invia email al supporto"
            accessibilityRole="button"
          >
            <Ionicons name="mail-outline" size={16} color="#fff" />
            <Text style={styles.helpBtnText}>Scrivi a support@cleanhome.app</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
    flex: 1,
    textAlign: "center",
    marginHorizontal: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.xl,
  },
  heroBlock: {
    alignItems: "center",
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.5,
    color: Colors.secondary,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  faqList: {
    gap: Spacing.sm,
  },
  faqRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  faqRowExpanded: {
    borderColor: Colors.secondary,
    gap: Spacing.md,
  },
  faqQuestion: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    justifyContent: "space-between",
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 22,
  },
  faqAnswer: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  helpCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  helpSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 20,
  },
  helpBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    alignSelf: "flex-start",
  },
  helpBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.base,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  backLinkBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
