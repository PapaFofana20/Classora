import { Avatar } from "@/components/ui/Brand";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PaymentRow } from "@/services/paymentRows";
import { formatCurrency, formatDate } from "@/utils/format";
import { PAY_METHOD_LABELS } from "@/utils/payments";

export function LatestPayments({ rows }: { rows: PaymentRow[] }) {
  if (rows.length === 0) return <EmptyState icon="receipt_long" title="Aucun paiement récent" />;
  return (
    <ul className="divide-y divide-neutral-100">
      {rows.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-3">
          <Avatar name={p.studentName} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{p.studentName}</p>
            <p className="truncate text-xs text-neutral-500">
              {p.label} · {p.className}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{formatCurrency(p.paidAmount)}</p>
            <p className="text-xs text-neutral-500">{formatDate(p.paidAt)}</p>
          </div>
          {p.method && <Badge tone="info" className="hidden sm:inline-flex">{PAY_METHOD_LABELS[p.method]}</Badge>}
        </li>
      ))}
    </ul>
  );
}
