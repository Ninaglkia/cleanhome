/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ch: {
          primary: "#063C2F",
          "primary-container": "#1F5E48",
          secondary: "#1F7A5C",
          "secondary-container": "#E3F3EC",
          background: "#F4F6F5",
          surface: "#F4F6F5",
          "surface-low": "#EEF3F1",
          "surface-lowest": "#ffffff",
          "on-surface": "#063C2F",
          "on-surface-variant": "#4F5A55",
          "outline-variant": "#DCE4DF",
          error: "#ba1a1a",
        },
      },
    },
  },
  plugins: [],
};
