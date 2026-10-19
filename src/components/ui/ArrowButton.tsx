import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";
import { Icon } from "./Icon";

type Tone = "lime" | "forest" | "white";

const shell: Record<Tone, string> = {
  lime: "bg-lime text-forest hover:bg-[#b8e553]",
  forest: "bg-forest text-white hover:bg-forest-600",
  white: "bg-white text-forest hover:bg-lime-soft border border-forest/10",
};
const circle: Record<Tone, string> = {
  lime: "bg-forest text-lime",
  forest: "bg-lime text-forest",
  white: "bg-forest text-lime",
};

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  tone?: Tone;
  to?: string;
  className?: string;
  children: ReactNode;
  icon?: string;
}

/** Bouton principal : pilule + cercle vert foncé avec flèche ↗. */
export function ArrowButton({ tone = "lime", to, className, children, icon = "arrow_outward", type = "button", ...rest }: Props) {
  const classes = cn(
    "group inline-flex min-h-12 items-center gap-3 rounded-full py-1.5 pl-6 pr-1.5 text-sm font-semibold shadow-card transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
    shell[tone],
    className,
  );
  const inner = (
    <>
      <span>{children}</span>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover:rotate-45", circle[tone])}>
        <Icon name={icon} className="text-[20px]" />
      </span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={classes}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} {...rest}>
      {inner}
    </button>
  );
}
