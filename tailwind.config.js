/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      // Every colour reads a CSS variable from app/globals.css, so the theme lives in one place.
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        sidebar: { DEFAULT: "hsl(var(--sidebar))", foreground: "hsl(var(--sidebar-foreground))", muted: "hsl(var(--sidebar-muted))", active: "hsl(var(--sidebar-active))" },
        glow: "hsl(var(--glow))",
      },
      // AI motion. Every use also gets motion-reduce:animate-none.
      keyframes: {
        scan: { "0%, 100%": { top: "0%" }, "50%": { top: "calc(100% - 2px)" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-4px)" } },
        dash: { to: { strokeDashoffset: "-20" } },
        glow: {
          "0%, 100%": { boxShadow: "0 0 0 3px hsl(var(--glow) / 0.2), 0 0 16px hsl(var(--glow) / 0.2)" },
          "50%": { boxShadow: "0 0 0 3px hsl(var(--glow) / 0.35), 0 0 32px hsl(var(--glow) / 0.45)" },
        },
      },
      animation: {
        scan: "scan 2.4s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
        float: "float 3s ease-in-out infinite",
        dash: "dash 1s linear infinite",
        glow: "glow 2s ease-in-out infinite",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
