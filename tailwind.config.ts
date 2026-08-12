import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Paleta ejecutiva clara y sutil: dorado champagne, morado sutil FACOP, blanco perla
        gold: {
          DEFAULT: "#C9A961",
          50: "#FBF8EE",
          100: "#F5ECD3",
          200: "#E6D39E",
          300: "#D7B96A",
          400: "#C9A961",
          500: "#B5944B",
          600: "#987A38",
          700: "#755D28",
          800: "#52401B",
          900: "#2F230D",
        },
        executive: {
          bg: "#F8FAFC",
          card: "#FFFFFF",
          border: "#E2E8F0",
          accent: "#4C1D95",
          purple: "#3B154C",
          text: "#1E293B",
          muted: "#64748B",
        },
        brand: {
          purple: "#3B154C",
          plum: "#4A1C5F",
          light: "#F3EFFC",
          glow: "#E9D8A6",
        },
        lilac: {
          DEFAULT: "#B19CD9",
          50: "#F8F5FC",
          100: "#EAE2F6",
          200: "#D6C6EE",
          300: "#C2A9E5",
          400: "#B19CD9",
          500: "#9A7EC9",
          600: "#7E5DB4",
          700: "#604390",
          800: "#412D63",
          900: "#251A38",
        },
        ink: {
          DEFAULT: "#0F0F0F",
          900: "#0F0F0F",
          800: "#1F1F1F",
          700: "#2D2D2D",
          600: "#3D3D3D",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;


