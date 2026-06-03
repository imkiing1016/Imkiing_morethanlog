import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "up" | "down" | "warning" | "info";
}

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
    default: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    up: "bg-emerald-500/10 text-emerald-500",
    down: "bg-rose-500/10 text-rose-500",
    warning: "bg-amber-500/10 text-amber-500",
    info: "bg-sky-500/10 text-sky-500",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
