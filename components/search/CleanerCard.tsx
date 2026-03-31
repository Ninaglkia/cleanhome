import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CleanerProfile } from "../../lib/types";
import { Colors } from "../../lib/theme";

interface Props {
  cleaner: CleanerProfile;
  onPress: () => void;
}

function CleanerCard({ cleaner, onPress }: Props) {
  const initials = cleaner.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 16,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Avatar */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: Colors.primary,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Text
            style={{ color: Colors.accent, fontSize: 18, fontWeight: "800" }}
          >
            {initials}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: Colors.text,
                flex: 1,
                marginRight: 8,
              }}
              numberOfLines={1}
            >
              {cleaner.full_name}
            </Text>
            {cleaner.hourly_rate && (
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: Colors.secondary,
                  letterSpacing: -0.3,
                }}
              >
                €{cleaner.hourly_rate}/h
              </Text>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="star" size={13} color={Colors.warning} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: Colors.text,
                marginLeft: 4,
              }}
            >
              {cleaner.avg_rating.toFixed(1)}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: Colors.textTertiary,
                marginLeft: 3,
              }}
            >
              ({cleaner.review_count})
            </Text>

            {cleaner.city && (
              <>
                <View
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 1.5,
                    backgroundColor: Colors.border,
                    marginHorizontal: 8,
                  }}
                />
                <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.textSecondary,
                    marginLeft: 3,
                  }}
                  numberOfLines={1}
                >
                  {cleaner.city}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Services chips */}
      {cleaner.services && cleaner.services.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginTop: 12,
            gap: 6,
          }}
        >
          {cleaner.services.slice(0, 3).map((s) => (
            <View
              key={s}
              style={{
                backgroundColor: Colors.accentLight,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "500",
                  color: Colors.secondary,
                }}
              >
                {s}
              </Text>
            </View>
          ))}
          {cleaner.services.length > 3 && (
            <View
              style={{
                backgroundColor: Colors.surfaceElevated,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "500",
                  color: Colors.textSecondary,
                }}
              >
                +{cleaner.services.length - 3}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Availability indicator */}
      {cleaner.is_available !== undefined && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: Colors.borderLight,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: cleaner.is_available ? Colors.success : Colors.error,
              marginRight: 6,
            }}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "500",
              color: cleaner.is_available ? Colors.success : Colors.error,
            }}
          >
            {cleaner.is_available ? "Disponibile ora" : "Non disponibile"}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default memo(CleanerCard);
