/** Shared vector master for the approved CleanHome "Casa" identity. */
export const BrandColor = {
  background: "#063C2F",
  foreground: "#F6F5EF",
  mint: "#3DDC97",
} as const;

/** Pure SVG data, also consumed by the native icon export script. */
export const BRAND_MARK = {
  viewBox: "0 0 256 256",
  width: 256,
  height: 256,
  housePath:
    "M128 10C132.5 10 136.7 11.5 140.2 14.3L232.4 87.9C239.7 93.7 244 102.6 244 111.9V214C244 229.5 231.5 242 216 242H188V148C188 141.2 184.9 134.8 179.6 130.6L138 97.5C132.2 92.9 123.8 92.9 118 97.5L76.4 130.6C71.1 134.8 68 141.2 68 148V242H40C24.5 242 12 229.5 12 214V111.9C12 102.6 16.3 93.7 23.6 87.9L115.8 14.3C119.3 11.5 123.5 10 128 10Z",
  doorPath:
    "M134 155.5L163.3 138.3C169.8 134.5 178 139.2 178 146.7V234.5C178 240 172.6 243.8 167.4 242.1L135.5 231.5C130.4 229.8 127 225.1 127 219.7V167.7C127 162.7 129.7 158.1 134 155.5Z",
} as const;

export const SPLASH_MIN_DURATION_MS = 1700;
