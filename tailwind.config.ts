import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        zblack: "#000000",
        obsidian: {
          DEFAULT: "#050508",
          card: "#09090e",
          elevated: "#0f1017",
          border: "rgba(255, 255, 255, 0.10)",
          highlight: "rgba(255, 255, 255, 0.20)",
        },
        cyber: {
          cyan: "#00f0ff",
          azure: "#0077fe",
          emerald: "#00f59b",
          purple: "#a855f7",
          glow: "rgba(0, 240, 255, 0.35)",
        },
        brand: {
          50: "#eefbf4",
          100: "#d6f5e3",
          200: "#b0eacb",
          300: "#7cdaad",
          400: "#46c48a",
          500: "#24a970",
          600: "#17895a",
          700: "#136d4a",
          800: "#12573c",
          900: "#104833",
          950: "#07281d",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.08)",
        "glass-dark": "0 8px 32px rgba(0, 0, 0, 0.4)",
        glow: "0 1px 3px rgba(0, 0, 0, 0.2)",
        "glow-lg": "0 4px 12px rgba(0, 0, 0, 0.3)",
        "glow-cyan": "0 2px 8px rgba(56, 189, 248, 0.15)",
        "glow-emerald": "0 2px 8px rgba(16, 185, 129, 0.15)",
        "skeuo-btn": "0 1px 2px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        "skeuo-card": "0 10px 30px -10px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        "skeuo-well": "inset 0 1.5px 3px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "fade-up": "fadeUp 0.5s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        shimmer: "shimmer 2s infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { transform: "translateX(-10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
