/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#8B5CF6",
        secondary: "#C084FC",
        success: "#34D399",
        warning: "#FBBF24",
        danger: "#F472B6",
        background: "#0c0a14",
        card: "#1a1528",
      },
      boxShadow: {
        "glow-sm": "0 0 12px rgba(192, 132, 252, 0.35)",
        "glow-md": "0 0 24px rgba(192, 132, 252, 0.25)",
        "card-soft": "0 8px 32px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(167, 139, 250, 0.08)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
