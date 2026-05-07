import { View, StyleSheet } from "react-native";
import { ProfileStatCard } from "./ProfileStatCard";
import { useProfileStats } from "../../lib/hooks/useProfileStats";

// ─── Currency formatter (Italian locale) ─────────────────────────────────────

const euroFmt = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatEuro(value: number): string {
  return euroFmt.format(value);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileStatsStripProps {
  userId: string | null | undefined;
  role: "cleaner" | "client";
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const CLEANER_BG = "#F0F9F6";
const CLIENT_BG = "#FAF6F1";

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileStatsStrip({ userId, role }: ProfileStatsStripProps) {
  const stats = useProfileStats(userId, role);
  const bg = role === "cleaner" ? CLEANER_BG : CLIENT_BG;
  const placeholder = "—";

  if (role === "cleaner") {
    const { earnings, jobs, rating, reviewCount, isLoading } = stats as Extract<
      typeof stats,
      { role: "cleaner" }
    >;

    return (
      <View style={stripStyles.row}>
        <ProfileStatCard
          value={isLoading ? placeholder : formatEuro(earnings)}
          label="Guadagnati"
          subtitle="Questo mese"
          bgColor={bg}
        />
        <ProfileStatCard
          value={isLoading ? placeholder : String(jobs)}
          label="Lavori"
          subtitle="Totali"
          bgColor={bg}
        />
        <ProfileStatCard
          value={isLoading ? placeholder : `★ ${rating}`}
          label="Rating"
          subtitle={isLoading ? placeholder : `${reviewCount} recensioni`}
          bgColor={bg}
        />
      </View>
    );
  }

  const { spent, bookingsCount, propertiesCount, isLoading } = stats as Extract<
    typeof stats,
    { role: "client" }
  >;

  return (
    <View style={stripStyles.row}>
      <ProfileStatCard
        value={isLoading ? placeholder : formatEuro(spent)}
        label="Spesi"
        subtitle="Totale"
        bgColor={bg}
      />
      <ProfileStatCard
        value={isLoading ? placeholder : String(bookingsCount)}
        label="Prenotazioni"
        subtitle="Completate"
        bgColor={bg}
      />
      <ProfileStatCard
        value={isLoading ? placeholder : String(propertiesCount)}
        label="Case"
        subtitle="Indirizzi"
        bgColor={bg}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const stripStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 16,
  },
});
