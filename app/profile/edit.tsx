import { useCallback, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { updateProfileContact } from "../../lib/api";
import { Colors } from "../../lib/theme";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);

  const trimmedName = fullName.trim();
  // Normalise to E.164 (strip formatting; prepend +39 if no country code).
  const normalizedPhone = (() => {
    const p = phone.trim().replace(/[\s().-]/g, "");
    if (!p) return "";
    if (p.startsWith("+")) return p;
    return "+39" + p.replace(/^0+/, "");
  })();
  const phoneValid =
    normalizedPhone === "" || /^\+\d{8,15}$/.test(normalizedPhone);
  const nameChanged = trimmedName !== (profile?.full_name ?? "");
  const phoneChanged = normalizedPhone !== (profile?.phone ?? "");
  const hasChanges = (nameChanged || phoneChanged) && trimmedName.length > 0;
  const isValid = trimmedName.length >= 2 && phoneValid;

  const handleSave = useCallback(async () => {
    if (!user || !hasChanges || !isValid) return;
    setSaving(true);
    try {
      await updateProfileContact(user.id, {
        fullName: trimmedName,
        phone: normalizedPhone,
      });
      await refreshProfile();
      router.back();
    } catch {
      Alert.alert("Errore", "Impossibile salvare. Riprova.");
    } finally {
      setSaving(false);
    }
  }, [user, hasChanges, isValid, trimmedName, normalizedPhone, refreshProfile, router]);

  const handleBack = useCallback(() => {
    if (hasChanges && !saving) {
      Alert.alert(
        "Annullare le modifiche?",
        "Le modifiche non salvate andranno perse.",
        [
          { text: "Continua a modificare", style: "cancel" },
          {
            text: "Esci senza salvare",
            style: "destructive",
            onPress: () => router.back(),
          },
        ]
      );
      return;
    }
    router.back();
  }, [hasChanges, saving, router]);

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
          onPress={handleBack}
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
          Modifica profilo
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
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: Colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            Nome completo
          </Text>
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 4,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Il tuo nome completo"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
              maxLength={60}
              style={{
                height: 52,
                fontSize: 16,
                color: Colors.text,
              }}
            />
          </View>

          {/* Telefono — usato per le notifiche SMS */}
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: Colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginTop: 24,
              marginBottom: 10,
            }}
          >
            Telefono
          </Text>
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 16,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Ionicons name="call-outline" size={18} color={Colors.textTertiary} />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+39 333 1234567"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={20}
              style={{
                flex: 1,
                marginLeft: 10,
                height: 52,
                fontSize: 16,
                color: Colors.text,
              }}
            />
          </View>
          <Text
            style={{
              fontSize: 12,
              color: phoneValid ? Colors.textTertiary : Colors.error,
              marginTop: 6,
              marginLeft: 4,
            }}
          >
            {phoneValid
              ? "Usato per gli SMS di notifica (es. richiesta accettata)."
              : "Numero non valido. Usa il formato +39 333 1234567."}
          </Text>

          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: Colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginTop: 24,
              marginBottom: 10,
            }}
          >
            Email
          </Text>
          <View
            style={{
              backgroundColor: Colors.surfaceLow,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 16,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons
              name="mail-outline"
              size={18}
              color={Colors.textTertiary}
            />
            <Text
              style={{
                marginLeft: 10,
                fontSize: 15,
                color: Colors.textSecondary,
                flex: 1,
              }}
            >
              {user?.email ?? "—"}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 12,
              color: Colors.textTertiary,
              marginTop: 6,
              marginLeft: 4,
            }}
          >
            Contatta il supporto per modificare l'email
          </Text>
        </ScrollView>

        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 24,
            backgroundColor: Colors.background,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!hasChanges || !isValid || saving}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityState={{
              disabled: !hasChanges || !isValid || saving,
              busy: saving,
            }}
            accessibilityLabel="Salva modifiche al profilo"
            style={{
              backgroundColor:
                !hasChanges || !isValid || saving
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
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}
              >
                Salva modifiche
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
