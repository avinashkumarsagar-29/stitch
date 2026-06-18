"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "classic";

export default function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("stitch-theme") as Theme;
    if (savedTheme === "light" || savedTheme === "classic") {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      setTheme("light");
      applyTheme("light");
    }
  }, []);

  function applyTheme(newTheme: Theme) {
    const root = document.documentElement;
    root.classList.remove("light", "dark", "classic");
    root.classList.add(newTheme);
    localStorage.setItem("stitch-theme", newTheme);
  }

  function handleCycle() {
    let nextTheme: Theme = "light";
    if (theme === "light") {
      nextTheme = "classic";
    } else if (theme === "classic") {
      nextTheme = "light";
    }
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  // Render a placeholder pill during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-50 border border-slate-100 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 opacity-60"
      >
        <span>☀️</span>
        <span>Light</span>
      </button>
    );
  }

  const emoji = theme === "light" ? "☀️" : "📜";
  const label = theme === "light" ? "Light" : "Classic";

  return (
    <button
      type="button"
      onClick={handleCycle}
      className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-200 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-700 transition-all cursor-pointer"
      aria-label={`Change theme. Current theme: ${label}`}
    >
      <span className="text-xs">{emoji}</span>
      <span>{label}</span>
    </button>
  );
}
