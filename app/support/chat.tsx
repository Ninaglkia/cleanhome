import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Shadows, Spacing } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageSender = "concierge" | "user";

interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: string;
}

// ─── Mock conversation ────────────────────────────────────────────────────────

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    sender: "concierge",
    text: "Benvenuto nel supporto live CleanHome. Sono Elena, il tuo concierge digitale dedicato. Come posso aiutarti oggi?",
    timestamp: "14:32",
  },
  {
    id: "2",
    sender: "user",
    text: "Ciao! Vorrei sapere se è possibile modificare la data della mia prenotazione.",
    timestamp: "14:33",
  },
  {
    id: "3",
    sender: "concierge",
    text: "Certo, posso aiutarti con questo! Per modificare la data devi accedere alla sezione Prenotazioni e selezionare quella da modificare. Ti serve che invii un link diretto?",
    timestamp: "14:33",
  },
];

const QUICK_REPLIES = [
  "Sì, inviami il link",
  "Qual è la commissione extra?",
  "Ho un'altra domanda",
];

// ─── Constants ────────────────────────────────────────────────────────────────

const BUBBLE_MAX_WIDTH = "78%";

// ─── Bubble component ─────────────────────────────────────────────────────────

interface BubbleProps {
  message: ChatMessage;
}

function Bubble({ message }: BubbleProps) {
  const isUser = message.sender === "user";

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {/* Concierge avatar */}
      {!isUser && (
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarInitial}>E</Text>
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleConcierge]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {message.text}
        </Text>
        <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
          {message.timestamp}
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SupportChatScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isSending) return;

    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    const newMessage: ChatMessage = {
      id: String(Date.now()),
      sender: "user",
      text,
      timestamp,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
    setIsSending(true);

    // Simulated concierge reply after 1.2s
    setTimeout(() => {
      const reply: ChatMessage = {
        id: String(Date.now() + 1),
        sender: "concierge",
        text: "Grazie per il tuo messaggio! Un momento mentre verifico le informazioni per te.",
        timestamp: `${now.getHours().toString().padStart(2, "0")}:${(now.getMinutes() + 1).toString().padStart(2, "0")}`,
      };
      setMessages((prev) => [...prev, reply]);
      setIsSending(false);
    }, 1200);
  }, [inputText, isSending]);

  const handleQuickReply = useCallback((text: string) => {
    setInputText(text);
  }, []);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <Bubble message={item} />,
    []
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerBackBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.textOnDark} />
        </Pressable>

        <View style={styles.headerCenter}>
          {/* Online indicator + name */}
          <View style={styles.headerOnlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerName}>Elena</Text>
          </View>
          <Text style={styles.headerSubtitle}>SERVIZIO CONCIERGE</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.headerIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="call-outline" size={19} color={Colors.textOnDark} />
          </Pressable>
          <Pressable style={styles.headerIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-vertical" size={19} color={Colors.textOnDark} />
          </Pressable>
        </View>
      </View>

      {/* ── Chat area ── */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          removeClippedSubviews
          maxToRenderPerBatch={20}
        />

        {/* ── Quick replies ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRepliesContent}
          style={styles.quickRepliesRow}
        >
          {QUICK_REPLIES.map((reply) => (
            <Pressable
              key={reply}
              style={({ pressed }) => [styles.quickChip, pressed && styles.quickChipPressed]}
              onPress={() => handleQuickReply(reply)}
            >
              <Text style={styles.quickChipText}>{reply}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Input bar ── */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor={Colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            returnKeyType="default"
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              (!inputText.trim() || isSending) && styles.sendBtnDisabled,
              pressed && styles.sendBtnPressed,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            <Ionicons
              name="send"
              size={18}
              color={inputText.trim() ? Colors.textOnDark : Colors.textTertiary}
            />
          </Pressable>
        </View>

        {/* ── Secure footer ── */}
        <View style={styles.secureFooter}>
          <Ionicons name="lock-closed" size={10} color={Colors.textTertiary} />
          <Text style={styles.secureText}>
            CONVERSAZIONE SICURA E PRIVATA · CLEANHOME PREMIUM
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  headerOnlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textOnDark,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: Colors.textOnDarkSecondary,
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Chat area
  chatArea: {
    flex: 1,
  },
  messagesList: {
    padding: Spacing.base,
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  // Bubbles
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  bubbleRowUser: {
    flexDirection: "row-reverse",
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textOnDark,
  },
  bubble: {
    maxWidth: BUBBLE_MAX_WIDTH,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: 4,
  },
  bubbleConcierge: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    ...Shadows.sm,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: Colors.textOnDark,
  },
  bubbleTime: {
    fontSize: 10,
    color: Colors.textTertiary,
    alignSelf: "flex-end",
  },
  bubbleTimeUser: {
    color: "rgba(255,255,255,0.55)",
  },

  // Quick replies
  quickRepliesRow: {
    maxHeight: 44,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  quickRepliesContent: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    alignItems: "center",
  },
  quickChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  quickChipPressed: {
    opacity: 0.75,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.secondary,
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === "ios" ? Spacing.xs : Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.surfaceElevated,
  },
  sendBtnPressed: {
    opacity: 0.8,
  },

  // Secure footer
  secureFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  secureText: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: Colors.textTertiary,
  },
});
