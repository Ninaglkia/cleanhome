import Svg, { Circle, Path } from "react-native-svg";
import { Colors } from "../../lib/theme";

export interface CleanerMarkerIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

/** A full walking figure carrying a spray bottle, legible in a 40–44px marker. */
export function CleanerMarkerIcon({
  size = 44,
  color = Colors.textOnDark,
  accentColor = Colors.accent,
}: CleanerMarkerIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none" accessible={false}>
      <Circle cx={21} cy={8} r={4.2} fill={color} />
      {/* Trailing arm, torso and two separate strides. */}
      <Path
        d="M18.1 17.2L12.4 22.7L9.1 21"
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.1 14.5C19.6 13.6 22 13.9 23.2 15.3L26 20.1L24.2 26.8H17.7L16.3 20.3C15.9 18.2 16.4 15.6 18.1 14.5Z"
        fill={color}
      />
      <Path
        d="M19 26.2L15.4 34L8.7 40.8H12.8M23.2 26.2L27.5 32.5L29.1 40.8H33.5"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Forward arm ends at the bottle's neck, separate from the torso. */}
      <Path
        d="M23.4 17L28.3 21.5L33.4 19.1"
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Contrast bottle, trigger and two short spray strokes. */}
      <Path
        d="M34 18.1H37.2V21L39.2 24V29.1C39.2 30.2 38.4 31 37.3 31H33.7C32.6 31 31.8 30.2 31.8 29.1V24L34 21V18.1Z"
        fill={accentColor}
      />
      <Path
        d="M33.5 15H39.3L42 16.5L41.1 18.4H36.5L35.8 20.5H33.5V15Z"
        fill={accentColor}
      />
      <Path
        d="M43.9 13.8L46.1 12.6M44.4 18L46.7 18.5"
        stroke={accentColor}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}
