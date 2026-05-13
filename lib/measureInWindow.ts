/**
 * measureInWindow.ts
 *
 * Utility to get the absolute on-screen position of a React Native View ref.
 *
 * Problem: `onLayout` returns coordinates relative to the *parent* View.
 * When a component lives inside a ScrollView, SafeAreaView, or any nested
 * container, the `y` from onLayout is NOT the screen-absolute `y` that the
 * Modal-based CoachMarkOverlay needs.
 *
 * Solution: `View.measureInWindow(callback)` always returns coordinates
 * relative to the device screen — exactly what the overlay needs.
 *
 * Usage:
 *   const ref = useRef<View>(null);
 *   const rect = await measureInWindow(ref);
 *   // rect = { x, y, width, height } in screen coordinates
 */

import { type RefObject } from "react";
import { View } from "react-native";
import type { CoachMarkRect } from "../components/CoachMarks/CoachMarkOverlay";

/**
 * Returns the screen-absolute bounding rect of a View ref.
 * Resolves to `null` if the ref is not yet mounted.
 */
export function measureInWindow(
  ref: RefObject<View | null>
): Promise<CoachMarkRect | null> {
  return new Promise((resolve) => {
    if (!ref.current) {
      resolve(null);
      return;
    }
    ref.current.measureInWindow((x, y, width, height) => {
      if (width === 0 && height === 0) {
        // View is mounted but has zero size — not ready yet
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

/**
 * Measures all refs in a single async pass and returns the results in the
 * same order. Any unmounted ref resolves to `null`.
 */
export async function measureAllInWindow(
  refs: RefObject<View | null>[]
): Promise<(CoachMarkRect | null)[]> {
  return Promise.all(refs.map(measureInWindow));
}
