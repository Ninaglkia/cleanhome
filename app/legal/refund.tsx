import { useCallback } from "react";
import { View, Text, Pressable, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { Colors } from "../../lib/theme";

const REFUND_URL = "https://www.cleanhomeapp.com/refund";

export default function RefundScreen() {
  const router = useRouter();

  const handleOpen = useCallback(async () => {
    await WebBrowser.openBrowserAsync(REFUND_URL, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  }, []);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Indietro"
          accessibilityRole="button"
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
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            color: Colors.text,
          }}
        >
          Politica di Rimborso
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Body */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
          gap: 24,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: Colors.accentLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="refresh-circle" size={36} color={Colors.primary} />
        </View>

        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: Colors.text,
            textAlign: "center",
            letterSpacing: -0.4,
          }}
        >
          Politica di Rimborso
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: Colors.textSecondary,
            textAlign: "center",
            lineHeight: 23,
          }}
        >
          Le condizioni di rimborso e cancellazione dei servizi CleanHome sono
          disponibili sul sito ufficiale, sempre aggiornate.
        </Text>

        <Pressable
          onPress={handleOpen}
          style={({ pressed }) => ({
            backgroundColor: Colors.primary,
            paddingVertical: 16,
            paddingHorizontal: 32,
            borderRadius: 16,
            width: "100%",
            alignItems: "center",
            opacity: pressed ? 0.85 : 1,
          })}
          accessibilityRole="button"
          accessibilityLabel="Apri Politica di Rimborso sul sito ufficiale"
        >
          <Text
            style={{
              color: "#fff",
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            Apri Politica di Rimborso
          </Text>
        </Pressable>

        <Text
          style={{
            fontSize: 12,
            color: Colors.textTertiary,
            textAlign: "center",
          }}
        >
          Versione web sempre aggiornata su cleanhomeapp.com
        </Text>
      </View>
    </SafeAreaView>
  );
}
