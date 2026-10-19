import { Fragment } from "react";
import { Icon } from "./Icon";
import { cn } from "@/utils/cn";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pages = pageCount <= 7 ? Array.from({ length: pageCount }, (_, index) => index + 1) : Array.from(new Set([1, pageCount, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pageCount))).sort((a, b) => a - b);
  const btn = "grid size-11 place-items-center rounded-full text-sm font-semibold transition disabled:opacity-40";

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-neutral-500">
        {from}–{to} sur {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={cn(btn, "hover:bg-mist")} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Page précédente">
          <Icon name="chevron_left" />
        </button>
        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((value, index) => (
            <Fragment key={value}>
              {index > 0 && value - pages[index - 1] > 1 && (
                <span aria-hidden="true" className="grid size-11 place-items-center text-neutral-400">
                  …
                </span>
              )}
              <button
                type="button"
                aria-current={value === page ? "page" : undefined}
                aria-label={`Page ${value}`}
                onClick={() => onChange(value)}
                className={cn(btn, value === page ? "bg-forest text-white" : "hover:bg-mist")}
              >
                {value}
              </button>
            </Fragment>
          ))}
        </div>
        <span className="min-w-20 text-center text-sm font-medium text-neutral-600 sm:hidden">
          {page} / {pageCount}
        </span>
        <button type="button" className={cn(btn, "hover:bg-mist")} disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Page suivante">
          <Icon name="chevron_right" />
        </button>
      </div>
    </nav>
  );
}
