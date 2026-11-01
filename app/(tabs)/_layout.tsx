import { withLayoutContext } from "expo-router";
import { createNativeBottomTabNavigator } from "@bottom-tabs/react-navigation";
import { useAuth } from "../../lib/auth";
import { PColor } from "../../lib/design/pulitori";

const { Navigator } = createNativeBottomTabNavigator();
const Tabs = withLayoutContext(Navigator);

export default function TabsLayout() {
  const { profile } = useAuth();
  const isCleaner = profile?.active_role === "cleaner";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PColor.accent,
      }}
    >
      <Tabs.Screen
        name={isCleaner ? "cleaner-home" : "home"}
        options={{
          title: isCleaner ? "Lavori" : "Esplora",
          tabBarIcon: () => ({
            sfSymbol: isCleaner ? "briefcase" : "map",
          }),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: isCleaner ? "Messaggi" : "Chat",
          tabBarIcon: () => ({ sfSymbol: "bubble.left.and.bubble.right" }),
          // No badge here: the `notifications` table only holds booking events
          // (no per-message read tracking exists), so a count would be
          // misleading on a "Chat" tab. Booking notifications surface via the
          // NotificationBell instead. Re-add when message read-receipts exist.
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: isCleaner ? "Incarichi" : "Prenotazioni",
          tabBarIcon: () => ({ sfSymbol: "doc.text" }),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profilo",
          tabBarIcon: () => ({ sfSymbol: "person" }),
        }}
      />
      <Tabs.Screen name="notifications" options={{ tabBarItemHidden: true }} />
      <Tabs.Screen
        name={isCleaner ? "home" : "cleaner-home"}
        options={{ tabBarItemHidden: true }}
      />
    </Tabs>
  );
}
