"use client";

import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** A4 纸面容器 */
export function Paper({ children }: { children: ReactNode }) {
  return <div className="paper">{children}</div>;
}

/** 浅灰标题条 + 细边框内容区；tone="dark" 用于整页唯一的主区块 */
export function Block({
  title,
  meta,
  action,
  children,
  tone = "plain",
  flush = false,
  className,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tone?: "plain" | "dark";
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("paper-block", className)}>
      <div className={cn("paper-block-title", tone === "dark" && "is-dark")}>
        <span className="truncate">{title}</span>
        {meta || action ? (
          <span className="paper-block-meta">
            {meta}
            {action}
          </span>
        ) : null}
      </div>
      <div className={cn("paper-block-body", flush && "is-flush")}>{children}</div>
    </section>
  );
}

/** 一行字段：米色标签格 + 值格 */
export function Line({
  label,
  children,
  className,
  labelWidth,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  labelWidth?: number;
}) {
  return (
    <div className={cn("pc-field", className)}>
      <span className="pc-label" style={labelWidth ? { width: labelWidth } : undefined}>
        {label}
      </span>
      <span className="pc-value">{children}</span>
    </div>
  );
}

/** 资源格：窄标签 + 值，横向排列，多个用 grid 并排 */
export function ResourceBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pc-field">
      <span className="pc-label" style={{ width: 38 }}>
        {label}
      </span>
      <span className="pc-value justify-center gap-1">{children}</span>
    </div>
  );
}

/** 属性格：标签 + 大数值 + 等级强度，底部一行配额 */
export function StatBox({
  label,
  grade,
  strength,
  quota,
  children,
}: {
  label: string;
  grade: string;
  strength: number;
  quota: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="pc-field">
        <span className="pc-label">{label}</span>
        <span className="pc-value justify-between">
          {children}
          <span className="text-[9px] text-[#a1a1aa]">
            {grade} · 强度 {strength}
          </span>
        </span>
      </div>
      <div className="bg-[#fafafa] px-1 py-0.5 text-center text-[9px] leading-tight text-[#71717a]">
        {quota}
      </div>
    </div>
  );
}

/** 纸面步进器：无边框，只有数字与两侧按钮 */
export function PaperStepper({
  value,
  min,
  max,
  onChange,
  size = "sm",
  className,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <button
        type="button"
        aria-label="减少"
        className="paper-step-button"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="h-3 w-3" />
      </button>
      <span
        className={cn(
          "min-w-6 text-center font-semibold tabular-nums",
          size === "md" ? "text-base" : "text-xs",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="增加"
        className="paper-step-button"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="h-3 w-3" />
      </button>
    </span>
  );
}
