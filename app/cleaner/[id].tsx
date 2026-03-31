import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchCleaner } from "../../lib/api";
import { CleanerProfile } from "../../lib/types";
import { Colors } from "../../lib/theme";

export default function CleanerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cleaner, setCleaner] = useState<CleanerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await fetchCleaner(id);
        setCleaner(data);
      } catch {
        Alert.alert("Errore", "Professionista non trovato");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View
        style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}
      >
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  if (!cleaner) return null;

  const initials = cleaner.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
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
          Profilo
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* Hero section */}
        <View
          style={{
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 28,
          }}
        >
          {/* Avatar */}
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 30,
              backgroundColor: Colors.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <Text
              style={{ color: Colors.accent, fontSize: 32, fontWeight: "800" }}
            >
              {initials}
            </Text>
          </View>

          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: Colors.text,
              letterSpacing: -0.5,
              marginBottom: 8,
            }}
          >
            {cleaner.full_name}
          </Text>

          {/* Rating */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Ionicons name="star" size={16} color={Colors.warning} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: Colors.text,
                marginLeft: 5,
              }}
            >
              {cleaner.avg_rating.toFixed(1)}
            </Text>
            <Text
              style={{ fontSize: 13, color: Colors.textSecondary, marginLeft: 5 }}
            >
              ({cleaner.review_count} recensioni)
            </Text>
          </View>

          {/* Location */}
          {cleaner.city && (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
              <Text
                style={{
                  fontSize: 13,
                  color: Colors.textSecondary,
                  marginLeft: 4,
                }}
              >
                {cleaner.city}
              </Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 20,
            gap: 12,
            marginBottom: 28,
          }}
        >
          {/* Rate */}
          {cleaner.hourly_rate && (
            <View
              style={{
                flex: 1,
                backgroundColor: Colors.surface,
                borderRadius: 18,
                padding: 16,
                alignItems: "center",
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: Colors.secondary,
                  letterSpacing: -0.5,
                }}
              >
                €{cleaner.hourly_rate}
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textTertiary, marginTop: 3 }}>
                all'ora
              </Text>
            </View>
          )}

          {/* Type */}
          <View
            style={{
              flex: 1,
              backgroundColor: Colors.surface,
              borderRadius: 18,
              padding: 16,
              alignItems: "center",
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Ionicons
              name={cleaner.cleaner_type === "azienda" ? "business-outline" : "person-outline"}
              size={22}
              color={Colors.textSecondary}
            />
            <Text
              style={{
                fontSize: 12,
                color: Colors.textTertiary,
                marginTop: 4,
                textTransform: "capitalize",
              }}
            >
              {cleaner.cleaner_type}
            </Text>
          </View>

          {/* Availability */}
          <View
            style={{
              flex: 1,
              backgroundColor: cleaner.is_available ? Colors.successLight : Colors.errorLight,
              borderRadius: 18,
              padding: 16,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: cleaner.is_available ? Colors.success : Colors.error,
                marginBottom: 6,
              }}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: cleaner.is_available ? Colors.success : Colors.error,
                textAlign: "center",
                lineHeight: 16,
              }}
            >
              {cleaner.is_available ? "Disponibile" : "Non disponibile"}
            </Text>
          </View>
        </View>

        {/* Bio */}
        {cleaner.bio && (
          <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
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
              Chi sono
            </Text>
            <View
              style={{
                backgroundColor: Colors.surface,
                borderRadius: 18,
                padding: 18,
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: Colors.textSecondary,
                  lineHeight: 22,
                }}
              >
                {cleaner.bio}
              </Text>
            </View>
          </View>
        )}

        {/* Services */}
        {cleaner.services && cleaner.services.length > 0 && (
          <View style={{ paddingHorizontal: 20 }}>
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
              Servizi offerti
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {cleaner.services.map((s) => (
                <View
                  key={s}
                  style={{
                    backgroundColor: Colors.accentLight,
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="checkmark-circle" size={14} color={Colors.secondary} />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: Colors.secondary,
                      marginLeft: 6,
                    }}
                  >
                    {s}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: Colors.surface,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 36,
          shadowColor: Colors.primary,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 10,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            router.push({
              pathname: "/booking/new",
              params: {
                cleanerId: cleaner.id,
                cleanerName: cleaner.full_name,
                hourlyRate: String(cleaner.hourly_rate ?? 15),
              },
            })
          }
          style={{
            backgroundColor: cleaner.is_available ? Colors.secondary : Colors.textTertiary,
            borderRadius: 16,
            height: 56,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          <Ionicons name="calendar-outline" size={20} color="#fff" />
          <Text
            style={{
              color: "#fff",
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            {cleaner.is_available ? "Prenota ora" : "Non disponibile"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
