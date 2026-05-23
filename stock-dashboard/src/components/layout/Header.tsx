"use client";

import Link from "next/link";
import { LineChart, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function Header() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("stockhub-theme");
    const preferred =
      stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const isDark = preferred === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("stockhub-theme", next ? "dark" : "light");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="rounded-lg bg-gradient-to-br from-violet-500 to-emerald-500 p-1.5">
            <LineChart className="h-4 w-4 text-white" />
          </span>
          <span className="text-sm font-semibold tracking-tight">StockHub</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="테마 전환">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
