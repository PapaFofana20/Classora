import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  caption: string;
}

const aligns = { left: "text-left", right: "text-right", center: "text-center" };

function headerLabel<T>(column: Column<T>): string | null {
  if (typeof column.header === "string" || typeof column.header === "number") return String(column.header);
  return null;
}

function MobileCards<T>({ columns, rows, rowKey, onRowClick, caption }: TableProps<T>) {
  const contentColumns = columns.filter((column) => column.key !== "go");
  const leadKey = contentColumns.find((column) => column.key !== "sel" && column.key !== "actions" && headerLabel(column))?.key;

  return (
    <div className="space-y-2 md:hidden" role="group" aria-label={caption}>
      {rows.map((row) => {
        const interactive = Boolean(onRowClick);
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
              "rounded-2xl border border-neutral-100 bg-white p-4 text-sm shadow-card transition",
              interactive && "cursor-pointer hover:border-lime hover:bg-lime-pale/40 focus-visible:border-lime focus-visible:outline-none",
            )}
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
                    <div className="min-w-0 text-right">{content}</div>
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

export function Table<T>({ columns, rows, rowKey, onRowClick, caption }: TableProps<T>) {
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
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === "Enter" ? onRowClick(row) : undefined) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn("group transition-colors", onRowClick && "cursor-pointer hover:bg-lime-pale focus-visible:bg-lime-pale")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("border-b border-neutral-100 px-4 py-3 align-middle", aligns[c.align ?? "left"], c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MobileCards columns={columns} rows={rows} rowKey={rowKey} onRowClick={onRowClick} caption={caption} />
    </>
  );
}
