import { View, Text, StyleSheet } from "react-native";
import { PColor, PBorder } from "../../lib/design/pulitori";

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
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PBorder.subtle,
  },
  value: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: PColor.ink,
    letterSpacing: -0.5,
    marginBottom: 4,
    textAlign: "center",
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: PColor.body,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: PColor.body2,
    marginTop: 2,
    textAlign: "center",
  },
});
