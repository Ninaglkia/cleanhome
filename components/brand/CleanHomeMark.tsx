import React, { memo } from "react";
import Svg, { Path } from "react-native-svg";
import { BRAND_MARK, BrandColor } from "../../lib/design/brand";

export interface CleanHomeMarkProps {
  size?: number;
  houseColor?: string;
  doorColor?: string;
}

/** The same two paths are used for the app icon and animated splash. */
export const CleanHomeMark = memo(function CleanHomeMark({
  size = 168,
  houseColor = BrandColor.foreground,
  doorColor = BrandColor.mint,
}: CleanHomeMarkProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={BRAND_MARK.viewBox}
      accessible={false}
    >
      <Path d={BRAND_MARK.housePath} fill={houseColor} />
      <Path d={BRAND_MARK.doorPath} fill={doorColor} />
    </Svg>
  );
});
