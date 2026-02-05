/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "hc-bg": "var(--hc-bg)",
        "hc-surface": "var(--hc-surface)",
        "hc-surface-variant": "var(--hc-surface-variant)",
        "hc-rail": "var(--hc-rail)",
        "hc-topbar": "var(--hc-topbar)",
        "hc-text": "var(--hc-text)",
        "hc-muted": "var(--hc-muted)",
        "hc-primary": "var(--hc-primary)",
        "hc-on-primary": "var(--hc-on-primary)",
        "hc-danger": "var(--hc-danger)",
        "hc-on-danger": "var(--hc-on-danger)",
        "hc-topbar-glow": "var(--hc-topbar-glow)",
        "hc-topbar-depth": "var(--hc-topbar-depth)",
      },
      borderRadius: {
        "hc-sm": "6px",
        "hc-md": "10px",
        "hc-lg": "16px",
      },
      boxShadow: {
        "hc-card": "0 12px 24px var(--hc-shadow)",
        "hc-elevation": "0 16px 40px var(--hc-shadow)",
        "hc-topbar": "0 12px 30px var(--hc-shadow)",
      },
    },
  },
  plugins: [],
};
