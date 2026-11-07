// Sélecteur préfait pour choisir la période d'évaluation.
import type { Period } from "@/types";
import { Select } from "./Select";

interface Props {
  periods: Period[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

// Raccourci qui mappe les périodes vers les options du Select.
export function PeriodSelect({ periods, value, onChange, className }: Props) {
  return (
    <Select
      compact
      aria-label="Période d'évaluation"
      className={className ?? "w-44"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={periods.map((p) => ({ value: p.id, label: p.label }))}
    />
  );
}
