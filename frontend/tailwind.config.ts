/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // ── Clinical Precision design tokens ──────────────────────
      colors: {
        // Primary brand (RESQ blue)
        primary: {
          DEFAULT: "#006194",
          hover: "#004b73",
          container: "#007bb9",
        },
        // Navy text
        navy: {
          DEFAULT: "#041b3c",
          secondary: "#3f4850",
        },
        // Surface system
        surface: {
          DEFAULT: "#f9f9ff",
          dim: "#cadaff",
          bright: "#f9f9ff",
          low: "#f1f3ff",
          container: "#e8edff",
          "container-high": "#e0e8ff",
          "container-highest": "#d7e2ff",
        },
        // Teal accent
        teal: {
          DEFAULT: "#00668a",
          accent: "#40c2fd",
        },
        // Outline
        outline: {
          DEFAULT: "#707881",
          variant: "#bfc7d2",
        },
        // Status
        error: {
          DEFAULT: "#ba1a1a",
          container: "#ffdad6",
        },
        success: "#16A34A",
        warning: "#D97706",
      },

      // ── Typography ─────────────────────────────────────────────
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },

      // ── Border radius (small, controlled) ─────────────────────
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },

      // ── Spacing rhythm (8px base) ──────────────────────────────
      spacing: {
        // Custom gutter tokens
        "gutter": "1rem",
        "gutter-desktop": "1.5rem",
      },
    },
  },
  plugins: [],
};
