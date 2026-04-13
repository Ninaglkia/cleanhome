import { View, Text, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../lib/theme";

export type LegalSection = {
  heading: string;
  body: string;
};

export type LegalPageProps = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

export function LegalPage({ title, lastUpdated, intro, sections }: LegalPageProps) {
  const router = useRouter();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" />

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
          {title}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 26,
            fontWeight: "800",
            color: Colors.text,
            letterSpacing: -0.6,
            marginBottom: 6,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: Colors.textTertiary,
            marginBottom: 18,
          }}
        >
          Ultimo aggiornamento: {lastUpdated}
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: Colors.textSecondary,
            lineHeight: 23,
            marginBottom: 28,
          }}
        >
          {intro}
        </Text>

        {sections.map((section, i) => (
          <View key={i} style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: Colors.text,
                marginBottom: 8,
              }}
            >
              {i + 1}. {section.heading}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: Colors.textSecondary,
                lineHeight: 22,
              }}
            >
              {section.body}
            </Text>
          </View>
        ))}

        <View
          style={{
            marginTop: 16,
            padding: 16,
            backgroundColor: Colors.accentLight,
            borderRadius: 14,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: Colors.secondary,
              fontWeight: "600",
              lineHeight: 20,
            }}
          >
            Per qualsiasi domanda puoi contattarci all'indirizzo {""}
            <Text style={{ fontWeight: "800" }}>support@cleanhome.app</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
