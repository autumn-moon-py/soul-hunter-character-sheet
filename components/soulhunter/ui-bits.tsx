"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function QuotaBar({
  label,
  used,
  max,
  detail,
}: {
  label: string;
  used: number;
  max: number;
  detail?: string;
}) {
  const ratio = max <= 0 ? (used > 0 ? 1 : 0) : Math.min(1, used / max);
  const overflow = used > max;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className={cn("tabular-nums", overflow ? "text-destructive" : "text-muted-foreground")}>
          {used} / {max}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", overflow ? "bg-destructive" : "bg-primary")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {detail ? <p className="text-xs leading-tight text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

export function MetaBadge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "outline" | "accent";
}) {
  const styles =
    tone === "outline"
      ? "border-border bg-transparent text-muted-foreground"
      : tone === "accent"
        ? "border-transparent bg-primary text-primary-foreground"
        : "border-transparent bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0 text-xs font-normal leading-5",
        styles,
      )}
    >
      {children}
    </span>
  );
}
