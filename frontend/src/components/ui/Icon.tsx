import { cn } from "@/utils/cn";

interface IconProps {
  name: string;
  className?: string;
  fill?: boolean;
  size?: number;
}

/** Google Material Symbols (Rounded). */
export function Icon({ name, className, fill, size }: IconProps) {
  return (
    <span aria-hidden="true" className={cn("material-symbols-rounded", fill && "fill", className)} style={size ? { fontSize: size } : undefined}>
      {name}
    </span>
  );
}
