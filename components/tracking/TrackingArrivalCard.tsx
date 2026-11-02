import { useCallback, useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "../ui/AppPressable";
import { Colors } from "../../lib/theme";
import { CleanerMarkerIcon } from "./CleanerMarkerIcon";

export interface TrackingArrivalCardProps {
  cleanerName: string;
  cleanerAvatarUrl?: string | null;
  address: string;
  etaMinutes: number | null;
  distanceKm: number | null;
  hasLocation: boolean;
  lastUpdatedAt?: number | null;
  onChat: () => void;
  onDetails: () => void;
}

const distanceFormatter = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });

function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm < 0) return null;
  return distanceKm < 1
    ? `${Math.round(distanceKm * 1000)} m`
    : `${distanceFormatter.format(distanceKm)} km`;
}

function formatUpdatedTime(timestamp: number | null | undefined): string | null {
  if (timestamp == null || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Presentational only: the parent owns GPS, estimates, navigation and messaging. */
export function TrackingArrivalCard({
  cleanerName,
  cleanerAvatarUrl,
  address,
  etaMinutes,
  distanceKm,
  hasLocation,
  lastUpdatedAt,
  onChat,
  onDetails,
}: TrackingArrivalCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarUri = cleanerAvatarUrl?.trim() || null;
  const displayName = cleanerName.trim() || "Professionista";
  const displayAddress = address.trim() || "Indirizzo della prenotazione";
  const initials = displayName.split(/\s+/u).slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "").join("").toLocaleUpperCase("it-IT");
  const distance = formatDistance(distanceKm);
  const updatedTime = formatUpdatedTime(lastUpdatedAt);
  const eta = etaMinutes !== null && Number.isFinite(etaMinutes) && etaMinutes >= 0
    ? Math.ceil(etaMinutes)
    : null;
  const etaLabel = eta === null
    ? "Tempo di arrivo in aggiornamento"
    : eta === 0 ? "Quasi arrivato" : `Circa ${eta} ${eta === 1 ? "minuto" : "minuti"}`;

  useEffect(() => setAvatarFailed(false), [avatarUri]);
  const handleAvatarError = useCallback(() => setAvatarFailed(true), []);

  return (
    <View className="gap-3 rounded-3xl border border-ch-outline-variant bg-ch-surface-lowest p-4" testID="tracking-arrival-card">
      {hasLocation ? (
        <View className="flex-row items-start justify-between gap-4">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-sm font-semibold leading-5 text-ch-secondary">In arrivo</Text>
            {distance ? (
              <Text className="text-xs leading-4 text-ch-on-surface-variant" selectable>{distance} di distanza</Text>
            ) : null}
            {updatedTime ? (
              <Text className="text-[11px] leading-4 text-ch-on-surface-variant">Ultimo aggiornamento {updatedTime}</Text>
            ) : null}
          </View>
          <View className="max-w-[52%] items-end" accessible accessibilityLabel={etaLabel}>
            <Text className="text-xs leading-4 text-ch-on-surface-variant" accessible={false}>
              {eta !== null && eta > 0 ? "Circa" : "Arrivo stimato"}
            </Text>
            {eta !== null && eta > 0 ? (
              <View className="flex-row flex-wrap items-baseline justify-end gap-1">
                <Text className="text-[34px] font-bold leading-10 text-ch-primary" accessible={false}>{eta}</Text>
                <Text className="text-base font-medium leading-6 text-ch-primary" accessible={false}>min</Text>
              </View>
            ) : (
              <Text className="mt-1 text-right text-xl font-semibold leading-6 text-ch-primary" accessible={false}>
                {eta === 0 ? "Quasi arrivato" : "Stima in aggiornamento"}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View className="flex-row items-start gap-3">
          <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ch-secondary-container">
            <CleanerMarkerIcon size={32} color={Colors.primary} accentColor={Colors.secondary} />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-sm font-semibold leading-5 text-ch-primary">In attesa della posizione</Text>
            <Text className="text-[13px] leading-[18px] text-ch-on-surface-variant">
              La posizione comparirà sulla mappa appena disponibile.
            </Text>
            {updatedTime ? (
              <Text className="text-[11px] leading-4 text-ch-on-surface-variant">Ultimo aggiornamento {updatedTime}</Text>
            ) : null}
          </View>
        </View>
      )}

      <View className="flex-row items-start gap-3 border-t border-ch-outline-variant pt-3">
        <View className="h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ch-secondary-container">
          {avatarUri && !avatarFailed ? (
            <Image source={{ uri: avatarUri }} className="h-full w-full" resizeMode="cover" onError={handleAvatarError} accessible={false} />
          ) : (
            <Text className="text-base font-semibold text-ch-primary" accessible={false}>{initials}</Text>
          )}
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-base font-semibold leading-[22px] text-ch-primary" numberOfLines={2} accessibilityLabel={displayName} selectable>
            {displayName}
          </Text>
          <View className="flex-row items-start gap-1">
            <Ionicons name="location-outline" size={14} color={Colors.textSecondary} accessible={false} />
            <Text className="min-w-0 flex-1 text-[13px] leading-[18px] text-ch-on-surface-variant" numberOfLines={2} accessibilityLabel={`Destinazione: ${displayAddress}`} selectable>
              {displayAddress}
            </Text>
          </View>
        </View>
      </View>

      <View>
        <Pressable
          onPress={onChat}
          className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-2xl bg-ch-primary px-4 py-3 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Scrivi al professionista"
        >
          <Ionicons name="chatbubble-outline" size={20} color={Colors.textOnDark} accessible={false} />
          <Text className="shrink text-center text-[15px] font-semibold leading-5 text-ch-surface-lowest" accessible={false}>Scrivi al professionista</Text>
        </Pressable>
        <Pressable
          onPress={onDetails}
          className="mt-1 min-h-[44px] flex-row items-center justify-center gap-1 rounded-xl px-3 py-2 active:bg-ch-surface-low"
          accessibilityRole="button"
          accessibilityLabel="Dettagli prenotazione"
        >
          <Text className="shrink text-center text-sm font-medium leading-5 text-ch-secondary" accessible={false}>Dettagli prenotazione</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.secondary} accessible={false} />
        </Pressable>
      </View>
    </View>
  );
}
