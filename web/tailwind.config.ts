import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0a0b0d",
          900: "#0c0e11",
          800: "#121519",
          700: "#181c22",
          600: "#22272f",
          500: "#2e3540",
        },
        bone: "#ece6d8",
        mute: "#8a8f99",
        signal: {
          DEFAULT: "#e8b542", // refined amber/gold
          soft: "#f2cd72",
          deep: "#b8821f",
        },
        pitch: "#16321f", // deep field green accent
        conmebol: "#2dd4a7",
        uefa: "#5b8def",
        concacaf: "#e8b542",
        caf: "#e0584f",
        afc: "#a86bd9",
        ofc: "#9aa0a8",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      fontWeight: {
        "300": "300",
        "400": "400",
        "500": "500",
        "600": "600",
        "700": "700",
        "800": "800",
        "900": "900",
      },
    },
  },
  plugins: [],
};
export default config;
