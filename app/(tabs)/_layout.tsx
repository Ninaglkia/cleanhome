import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import { useAuth } from "../../lib/auth";
import { Colors } from "../../lib/theme";

export default function TabsLayout() {
  const { profile } = useAuth();
  const isCleaner = profile?.active_role === "cleaner";

  // Tint: teal per client, warm brown per cleaner
  const activeTint = isCleaner ? Colors.cleanerPrimary : Colors.secondary;

  // Mock unread count — sostituire con hook reale quando disponibile
  const UNREAD_NOTIFICATIONS = 2;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
      }}
    >
      {/* CLIENT-only: Home/Cerca con icona casa */}
      <Tabs.Screen
        name="home"
        options={{
          title: "HOME",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
          href: isCleaner ? null : "/(tabs)/home",
        }}
      />

      {/* CLEANER-only: Lavori */}
      <Tabs.Screen
        name="cleaner-home"
        options={{
          title: "LAVORI",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
          href: isCleaner ? "/(tabs)/cleaner-home" : null,
        }}
      />

      {/* CLIENT: SEARCH / CLEANER: CHAT */}
      <Tabs.Screen
        name="messages"
        options={{
          title: isCleaner ? "CHAT" : "SEARCH",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={isCleaner ? "chatbubbles-outline" : "search-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* Shared: Notifiche */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: "AVVISI",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="notifications-outline" size={size} color={color} />
              {UNREAD_NOTIFICATIONS > 0 && (
                <View style={styles.badge}>
                  {/* vuoto: dot visibile senza testo per dimensioni ridotte */}
                </View>
              )}
            </View>
          ),
        }}
      />

      {/* Shared: Richieste */}
      <Tabs.Screen
        name="bookings"
        options={{
          title: "RICHIESTE",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Shared: Profilo */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "PROFILO",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -1,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 0,
    // Shadow sopra la tab bar (spec: top shadow)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 16,
    height: Platform.OS === "ios" ? 82 : 60,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  tabIcon: {
    marginBottom: 0,
  },
});
