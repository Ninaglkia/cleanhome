import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Pressable } from "../components/ui/AppPressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePhoneVerification } from "../lib/hooks/usePhoneVerification";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESEND_COUNTDOWN_SECONDS = 30;
const OTP_LENGTH = 6;

// ─── Local design tokens (match profile.tsx C palette) ────────────────────────

const C = {
  background: "#f8fbfa",
  surface: "#ffffff",
  surfaceLow: "#f0f4f3",
  primary: "#022420",
  secondary: "#006b55",
  outlineVariant: "#c1c8c5",
  onSurfaceVariant: "#414846",
  outline: "#717976",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  success: "#16a34a",
  successLight: "#dcfce7",
  border: "#d4e4e0",
  text: "#0f1f1d",
  textSecondary: "#4a6660",
  textTertiary: "#8aaca6",
} as const;

// ─── OTP box ──────────────────────────────────────────────────────────────────

interface OtpBoxProps {
  value: string;
  isFocused: boolean;
  inputRef: React.RefObject<TextInput | null>;
  onFocus: () => void;
}

function OtpBox({ value, isFocused, inputRef, onFocus }: OtpBoxProps) {
  return (
    <Pressable onPress={onFocus} style={[styles.otpBox, isFocused && styles.otpBoxFocused]}>
      <TextInput
        ref={inputRef}
        style={styles.otpInput}
        value={value}
        caretHidden
        maxLength={1}
        keyboardType="numeric"
        onFocus={onFocus}
        // The actual input handling is on the hidden master input below
        editable={false}
        accessibilityLabel={`Cifra OTP ${value ? value : "vuota"}`}
      />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { phone: phoneParam, onSuccessRoute } =
    useLocalSearchParams<{ phone?: string; onSuccessRoute?: string }>();

  const { sendOtp, verifyOtp, isSending, isVerifying } = usePhoneVerification();

  // ── Step state ─────────────────────────────────────────────────────────────
  type Step = "enter-phone" | "enter-otp" | "success";
  const [step, setStep] = useState<Step>("enter-phone");

  // ── Phone input ────────────────────────────────────────────────────────────
  // localNumber: digits only, no prefix, no leading 0
  const [localNumber, setLocalNumber] = useState<string>(() => {
    if (!phoneParam) return "";
    // Strip +39 prefix and any spaces/dashes
    const stripped = phoneParam.replace(/\D/g, "");
    if (stripped.startsWith("39")) return stripped.slice(2);
    return stripped;
  });
  const [sendError, setSendError] = useState<string | null>(null);

  // ── OTP input ──────────────────────────────────────────────────────────────
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [focusedOtpIndex, setFocusedOtpIndex] = useState<number>(0);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Master hidden TextInput for OTP — captures all keypresses on iOS/Android
  const masterInputRef = useRef<TextInput>(null);
  const otpBoxRefs = useRef<Array<React.RefObject<TextInput | null>>>(
    Array.from({ length: OTP_LENGTH }, () => ({ current: null }))
  );

  // ── Resend countdown ───────────────────────────────────────────────────────
  const [resendSeconds, setResendSeconds] = useState<number>(RESEND_COUNTDOWN_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setResendSeconds(RESEND_COUNTDOWN_SECONDS);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendSeconds((s) => {
        if (s <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── Auto-navigate on success ───────────────────────────────────────────────
  useEffect(() => {
    if (step !== "success") return;
    const timer = setTimeout(() => {
      if (onSuccessRoute) {
        router.replace(onSuccessRoute as Parameters<typeof router.replace>[0]);
      } else {
        router.back();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [step, onSuccessRoute, router]);

  // ── Format E.164 ──────────────────────────────────────────────────────────
  const toE164 = useCallback((digits: string): string => {
    const cleaned = digits.replace(/\D/g, "");
    const withoutLeadingZero = cleaned.startsWith("0") ? cleaned.slice(1) : cleaned;
    return `+39${withoutLeadingZero}`;
  }, []);

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    setSendError(null);
    const phone = toE164(localNumber);
    try {
      await sendOtp(phone);
      setStep("enter-otp");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setFocusedOtpIndex(0);
      setVerifyError(null);
      startCountdown();
      // Focus master input after transition
      setTimeout(() => masterInputRef.current?.focus(), 300);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Impossibile inviare il codice");
    }
  }, [localNumber, sendOtp, toE164, startCountdown]);

  // ── Resend ────────────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (resendSeconds > 0) return;
    setSendError(null);
    setVerifyError(null);
    const phone = toE164(localNumber);
    try {
      await sendOtp(phone);
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setFocusedOtpIndex(0);
      startCountdown();
      setTimeout(() => masterInputRef.current?.focus(), 100);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Impossibile reinviare il codice");
    }
  }, [resendSeconds, localNumber, sendOtp, toE164, startCountdown]);

  // ── OTP master input change ────────────────────────────────────────────────
  const handleMasterChange = useCallback(
    (text: string) => {
      // Paste support: if we receive 6 digits at once, fill all boxes
      const digits = text.replace(/\D/g, "");
      if (digits.length >= OTP_LENGTH) {
        const filled = digits.slice(0, OTP_LENGTH).split("");
        setOtpDigits(filled);
        setFocusedOtpIndex(OTP_LENGTH - 1);
        masterInputRef.current?.blur();
        return;
      }

      // Single digit — place at current focused index
      if (digits.length === 1) {
        setOtpDigits((prev) => {
          const next = [...prev];
          next[focusedOtpIndex] = digits;
          return next;
        });
        if (focusedOtpIndex < OTP_LENGTH - 1) {
          setFocusedOtpIndex(focusedOtpIndex + 1);
        }
      }
    },
    [focusedOtpIndex]
  );

  // ── OTP backspace ─────────────────────────────────────────────────────────
  const handleMasterKeyPress = useCallback(
    (e: { nativeEvent: { key: string } }) => {
      if (e.nativeEvent.key === "Backspace") {
        if (otpDigits[focusedOtpIndex] !== "") {
          setOtpDigits((prev) => {
            const next = [...prev];
            next[focusedOtpIndex] = "";
            return next;
          });
        } else if (focusedOtpIndex > 0) {
          const prevIdx = focusedOtpIndex - 1;
          setFocusedOtpIndex(prevIdx);
          setOtpDigits((prev) => {
            const next = [...prev];
            next[prevIdx] = "";
            return next;
          });
        }
      }
    },
    [focusedOtpIndex, otpDigits]
  );

  // ── OTP focus box ─────────────────────────────────────────────────────────
  const handleOtpBoxFocus = useCallback((index: number) => {
    setFocusedOtpIndex(index);
    masterInputRef.current?.focus();
  }, []);

  // ── Verify ────────────────────────────────────────────────────────────────
  const otpCode = otpDigits.join("");
  const isOtpComplete = otpCode.length === OTP_LENGTH;

  const handleVerify = useCallback(async () => {
    if (!isOtpComplete) return;
    setVerifyError(null);
    const phone = toE164(localNumber);
    try {
      await verifyOtp(phone, otpCode);
      setStep("success");
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Verifica fallita");
    }
  }, [isOtpComplete, localNumber, otpCode, verifyOtp, toE164]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const canSend = localNumber.replace(/\D/g, "").length >= 9;
  const phoneDisplay = `+39 ${localNumber}`;

  // ── Success state ─────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.successContainer}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={72} color={C.success} />
          </View>
          <Text style={styles.successTitle}>Telefono verificato</Text>
          <Text style={styles.successSubtext}>
            Il tuo numero è stato confermato con successo.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (step === "enter-otp") {
                setStep("enter-phone");
                setVerifyError(null);
              } else if (router.canGoBack()) {
                router.back();
              }
            }}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Indietro"
          >
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Verifica telefono</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* ── Content ── */}
        <View style={styles.content}>
          {step === "enter-phone" && (
            <>
              <Text style={styles.stepTitle}>Il tuo numero di telefono</Text>
              <Text style={styles.stepSubtext}>
                Ti invieremo un codice SMS per verificare il tuo numero.
              </Text>

              {/* Phone input */}
              <View style={styles.phoneRow}>
                <View style={styles.prefixBox}>
                  <Text style={styles.prefixText}>+39</Text>
                </View>
                <View style={styles.prefixDivider} />
                <TextInput
                  style={styles.phoneInput}
                  value={localNumber}
                  onChangeText={(t) => {
                    setSendError(null);
                    // Allow only digits, spaces, dashes
                    setLocalNumber(t.replace(/[^\d\s-]/g, ""));
                  }}
                  placeholder="3xx xxxxxxx"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="phone-pad"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={canSend ? handleSend : undefined}
                  accessibilityLabel="Numero di telefono"
                />
              </View>

              {sendError ? (
                <Text style={styles.errorText}>{sendError}</Text>
              ) : null}

              <Pressable
                onPress={handleSend}
                disabled={!canSend || isSending}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (!canSend || isSending) && styles.primaryBtnDisabled,
                  pressed && canSend && !isSending && styles.primaryBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Invia codice"
              >
                {isSending ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Invia codice</Text>
                )}
              </Pressable>
            </>
          )}

          {step === "enter-otp" && (
            <>
              <Text style={styles.stepTitle}>Inserisci il codice</Text>
              <Text style={styles.stepSubtext}>
                Abbiamo inviato un codice a {phoneDisplay}
              </Text>

              {/* OTP boxes */}
              <View style={styles.otpRow}>
                {otpBoxRefs.current.map((ref, i) => (
                  <OtpBox
                    key={i}
                    value={otpDigits[i] ?? ""}
                    isFocused={focusedOtpIndex === i}
                    inputRef={ref}
                    onFocus={() => handleOtpBoxFocus(i)}
                  />
                ))}
              </View>

              {/* Hidden master TextInput that captures actual input */}
              <TextInput
                ref={masterInputRef}
                style={styles.hiddenInput}
                value=""
                onChangeText={handleMasterChange}
                onKeyPress={handleMasterKeyPress}
                keyboardType="numeric"
                maxLength={OTP_LENGTH}
                autoFocus
                caretHidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />

              {verifyError ? (
                <Text style={styles.errorText}>{verifyError}</Text>
              ) : null}

              <Pressable
                onPress={handleVerify}
                disabled={!isOtpComplete || isVerifying}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (!isOtpComplete || isVerifying) && styles.primaryBtnDisabled,
                  pressed && isOtpComplete && !isVerifying && styles.primaryBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Verifica codice"
              >
                {isVerifying ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Verifica</Text>
                )}
              </Pressable>

              {/* Resend link */}
              <Pressable
                onPress={handleResend}
                disabled={resendSeconds > 0 || isSending}
                style={styles.resendBtn}
                accessibilityRole="button"
                accessibilityLabel={
                  resendSeconds > 0
                    ? `Reinvia tra ${resendSeconds} secondi`
                    : "Reinvia codice"
                }
              >
                <Text
                  style={[
                    styles.resendText,
                    resendSeconds > 0 && styles.resendTextDisabled,
                  ]}
                >
                  {resendSeconds > 0
                    ? `Reinvia tra ${resendSeconds}s`
                    : "Reinvia codice"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  flex: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: C.text,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  backBtnPressed: {
    opacity: 0.75,
  },

  // ── Content area ────────────────────────────────────────────────────────────
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  stepSubtext: {
    fontSize: 14,
    color: C.textSecondary,
    marginBottom: 28,
    lineHeight: 20,
  },

  // ── Phone row ────────────────────────────────────────────────────────────────
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    height: 56,
    overflow: "hidden",
    marginBottom: 12,
  },
  prefixBox: {
    paddingHorizontal: 16,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  prefixText: {
    fontSize: 16,
    fontWeight: "600",
    color: C.textTertiary,
  },
  prefixDivider: {
    width: 1,
    height: 28,
    backgroundColor: C.outlineVariant,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    color: C.text,
    height: "100%",
  },

  // ── Error ────────────────────────────────────────────────────────────────────
  errorText: {
    fontSize: 13,
    color: C.error,
    marginBottom: 12,
    lineHeight: 18,
  },

  // ── Primary button ───────────────────────────────────────────────────────────
  primaryBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: C.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: C.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryBtnDisabled: {
    backgroundColor: C.outlineVariant,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnPressed: {
    opacity: 0.9,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },

  // ── OTP ─────────────────────────────────────────────────────────────────────
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface,
  },
  otpBoxFocused: {
    borderColor: C.secondary,
    borderWidth: 2,
  },
  otpInput: {
    fontSize: 24,
    fontWeight: "700",
    color: C.text,
    textAlign: "center",
    width: "100%",
    height: "100%",
    padding: 0,
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    left: -9999,
  },

  // ── Resend ───────────────────────────────────────────────────────────────────
  resendBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  resendText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.secondary,
  },
  resendTextDisabled: {
    color: C.textTertiary,
  },

  // ── Success ──────────────────────────────────────────────────────────────────
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  successIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  successSubtext: {
    fontSize: 15,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
