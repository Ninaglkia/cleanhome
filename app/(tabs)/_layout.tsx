import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useAuth } from "../../lib/auth";
import { Colors } from "../../lib/theme";

// ─── Design tokens per tab ────────────────────────────────────────────────────

// Client (teal/green) — modalità "Cliente Premium"
const CLIENT = {
  activeTint: "#006b55",
  activePillBg: "#e8f5f1",
  inactiveTint: "rgba(2,36,32,0.4)",
  tabBarBg: "rgba(255,255,255,0.90)",
  shadowColor: "#181c1c",
} as const;

// Cleaner (warm brown/orange) — modalità "Professionista"
const CLEANER = {
  activeTint: "#6f4627",
  activePillBg: "#F5EBE0",
  inactiveTint: "rgba(80,60,40,0.35)",
  tabBarBg: "rgba(250,247,244,0.90)",
  shadowColor: "#3d2410",
} as const;

// ─── Active tab pill wrapper ──────────────────────────────────────────────────

interface TabItemProps {
  iconName: keyof typeof Ionicons.glyphMap;
  iconNameFilled: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
  color: string;
  pillBg: string;
  badgeDot?: boolean;
}

function TabItem({ iconName, iconNameFilled, label, focused, color, pillBg, badgeDot }: TabItemProps) {
  return (
    <View style={tabItemStyles.wrap}>
      <View style={[tabItemStyles.pill, focused && { backgroundColor: pillBg }]}>
        <View>
          <Ionicons
            name={focused ? iconNameFilled : iconName}
            size={22}
            color={color}
          />
          {badgeDot && (
            <View style={tabItemStyles.badge} />
          )}
        </View>
      </View>
      <Text style={[tabItemStyles.label, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const tabItemStyles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    width: 70,
  },
  pill: {
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  badge: {
    position: "absolute",
    top: -1,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#dc2626",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
});

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  const { profile } = useAuth();
  const isCleaner = profile?.active_role === "cleaner";

  // I nomi delle costanti di colore sono invertiti nel design originale:
  // CLIENT = verde/blu, CLEANER = arancione/marrone.
  // Ma l'utente vuole: cleaner=verde, client=arancione.
  // Quindi: isCleaner → CLIENT (verde), !isCleaner → CLEANER (arancione).
  const T = isCleaner ? CLIENT : CLEANER;
  // Unread count wiring is not yet in place — leave the dot off by
  // default until the messages hook exposes real unread state.
  const UNREAD_NOTIFICATIONS = 0;

  const tabBarStyle = [
    styles.tabBar,
    {
      backgroundColor: T.tabBarBg,
      shadowColor: T.shadowColor,
    },
  ];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabBarStyle,
        tabBarShowLabel: false,
      }}
    >
      {/* 1. CLEANER → Lavori (cleaner-home) / CLIENT → Esplora (home with map) */}
      <Tabs.Screen
        name={isCleaner ? "cleaner-home" : "home"}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              iconName={isCleaner ? "briefcase-outline" : "map-outline"}
              iconNameFilled={isCleaner ? "briefcase" : "map"}
              label={isCleaner ? "Lavori" : "Esplora"}
              focused={focused}
              color={focused ? T.activeTint : T.inactiveTint}
              pillBg={T.activePillBg}
            />
          ),
        }}
      />

      {/* 2. MESSAGES (Shared) */}
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              iconName="chatbubbles-outline"
              iconNameFilled="chatbubbles"
              label={isCleaner ? "Messaggi" : "Chat"}
              focused={focused}
              color={focused ? T.activeTint : T.inactiveTint}
              pillBg={T.activePillBg}
              badgeDot={UNREAD_NOTIFICATIONS > 0}
            />
          ),
        }}
      />

      {/* 3. CLEANER → Incarichi / CLIENT → Prenotazioni */}
      <Tabs.Screen
        name="bookings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              iconName="document-text-outline"
              iconNameFilled="document-text"
              label={isCleaner ? "Incarichi" : "Prenotazioni"}
              focused={focused}
              color={focused ? T.activeTint : T.inactiveTint}
              pillBg={T.activePillBg}
            />
          ),
        }}
      />

      {/* 4. PROFILE (Shared) */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              iconName="person-outline"
              iconNameFilled="person"
              label="Profilo"
              focused={focused}
              color={focused ? T.activeTint : T.inactiveTint}
              pillBg={T.activePillBg}
            />
          ),
        }}
      />

      {/* Hidden screens that are part of the tab group but not in the bar */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name={isCleaner ? "home" : "cleaner-home"} options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    // Stitch: rounded-t-[2.5rem] backdrop-blur shadow-[0_-8px_30px_rgb(0,0,0,0.04)]
    borderTopWidth: 0,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 16,
    height: Platform.OS === "ios" ? 88 : 68,
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
    paddingTop: 10,
    paddingHorizontal: 8,
    position: "absolute",
  },
});
