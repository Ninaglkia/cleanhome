import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchBooking, submitReview } from "../../lib/api";
import { sendPushNotification } from "../../lib/notifications";
import { Booking } from "../../lib/types";
import { Colors } from "../../lib/theme";
import { useAuth } from "../../lib/auth";

const RATING_LABELS: Record<number, string> = {
  1: "Pessimo",
  2: "Scarso",
  3: "Nella media",
  4: "Buono",
  5: "Eccellente",
};

export default function ReviewScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    (async () => {
      try {
        const data = await fetchBooking(bookingId);
        if (!data) {
          Alert.alert("Errore", "Prenotazione non trovata");
          router.back();
          return;
        }
        setBooking(data);
      } catch {
        Alert.alert("Errore", "Impossibile caricare la prenotazione");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingId]);

  const handleSubmit = async () => {
    if (!user || !booking) return;
    if (rating === 0) {
      Alert.alert("Valutazione mancante", "Seleziona da 1 a 5 stelle");
      return;
    }
    // Defensive client check — RLS does its own server-side check.
    if (user.id !== booking.client_id) {
      Alert.alert(
        "Non autorizzato",
        "Solo il cliente che ha effettuato la prenotazione può lasciare una recensione."
      );
      return;
    }
    if (booking.status !== "completed" && booking.status !== "work_done") {
      Alert.alert(
        "Lavoro non completato",
        "Puoi lasciare una recensione solo dopo che il lavoro è stato completato."
      );
      return;
    }
    setSubmitting(true);
    try {
      await submitReview(
        booking.id,
        user.id,
        booking.cleaner_id,
        rating,
        comment.trim() || undefined
      );
      // Notify the cleaner of the new review
      sendPushNotification(
        booking.cleaner_id,
        "Nuova recensione ricevuta",
        `Hai ricevuto ${rating} stelle per "${booking.service_type}"`,
        { screen: "reviews", bookingId: booking.id }
      ).catch(() => {});
      Alert.alert(
        "Grazie!",
        "La tua recensione è stata inviata",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        Alert.alert("Già recensito", "Hai già lasciato una recensione per questa prenotazione");
        router.back();
      } else {
        Alert.alert("Errore", "Impossibile inviare la recensione. Riprova.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  if (!booking) return null;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" />

      {/* Nav bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: Colors.surface,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Ionicons name="close" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: Colors.text,
          }}
        >
          Lascia una recensione
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Booking summary card */}
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 18,
              padding: 18,
              marginBottom: 24,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: Colors.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              Servizio completato
            </Text>
            <Text
              style={{
                fontSize: 17,
                fontWeight: "800",
                color: Colors.text,
                marginBottom: 4,
              }}
            >
              {booking.service_type}
            </Text>
            <Text
              style={{ fontSize: 13, color: Colors.textSecondary }}
            >
              {booking.date} · {booking.time_slot}
            </Text>
          </View>

          {/* Rating */}
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: Colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            Valutazione
          </Text>
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 18,
              padding: 22,
              alignItems: "center",
              marginBottom: 24,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setRating(star)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={44}
                    color={star <= rating ? Colors.warning : Colors.textTertiary}
                  />
                </Pressable>
              ))}
            </View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: rating > 0 ? Colors.text : Colors.textTertiary,
                marginTop: 14,
                minHeight: 20,
              }}
            >
              {rating > 0 ? RATING_LABELS[rating] : "Tocca per valutare"}
            </Text>
          </View>

          {/* Comment */}
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: Colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            Commento (opzionale)
          </Text>
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 18,
              padding: 4,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Racconta la tua esperienza..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              textAlignVertical="top"
              maxLength={500}
              style={{
                minHeight: 120,
                padding: 14,
                fontSize: 15,
                color: Colors.text,
                lineHeight: 22,
              }}
            />
          </View>
          <Text
            style={{
              fontSize: 11,
              color: Colors.textTertiary,
              textAlign: "right",
              marginTop: 6,
              marginRight: 4,
            }}
          >
            {comment.length}/500
          </Text>
        </ScrollView>

        {/* Submit CTA */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 24,
            backgroundColor: Colors.background,
            borderTopWidth: 1,
            borderTopColor: Colors.borderLight,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={submitting || rating === 0}
            onPress={handleSubmit}
            style={{
              backgroundColor:
                rating === 0 || submitting
                  ? Colors.textTertiary
                  : Colors.secondary,
              borderRadius: 16,
              height: 56,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  Invia recensione
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
