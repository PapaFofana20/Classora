import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";
import { Icon } from "./Icon";

interface FieldProps {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: string;
}

type InputProps = FieldProps & InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, icon, className, id, ...rest }, ref) {
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
        {icon && <Icon name={icon} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-forest/50" />}
        <input
          ref={ref}
          id={fid}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
          className={cn(
            "min-h-12 w-full rounded-2xl border bg-white px-4 text-sm text-ink placeholder:text-neutral-400 transition focus:border-forest focus:outline-none focus:ring-4 focus:ring-lime/50 disabled:bg-mist disabled:text-neutral-500",
            icon && "pl-11",
            error ? "border-danger" : "border-neutral-300",
          )}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${fid}-err`} role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
          <Icon name="error" className="text-[16px]" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${fid}-hint`} className="mt-1.5 text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

type TextareaProps = FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ label, error, hint, className, id, ...rest }: TextareaProps) {
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
      <textarea
        id={fid}
        aria-invalid={!!error || undefined}
        className={cn(
          "min-h-28 w-full rounded-2xl border bg-white p-4 text-sm text-ink placeholder:text-neutral-400 transition focus:border-forest focus:outline-none focus:ring-4 focus:ring-lime/50",
          error ? "border-danger" : "border-neutral-300",
        )}
        {...rest}
      />
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}
