import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  dark?: boolean;
  padded?: boolean;
}

export function Card({ hover, dark, padded = true, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl shadow-card",
        dark ? "bg-forest text-white" : "bg-white",
        padded && "p-5 sm:p-6",
        hover && "transition-all duration-300 hover:-translate-y-1 hover:shadow-soft",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
