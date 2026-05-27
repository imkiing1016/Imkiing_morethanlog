"use client";

import Link from "next/link";
import { LineChart, Moon, Sun, GitCompare } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "./SearchBar";

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
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="rounded-lg bg-gradient-to-br from-violet-500 to-emerald-500 p-1.5">
            <LineChart className="h-4 w-4 text-white" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">StockHub</span>
        </Link>
        <div className="flex flex-1 justify-center">
          <SearchBar />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/compare"
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            aria-label="종목 비교"
          >
            <GitCompare className="h-3.5 w-3.5" />
            <span className="hidden md:inline">비교</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="테마 전환">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
