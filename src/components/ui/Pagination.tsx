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
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
          <button key={p} type="button" aria-current={p === page ? "page" : undefined} onClick={() => onChange(p)} className={cn(btn, p === page ? "bg-forest text-white" : "hover:bg-mist")}>
            {p}
          </button>
        ))}
        <button type="button" className={cn(btn, "hover:bg-mist")} disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Page suivante">
          <Icon name="chevron_right" />
        </button>
      </div>
    </nav>
  );
}
