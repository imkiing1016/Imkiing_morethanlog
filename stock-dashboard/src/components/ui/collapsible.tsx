"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Collapsible({ title, subtitle, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {subtitle ? <span className="text-[11px] text-zinc-500">{subtitle}</span> : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? children : null}
    </div>
  );
}
