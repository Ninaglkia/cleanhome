import { forwardRef, useState } from "react";
import {
  Pressable as RNPressable,
  type PressableProps,
  type View,
} from "react-native";

/**
 * Drop-in replacement for React Native's Pressable.
 *
 * NativeWind v4 wraps the core Pressable and silently DROPS style props
 * passed as a function (style={({ pressed }) => ...}): the component
 * renders completely unstyled — no flexDirection, no background, nothing
 * (nativewind/nativewind#1105, #847; fix PR #1383 still unmerged).
 *
 * This wrapper resolves the function style BEFORE it reaches NativeWind's
 * interop layer, tracking the pressed state locally so the visual
 * feedback keeps working. Remove once the upstream fix ships and the
 * dependency is upgraded.
 */
export const Pressable = forwardRef<View, PressableProps>(
  function AppPressable({ style, onPressIn, onPressOut, ...rest }, ref) {
    const [pressed, setPressed] = useState(false);
    const isFnStyle = typeof style === "function";

    return (
      <RNPressable
        ref={ref}
        style={isFnStyle ? style({ pressed }) : style}
        onPressIn={(e) => {
          if (isFnStyle) setPressed(true);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          if (isFnStyle) setPressed(false);
          onPressOut?.(e);
        }}
        {...rest}
      />
    );
  }
);
