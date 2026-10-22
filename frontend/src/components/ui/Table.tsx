import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  /** Prevent text overflow — adds min-width: 0 + overflow-wrap: anywhere */
  noTruncate?: boolean;
  /** Format as number with locale (uses Intl.NumberFormat) */
  numeric?: boolean | Intl.NumberFormatOptions;
  /** Shrink factor for flex items (avatar, badge, action) */
  shrink?: number;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  caption: string;
  stagger?: boolean;
}

const aligns = { left: "text-left", right: "text-right", center: "text-center" };

function headerLabel<T>(column: Column<T>): string | null {
  if (typeof column.header === "string" || typeof column.header === "number") return String(column.header);
  return null;
}

function MobileCards<T>({ columns, rows, rowKey, onRowClick, caption, stagger }: TableProps<T>) {
  const contentColumns = columns.filter((column) => column.key !== "go");
  const leadKey = contentColumns.find((column) => column.key !== "sel" && column.key !== "actions" && headerLabel(column))?.key;

  return (
    <div className="space-y-2 md:hidden" role="group" aria-label={caption}>
      {rows.map((row, index) => {
        const interactive = Boolean(onRowClick);
        const delay = stagger ? index * 50 : 0;
        return (
          <div
            key={rowKey(row)}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={
              onRowClick
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
            className={cn(
              "rounded-2xl border border-neutral-100 bg-white p-4 text-sm shadow-card transition stagger-item",
              interactive && "cursor-pointer hover:border-lime hover:bg-lime-pale/40 focus-visible:border-lime focus-visible:outline-none",
            )}
            style={stagger ? { animationDelay: `${delay}ms` } as React.CSSProperties : undefined}
          >
            <div className="space-y-2.5">
              {contentColumns.map((column) => {
                const label = headerLabel(column);
                const content = column.render(row);
                if (column.key === "sel") {
                  return (
                    <div key={column.key} className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Sélection</span>
                      {content}
                    </div>
                  );
                }
                if (column.key === "actions" || (label === null && column.align === "right")) {
                  return (
                    <div key={column.key} className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-3">
                      {content}
                    </div>
                  );
                }
                if (label === null) {
                  return (
                    <div key={column.key} className="flex justify-end">
                      {content}
                    </div>
                  );
                }
                if (column.key === leadKey) {
                  return (
                    <div key={column.key} className="min-w-0">
                      {content}
                    </div>
                  );
                }
                return (
                  <div key={column.key} className="flex items-start justify-between gap-4">
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
                    <div className={cn("min-w-0 text-right", column.noTruncate && "min-w-0 overflow-wrap-anywhere", column.numeric && "tabular-nums", column.shrink !== undefined && `flex-shrink-${column.shrink}`)}>{content}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Table<T>({ columns, rows, rowKey, onRowClick, caption, stagger }: TableProps<T>) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("whitespace-nowrap border-b border-neutral-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500", aligns[c.align ?? "left"], c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === "Enter" ? onRowClick(row) : undefined) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn("group transition-colors stagger-item", onRowClick && "cursor-pointer hover:bg-lime-pale focus-visible:bg-lime-pale")}
                style={stagger ? { animationDelay: `${index * 50}ms` } as React.CSSProperties : undefined}
              >
                {columns.map((c) => {
                  const tdClass = cn("border-b border-neutral-100 px-4 py-3 align-middle", aligns[c.align ?? "left"], c.className, c.noTruncate && "min-w-0 overflow-wrap-anywhere", c.numeric && "tabular-nums", c.shrink !== undefined && `flex-shrink-${c.shrink}`);
                  return <td key={c.key} className={tdClass}>{c.render(row)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MobileCards columns={columns} rows={rows} rowKey={rowKey} onRowClick={onRowClick} caption={caption} stagger={stagger} />
    </>
  );
}
