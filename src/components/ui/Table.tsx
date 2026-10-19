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

export function Table<T>({ columns, rows, rowKey, onRowClick, caption }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
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
  );
}
