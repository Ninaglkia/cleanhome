import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1a3a35",
          foreground: "#ffffff",
        },
        accent: {
          DEFAULT: "#4fc4a3",
          foreground: "#1a3a35",
        },
        background: "#f0f4f3",
        card: {
          DEFAULT: "#ffffff",
          foreground: "#1a3a35",
        },
        error: "#e53e3e",
        warning: "#f6ad55",
        success: "#38a169",
        muted: {
          DEFAULT: "#e2e8e6",
          foreground: "#6b7c78",
        },
        border: "#d1dbd8",
      },
      borderRadius: {
        xl: "20px",
        "2xl": "24px",
      },
      fontFamily: {
        serif: ["var(--font-dm-serif)", "serif"],
        sans: ["var(--font-dm-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
