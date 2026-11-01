import React, { memo, useCallback, useMemo } from "react";
import { Alert, FlatList, Linking, Text, View, type ListRenderItemInfo } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "../ui/AppPressable";
import { Colors } from "../../lib/theme";
import { normalizeCityQuery, type ItalianCity } from "../../lib/citySearch";

interface CitySuggestionsProps {
  query: string;
  cities: readonly ItalianCity[];
  maxHeight: number;
  onSelect: (city: ItalianCity) => void;
}

interface CityRowProps {
  city: ItalianCity;
  onSelect: (city: ItalianCity) => void;
}

const CityRow = memo(function CityRow({ city, onSelect }: CityRowProps) {
  const handlePress = useCallback(() => onSelect(city), [city, onSelect]);
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Cerca a ${city.name}, ${city.province}, ${city.region}`}
      className="min-h-[64px] flex-row items-center gap-3 px-4 py-3 active:bg-ch-surface-low"
    >
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-ch-surface-low">
        <Ionicons name="location-outline" size={20} color={Colors.secondary} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-ch-primary" numberOfLines={1}>
          {city.name}
        </Text>
        <Text className="mt-0.5 text-xs text-ch-on-surface-variant" numberOfLines={1}>
          {city.provinceCode} · {city.province} · {city.region}
        </Text>
      </View>
      <Ionicons name="arrow-forward-outline" size={16} color={Colors.textTertiary} />
    </Pressable>
  );
});

function Separator() {
  return <View className="mx-4 h-px bg-ch-surface-low" />;
}

export const CitySuggestions = memo(function CitySuggestions({
  query,
  cities,
  maxHeight,
  onSelect,
}: CitySuggestionsProps) {
  const listStyle = useMemo(() => ({ maxHeight: Math.max(52, maxHeight - 44) }), [maxHeight]);
  const renderCity = useCallback(
    ({ item }: ListRenderItemInfo<ItalianCity>) => <CityRow city={item} onSelect={onSelect} />,
    [onSelect],
  );
  const keyExtractor = useCallback((city: ItalianCity) => city.id, []);
  const shortQuery = normalizeCityQuery(query).length < 2;
  const openDataLicense = useCallback(() => {
    void Linking.openURL("https://github.com/RP92/comuni-italiani#licenze").catch(() => {
      Alert.alert("Fonti dei dati", "Puoi consultare fonti e licenza su github.com/RP92/comuni-italiani.");
    });
  }, []);

  return (
    <View className="mt-2 overflow-hidden rounded-2xl border border-ch-outline-variant bg-ch-surface-lowest">
      <FlatList
        data={cities}
        renderItem={renderCity}
        keyExtractor={keyExtractor}
        style={listStyle}
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        ListEmptyComponent={
          <View className="flex-row items-center gap-3 px-4 py-4">
            <Ionicons name="search-outline" size={20} color={Colors.textTertiary} />
            <View className="flex-1">
              <Text className="text-sm font-medium text-ch-primary">
                {shortQuery ? "Scrivi almeno due lettere" : "Nessuna città trovata"}
              </Text>
              <Text className="mt-1 text-xs text-ch-on-surface-variant">
                {shortQuery ? "Poi scegli un comune dall’elenco." : "Controlla il nome o premi Cerca per una ricerca libera."}
              </Text>
            </View>
          </View>
        }
      />
      <Pressable
        onPress={openDataLicense}
        accessibilityRole="link"
        accessibilityLabel="Comuni: ISTAT. Apri fonti e licenza dei dati"
        className="min-h-[44px] flex-row items-center justify-between border-t border-ch-surface-low px-4 py-3"
      >
        <Text className="text-xs text-ch-on-surface-variant">Comuni: ISTAT · fonti e licenza</Text>
        <Ionicons name="open-outline" size={14} color={Colors.textTertiary} />
      </Pressable>
    </View>
  );
});
