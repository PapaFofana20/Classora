import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatCurrency } from "@/utils/format";
import { planLimitLabel } from "@/data/plans";
import type { Plan } from "@/types";
import { cn } from "@/utils/cn";

interface Props {
  plan: Plan;
  cycle: "monthly" | "yearly";
  selected: boolean;
  current?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

/** Carte de formule (mensuel / annuel) — utilisée sur /app/abonnement. */
export function PlanCard({ plan, cycle, selected, current, disabled, onSelect }: Props) {
  const price = cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-3xl border-2 p-6 transition-all",
        plan.highlight ? "border-forest bg-forest text-white shadow-soft" : "border-neutral-200 bg-white",
        selected && "ring-4 ring-lime",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-extrabold">{plan.name}</h3>
          <p className={cn("text-sm", plan.highlight ? "text-white/70" : "text-neutral-500")}>{plan.tagline}</p>
        </div>
        {current && <Badge tone={plan.highlight ? "lime" : "dark"}>Formule actuelle</Badge>}
      </div>
      <p className="mt-6 text-4xl font-extrabold tracking-tight">{formatCurrency(price)}</p>
      <p className={cn("text-sm", plan.highlight ? "text-white/70" : "text-neutral-500")}>{cycle === "yearly" ? "par an" : "par mois"}</p>
      <p className={cn("mt-2 inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-bold", plan.highlight ? "bg-white/10 text-white" : "bg-lime-soft text-forest")}>
        <Icon name="groups" className="text-[16px]" />
        {planLimitLabel(plan)}
      </p>
      <ul className="my-6 flex-1 space-y-2.5 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Icon name="check_circle" fill className={cn("mt-0.5 text-[18px]", plan.highlight ? "text-lime" : "text-leaf")} />
            <span className={plan.highlight ? "text-white/90" : "text-neutral-700"}>{f}</span>
          </li>
        ))}
      </ul>
      <Button variant={plan.highlight ? "primary" : "dark"} size="lg" disabled={disabled || current} onClick={onSelect}>
        {current ? "Formule en cours" : `Choisir ${plan.name}`}
      </Button>
    </article>
  );
}