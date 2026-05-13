import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchSupportHistory,
  sendSupportMessage,
  SupportMessage,
} from "../../lib/api";
import { Colors, Radius, Shadows, Spacing } from "../../lib/theme";

const QUICK_REPLIES = [
  "Quando viene addebitato il pagamento?",
  "Come funziona il rimborso?",
  "Come segnalo un problema con il servizio?",
  "Cosa succede se nessun cleaner accetta?",
];

export default function SupportChatScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<SupportMessage>>(null);

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Initial history load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { chatId: id, messages: msgs } = await fetchSupportHistory();
        if (cancelled) return;
        setChatId(id);
        if (msgs.length === 0) {
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content:
                "Ciao! Sono l'assistente virtuale di CleanHome. Posso aiutarti con prenotazioni, pagamenti, rimborsi, contestazioni e altro. Come posso aiutarti?",
              created_at: new Date().toISOString(),
            },
          ]);
        } else {
          setMessages(msgs);
        }
      } catch (err: any) {
        Alert.alert("Errore", err?.message ?? "Impossibile caricare la chat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || sending) return;
      setText("");
      setSending(true);

      // Optimistic user message
      const optimisticUser: SupportMessage = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);

      try {
        const { chatId: id, reply } = await sendSupportMessage({
          content: trimmed,
          chatId: chatId ?? undefined,
        });
        if (!chatId) setChatId(id);
        const assistantMsg: SupportMessage = {
          id: `tmp-a-${Date.now()}`,
          role: "assistant",
          content: reply,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "system",
            content:
              "Ho avuto un problema tecnico. Riprova oppure tocca \"Parla con un operatore\".",
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [chatId, sending]
  );

  const renderItem = useCallback(({ item }: { item: SupportMessage }) => {
    if (item.role === "system") {
      return (
        <View style={styles.systemRow}>
          <Ionicons name="information-circle" size={14} color={Colors.textSecondary} />
          <Text style={styles.systemText}>{item.content}</Text>
        </View>
      );
    }
    const isUser = item.role === "user";
    return (
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
        {!isUser && (
          <View style={styles.avatarBot}>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
          ]}
        >
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <View style={styles.aiDot} />
              <Text style={styles.headerTitle}>Assistente CleanHome</Text>
            </View>
            <Text style={styles.headerSub}>AI disponibile 24/7</Text>
          </View>
          <View style={{ width: 26 }} />
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {sending && (
          <View style={styles.typingRow}>
            <View style={styles.avatarBot}>
              <Ionicons name="sparkles" size={14} color="#fff" />
            </View>
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            </View>
          </View>
        )}

        {/* ── Quick replies (only when chat is empty/short) ── */}
        {messages.length <= 1 && !sending && (
          <View style={styles.quickReplies}>
            {QUICK_REPLIES.map((q) => (
              <Pressable
                key={q}
                style={styles.quickReplyChip}
                onPress={() => send(q)}
                disabled={sending}
              >
                <Text style={styles.quickReplyText}>{q}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Input ── */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor={Colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
            editable={!sending}
          />
          <Pressable
            style={[
              styles.sendBtn,
              (!text.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={() => send(text)}
            disabled={!text.trim() || sending}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerCenter: { flex: 1 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  headerTitle: { fontSize: 16, fontWeight: "600", color: Colors.text },
  headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  humanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  humanBtnDone: { backgroundColor: Colors.successLight, borderColor: Colors.success },
  humanBtnText: { fontSize: 12, color: Colors.secondary, fontWeight: "600" },

  listContent: { padding: Spacing.lg, gap: Spacing.sm },
  bubbleRow: { flexDirection: "row", marginVertical: 4, gap: 6 },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowAssistant: { justifyContent: "flex-start" },
  avatarBot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.lg,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    ...Shadows.sm,
  },
  bubbleText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 21,
  },
  bubbleTextUser: { color: "#fff" },
  systemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.sm,
    marginVertical: 6,
  },
  systemText: {
    flex: 1,
    fontSize: 13,
    color: Colors.warning,
    lineHeight: 18,
    fontStyle: "italic",
  },
  typingRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingBottom: 8,
    gap: 6,
  },
  quickReplies: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
  },
  quickReplyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickReplyText: { fontSize: 13, color: Colors.text },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: Platform.OS === "ios" ? 24 : Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: Colors.textTertiary, opacity: 0.5 },
});
