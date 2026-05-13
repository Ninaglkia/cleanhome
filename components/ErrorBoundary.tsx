import React, { Component, ErrorInfo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary — catches unhandled JS errors in the React
 * tree and shows a friendly "something went wrong" screen instead of
 * a white screen or a raw red error.
 *
 * Wrap the root of the app with this (inside _layout.tsx).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send to Sentry/Crashlytics here
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconCircle}>
            <Ionicons name="warning-outline" size={48} color="#E53E3E" />
          </View>
          <Text style={styles.title}>Qualcosa è andato storto</Text>
          <Text style={styles.subtitle}>
            Si è verificato un errore imprevisto. Prova a ricaricare la
            schermata.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.debug}>
              {this.state.error.message}
            </Text>
          )}
          <Pressable
            onPress={this.handleRetry}
            style={({ pressed }) => [
              styles.retryBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryText}>Riprova</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6faf9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#181c1c",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#717976",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  debug: {
    fontSize: 11,
    color: "#E53E3E",
    textAlign: "center",
    marginBottom: 16,
    fontFamily: "monospace",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#006b55",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  retryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
