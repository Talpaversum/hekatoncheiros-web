/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "hc-bg": "var(--hc-bg)",
        "hc-surface": "var(--hc-surface)",
        "hc-border": "var(--hc-border)",
        "hc-text": "var(--hc-text)",
        "hc-muted": "var(--hc-muted)",
        "hc-primary": "var(--hc-primary)",
        "hc-primary-foreground": "var(--hc-primary-foreground)",
        "hc-danger": "var(--hc-danger)",
        "hc-danger-foreground": "var(--hc-danger-foreground)",
      },
      borderRadius: {
        "hc-sm": "6px",
        "hc-md": "10px",
      },
      boxShadow: {
        "hc-card": "0 12px 24px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
