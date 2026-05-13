import { View, Text, StyleSheet } from "react-native";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileStatCardProps {
  value: string;
  label: string;
  subtitle?: string;
  bgColor: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileStatCard({
  value,
  label,
  subtitle,
  bgColor,
}: ProfileStatCardProps) {
  return (
    <View style={[statStyles.card, { backgroundColor: bgColor }]}>
      <Text style={statStyles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={statStyles.label} numberOfLines={1}>
        {label}
      </Text>
      {subtitle != null ? (
        <Text style={statStyles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    shadowColor: "#022420",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
    color: "#022420",
    letterSpacing: -0.5,
    marginBottom: 4,
    textAlign: "center",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#414846",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 11,
    color: "#717976",
    marginTop: 2,
    textAlign: "center",
  },
});
