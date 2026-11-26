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
        sidebar: { DEFAULT: "hsl(var(--sidebar))", foreground: "hsl(var(--sidebar-foreground))", muted: "hsl(var(--sidebar-muted))", active: "hsl(var(--sidebar-active))", accent: "hsl(var(--sidebar-accent))" },
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
        // AI robot (AiRobot.jsx): eyes blink now and then, glance side to side while scanning; a beam sweeps its screen.
        blink: { "0%, 92%, 100%": { transform: "scaleY(1)" }, "95%": { transform: "scaleY(0.1)" } },
        look: { from: { transform: "translateX(-3px)" }, to: { transform: "translateX(3px)" } },
        sweep: { from: { left: "0%" }, to: { left: "calc(100% - 2px)" } },
        hop: { "0%, 100%": { transform: "translateY(0)" }, "40%": { transform: "translateY(-8px)" } }, // happy / surprised
        shake: { "0%, 100%": { transform: "translateX(0)" }, "20%, 60%": { transform: "translateX(-3px)" }, "40%, 80%": { transform: "translateX(3px)" } },
        tilt: { from: { transform: "rotate(-7deg)" }, to: { transform: "rotate(7deg)" } }, // thinking
        beam: { from: { transform: "translateX(0)" }, to: { transform: "translateX(60px)" } }, // barcode scan line
        // robot arms (AiRobot.jsx): a happy wave, a magnifier sweeping a file; sparkles pop when something good happens
        wave: { from: { transform: "rotate(-160deg)" }, to: { transform: "rotate(-115deg)" } },
        scanarm: { from: { transform: "rotate(-118deg)" }, to: { transform: "rotate(-78deg)" } },
        pop: { "0%": { transform: "scale(0)", opacity: "0" }, "40%": { transform: "scale(1.25)", opacity: "1" }, "100%": { transform: "scale(0)", opacity: "0" } },
        // Document card (DocumentsPanel): a light runs along the bottom edge while its summary is made.
        "summary-scan": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(300%)" } },
        // Shredder (DocumentsPanel): the page slides down into the slot; strips drop into the bin.
        feed: {
          "0%": { transform: "translateY(-6px)", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { transform: "translateY(50px)", opacity: "1" },
        },
        fall: {
          "0%": { transform: "translateY(0)", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { transform: "translateY(34px)", opacity: "0" },
        },
      },
      animation: {
        blink: "blink 4s ease-in-out infinite",
        look: "look 0.6s ease-in-out infinite alternate",
        sweep: "sweep 1.2s ease-in-out infinite alternate",
        hop: "hop 0.5s ease-out 2",
        shake: "shake 0.5s ease-in-out 1",
        tilt: "tilt 1.6s ease-in-out infinite alternate",
        beam: "beam 0.9s ease-in-out infinite alternate",
        wave: "wave 0.35s ease-in-out 6 alternate",
        scanarm: "scanarm 1.1s ease-in-out infinite alternate",
        pop: "pop 0.9s ease-out 1",
        feed: "feed 1.4s ease-in infinite",
        fall: "fall 0.9s ease-in infinite",
        cut: "spin 0.8s linear infinite", // the shredder's cutter wheels
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
