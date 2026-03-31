import { Stack } from "expo-router";

export default function CleanerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="jobs" />
      <Stack.Screen name="reviews" />
      <Stack.Screen name="profile-view" />
    </Stack>
  );
}
