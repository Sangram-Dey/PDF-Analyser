"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "sourcework-theme"; // also read by the theme script in app/layout.js

// Switches between the dark "lab" theme and the light "reading room" theme (both in app/globals.css).
// The theme lives on <html data-theme>; the choice is remembered in this browser.
export function ThemeToggle() {
  const [theme, setTheme] = useState(null); // null until mounted: the server can't know the theme

  useEffect(() => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark"), [theme]);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked (private window): the switch still works for this visit
    }
    setTheme(next);
  }

  const label = theme === "light" ? "Switch to dark mode" : "Switch to light mode";
  return (
    <Button
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      onClick={toggle}
      disabled={!theme}
      className="shrink-0 text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground"
    >
      {theme === "light" ? <Moon /> : <Sun />}
    </Button>
  );
}
