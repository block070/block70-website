import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Block70 primary palette */
        "crypto-blue": "#2A7FFF",
        "crypto-green": "#00FFA3",
        "crypto-orange": "#FF9F43",
        /* Dark mode semantic */
        "b70-bg": "var(--b70-bg)",
        "b70-card": "var(--b70-card)",
        "b70-border": "var(--b70-border)",
        "b70-text": "var(--b70-text)",
        "b70-text-muted": "var(--b70-text-muted)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        "heading-xl": ["2rem", { lineHeight: "2.5rem", fontWeight: "600" }],
        "heading-lg": ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }],
        "heading-md": ["1.125rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        body: ["0.875rem", { lineHeight: "1.25rem" }],
        small: ["0.75rem", { lineHeight: "1rem" }],
        numeric: ["0.875rem", { lineHeight: "1.25rem", fontFamily: "var(--font-jetbrains), monospace" } as { lineHeight: string; fontFamily: string }],
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "6": "24px",
        "8": "32px",
        "12": "48px",
      },
      borderRadius: {
        "b70-sm": "6px",
        "b70-md": "10px",
        "b70-lg": "14px",
        "b70-xl": "18px",
      },
      boxShadow: {
        "b70-card": "0 4px 6px -1px rgb(0 0 0 / 0.15), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        "b70-card-hover": "0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        "b70-glow-blue": "0 0 20px -2px rgb(42 127 255 / 0.3)",
        "b70-glow-green": "0 0 20px -2px rgb(0 255 163 / 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
