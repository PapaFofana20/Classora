import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "@/utils/cn";
import { Icon } from "./Icon";

export interface Option {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  error?: string | null;
  options: Option[];
  placeholder?: string;
  compact?: boolean;
}

export function Select({ label, error, options, placeholder, compact, className, id, ...rest }: SelectProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={fid} className="mb-1.5 block text-sm font-semibold text-ink">
          {label}
          {rest.required && <span className="text-danger"> *</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={fid}
          aria-invalid={!!error || undefined}
          className={cn(
            "w-full appearance-none rounded-2xl border bg-white pl-4 pr-10 text-sm text-ink transition focus:border-forest focus:outline-none focus:ring-4 focus:ring-lime/50 disabled:bg-mist",
            compact ? "min-h-11" : "min-h-12",
            error ? "border-danger" : "border-neutral-300",
          )}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-forest/60" />
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
