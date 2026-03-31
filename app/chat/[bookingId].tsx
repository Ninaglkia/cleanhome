import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { fetchMessages, sendMessage, subscribeToMessages } from "../../lib/api";
import { Message } from "../../lib/types";
import { Colors, Spacing, Radius, Shadows } from "../../lib/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_REPLIES = [
  "Sì, perfetto grazie",
  "Posso cambiare l'orario?",
  "Ho una domanda",
  "Arrivo tra poco",
  "Confermo la prenotazione",
] as const;

// ─── Time grouping helper ─────────────────────────────────────────────────────

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateGroup(isoString: string): string {
  const d = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  if (sameDay(d, today)) return "Oggi";
  if (sameDay(d, yesterday)) return "Ieri";
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}

// ─── Message bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  item: Message;
  isMe: boolean;
  showAvatar: boolean;
}

const MessageBubble = ({ item, isMe, showAvatar }: BubbleProps) => {
  const time = formatTime(item.created_at);

  if (isMe) {
    return (
      <View style={bStyles.rowRight}>
        <View style={bStyles.bubbleMe}>
          <Text style={bStyles.bubbleMeText}>{item.content}</Text>
          <Text style={bStyles.bubbleTimeMe}>{time}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={bStyles.rowLeft}>
      {showAvatar ? (
        <View style={bStyles.avatarConcierge}>
          <Ionicons name="headset" size={16} color={Colors.textOnDark} />
        </View>
      ) : (
        <View style={bStyles.avatarSpacer} />
      )}
      <View style={bStyles.bubbleOtherWrap}>
        <View style={bStyles.bubbleOther}>
          <Text style={bStyles.bubbleOtherText}>{item.content}</Text>
          <Text style={bStyles.bubbleTimeOther}>{time}</Text>
        </View>
      </View>
    </View>
  );
};

const bStyles = StyleSheet.create({
  rowRight: {
    alignSelf: "flex-end",
    maxWidth: "78%",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    alignSelf: "flex-start",
    maxWidth: "82%",
  },
  avatarConcierge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarSpacer: {
    width: 32,
    flexShrink: 0,
  },
  bubbleMe: {
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    ...Shadows.sm,
  },
  bubbleMeText: {
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.93)",
    marginBottom: 4,
  },
  bubbleTimeMe: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    alignSelf: "flex-end",
  },
  bubbleOtherWrap: {
    flex: 1,
  },
  bubbleOther: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 18,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  bubbleOtherText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
    marginBottom: 4,
  },
  bubbleTimeOther: {
    fontSize: 10,
    color: Colors.textTertiary,
    alignSelf: "flex-end",
  },
});

// ─── List item (bubble + optional date separator) ─────────────────────────────

interface ListItemData {
  type: "message";
  message: Message;
  isMe: boolean;
  showAvatar: boolean;
  showDateSeparator: boolean;
  dateLabel: string;
}

const ChatListItem = ({ data }: { data: ListItemData }) => (
  <View>
    {data.showDateSeparator && (
      <View style={styles.dateSeparator}>
        <View style={styles.dateSeparatorLine} />
        <Text style={styles.dateSeparatorText}>{data.dateLabel}</Text>
        <View style={styles.dateSeparatorLine} />
      </View>
    )}
    <MessageBubble
      item={data.message}
      isMe={data.isMe}
      showAvatar={data.showAvatar}
    />
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<ListItemData>>(null);

  // Load messages + subscribe to real-time updates
  useEffect(() => {
    if (!bookingId) return;
    let mounted = true;

    (async () => {
      try {
        const data = await fetchMessages(bookingId);
        if (mounted) setMessages(data);
      } catch {
        if (mounted) setMessages([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const channel = subscribeToMessages(bookingId, (newMsg) => {
      if (!mounted) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });

    return () => {
      mounted = false;
      channel.unsubscribe();
    };
  }, [bookingId]);

  // Scroll to end on new messages
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        80
      );
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [messages.length]);

  // Build list items with date separators + avatar grouping
  const listItems = useMemo<ListItemData[]>(() => {
    return messages.map((msg, idx) => {
      const isMe = msg.sender_id === user?.id;
      const prev = messages[idx - 1];

      // Show date separator when day changes
      const currentDay = formatDateGroup(msg.created_at);
      const prevDay = prev ? formatDateGroup(prev.created_at) : null;
      const showDateSeparator = currentDay !== prevDay;

      // Show avatar for consecutive messages from same sender (only on first in group)
      const nextMsg = messages[idx + 1];
      const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id;
      const showAvatar = !isMe && isLastInGroup;

      return {
        type: "message",
        message: msg,
        isMe,
        showAvatar,
        showDateSeparator,
        dateLabel: currentDay,
      };
    });
  }, [messages, user?.id]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !user || !bookingId) return;
    const content = text.trim();
    setText("");
    setSending(true);
    try {
      await sendMessage(bookingId, user.id, content);
    } catch {
      setText(content);
    } finally {
      setSending(false);
    }
  }, [text, user, bookingId]);

  const handleQuickReply = useCallback((reply: string) => {
    setText(reply);
  }, []);

  const keyExtractor = useCallback(
    (item: ListItemData) => item.message.id,
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItemData }) => <ChatListItem data={item} />,
    []
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>

        {/* Cleaner avatar + name */}
        <View style={styles.headerAvatar}>
          <Ionicons name="person" size={16} color={Colors.textOnDark} />
          <View style={styles.headerOnlineDot} />
        </View>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Concierge CleanHome</Text>
          <View style={styles.headerSubRow}>
            <View style={styles.onlineDotSmall} />
            <Text style={styles.headerSubtitle}>SERVIZIO CONCIERGE · Disponibile</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="call-outline" size={20} color={Colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* ── Content ── */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.secondary} />
          </View>
        ) : listItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={36} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Nessun messaggio</Text>
            <Text style={styles.emptySubtitle}>
              Inizia la conversazione con il nostro team di supporto dedicato.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={listItems}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            removeClippedSubviews
            maxToRenderPerBatch={20}
            windowSize={10}
          />
        )}

        {/* ── Input area ── */}
        <View style={styles.inputArea}>
          {/* Quick reply chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRepliesContent}
            style={styles.quickRepliesScroll}
          >
            {QUICK_REPLIES.map((reply) => (
              <Pressable
                key={reply}
                onPress={() => handleQuickReply(reply)}
                style={({ pressed }) => [
                  styles.quickChip,
                  pressed && { backgroundColor: Colors.accentLight },
                ]}
              >
                <Text style={styles.quickChipText}>{reply}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Input row */}
          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.textInput}
                placeholder="Scrivi un messaggio…"
                placeholderTextColor={Colors.textTertiary}
                value={text}
                onChangeText={setText}
                multiline
                returnKeyType="default"
              />
            </View>

            <Pressable
              onPress={handleSend}
              disabled={!text.trim() || sending}
              style={({ pressed }) => [
                styles.sendBtn,
                !text.trim() && styles.sendBtnDisabled,
                pressed && text.trim() && { opacity: 0.85 },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={Colors.textOnDark} />
              ) : (
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={text.trim() ? Colors.textOnDark : Colors.textTertiary}
                />
              )}
            </Pressable>
          </View>

          {/* Trust footer */}
          <View style={styles.trustRow}>
            <Ionicons name="lock-closed" size={10} color={Colors.textTertiary} />
            <Text style={styles.trustText}>SICURO E PRIVATO · CLEANHOME</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    position: "relative",
  },
  headerOnlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  headerTitleGroup: {
    flex: 1,
    gap: 3,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.2,
  },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  onlineDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.secondary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.base,
    gap: Spacing.sm,
  },

  // Date separator
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginVertical: Spacing.base,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },

  // Input area
  inputArea: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === "ios" ? 24 : Spacing.base,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    ...Shadows.sm,
  },
  quickRepliesScroll: {
    flexGrow: 0,
  },
  quickRepliesContent: {
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  quickChip: {
    paddingHorizontal: Spacing.base,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.lg,
    paddingLeft: Spacing.base,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  inputWrap: {
    flex: 1,
    maxHeight: 110,
    paddingVertical: 4,
  },
  textInput: {
    fontSize: 15,
    color: Colors.text,
    padding: 0,
    lineHeight: 21,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...Shadows.sm,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.backgroundAlt,
    shadowOpacity: 0,
    elevation: 0,
  },

  // Trust footer
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  trustText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
