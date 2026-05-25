import typography from "@tailwindcss/typography";

const config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      animation: {
        "pulse-slow": "pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite"
      },
      colors: {
        "bg-base": "var(--bg-base)",
        "bg-sidebar": "var(--bg-sidebar)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-input": "var(--bg-input)",
        hover: "var(--hover)",
        border: "var(--border)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)"
      },
      backgroundImage: {
        "gradient-accent": "var(--gradient-accent)"
      },
      fontFamily: {
        sans: ["Geist", "Inter", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: [typography]
};

export default config;
