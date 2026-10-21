import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export type BadgeTone = "success" | "info" | "warning" | "danger" | "neutral" | "lime" | "dark";

const tones: Record<BadgeTone, string> = {
  success: "bg-emerald-100 text-emerald-800",
  info: "bg-sky-100 text-sky-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
  neutral: "bg-neutral-100 text-neutral-700",
  lime: "bg-lime text-forest",
  dark: "bg-forest text-white",
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: string;
  className?: string;
}

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}
