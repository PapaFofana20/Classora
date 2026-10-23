import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";
import { Icon } from "./Icon";

export type ButtonVariant = "primary" | "dark" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-lime text-forest hover:bg-[#b8e553] shadow-card",
  dark: "bg-forest text-white hover:bg-forest-600",
  outline: "border border-forest/20 bg-white text-forest hover:bg-lime-soft",
  ghost: "text-forest hover:bg-forest/5",
  danger: "bg-danger text-white hover:bg-red-700",
};
const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-11 px-6 text-sm",
  lg: "min-h-12 px-8 text-base",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  className?: string;
  children?: ReactNode;
}

interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  loading?: boolean;
}

export function Button({ variant, size, icon, className, children, loading, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClasses(variant, size, className)} {...rest}>
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> : icon ? <Icon name={icon} className="text-[20px]" /> : null}
      {children}
    </button>
  );
}

interface LinkButtonProps extends CommonProps {
  to: string;
  "aria-label"?: string;
}

export function LinkButton({ to, variant, size, icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link to={to} className={buttonClasses(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} className="text-[20px]" />}
      {children}
    </Link>
  );
}
