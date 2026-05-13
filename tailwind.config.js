/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ch: {
          primary: "#022420",
          "primary-container": "#1a3a35",
          secondary: "#006b55",
          "secondary-container": "#82f4d1",
          background: "#f6faf9",
          surface: "#f6faf9",
          "surface-low": "#f0f4f3",
          "surface-lowest": "#ffffff",
          "on-surface": "#181c1c",
          "on-surface-variant": "#414846",
          "outline-variant": "#c1c8c5",
          error: "#ba1a1a",
        },
      },
    },
  },
  plugins: [],
};
