import { useCallback } from "react";
import { View, Text, Pressable, StatusBar, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { Colors } from "../../lib/theme";
import { Button } from "../../components/ui/Button";

const TERMS_URL = "https://www.cleanhomeapp.com/terms";

export default function TermsScreen() {
  const router = useRouter();

  const handleOpen = useCallback(async () => {
    try {
      await WebBrowser.openBrowserAsync(TERMS_URL, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } catch {
      Alert.alert(
        "Impossibile aprire la pagina",
        "Controlla la connessione o visita cleanhomeapp.com"
      );
    }
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
          Termini di Servizio
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
          <Ionicons name="document-text" size={36} color={Colors.primary} />
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
          Termini di Servizio
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: Colors.textSecondary,
            textAlign: "center",
            lineHeight: 23,
          }}
        >
          I termini e le condizioni di utilizzo del servizio CleanHome sono
          disponibili sul sito ufficiale, con i dati aggiornati del titolare.
        </Text>

        <Button
          label="Apri Termini di Servizio"
          onPress={handleOpen}
          variant="dark"
          icon="open-outline"
          iconPosition="right"
          accessibilityLabel="Apri Termini di Servizio sul sito ufficiale"
        />

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
