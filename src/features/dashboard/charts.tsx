import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CYCLE_LABELS } from "@/data/school";
import type { AdminStats } from "@/services/statsService";
import type { Cycle } from "@/types";
import { formatCurrency } from "@/utils/format";

export const CYCLE_COLORS: Record<Cycle, string> = { elementaire: "#12a150", moyen: "#0f3d1e", secondaire: "#c6f068" };
const axis = { fontSize: 12, fill: "#6b7280" };
/** Les graphiques ne se recalculent qu'une fois la transition de sidebar termin�e (250 ms). */
export const CHART_DEBOUNCE = 250;

export function PaymentsChart({ data }: { data: AdminStats["paymentsByMonth"] }) {
  return (
    <div className="h-72" role="img" aria-label="Graphique des mensualités attendues et encaissées par mois">
      <ResponsiveContainer width="100%" height="100%" debounce={CHART_DEBOUNCE}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4}>
          <CartesianGrid vertical={false} stroke="#eee" />
          <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} cursor={{ fill: "rgba(198,240,104,0.2)" }} contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 10px 40px -14px rgba(15,61,30,.3)" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="attendu" name="Attendu" fill="#12a150" radius={[20, 20, 20, 20]} barSize={14} />
          <Bar dataKey="encaisse" name="Encaissé" fill="#0f3d1e" radius={[20, 20, 20, 20]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CycleDonut({ data }: { data: AdminStats["byCycle"] }) {
  const items = data.map((d) => ({ name: CYCLE_LABELS[d.cycle], value: d.count, cycle: d.cycle }));
  return (
    <div className="h-56" role="img" aria-label="Répartition des élèves par cycle">
      <ResponsiveContainer width="100%" height="100%" debounce={CHART_DEBOUNCE}>
        <PieChart>
          <Pie data={items} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="#fff" strokeWidth={2}>
            {items.map((i) => (
              <Cell key={i.cycle} fill={CYCLE_COLORS[i.cycle]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `${v} élèves`} contentStyle={{ borderRadius: 16, border: "none" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClassBars({ data }: { data: AdminStats["studentsByClass"] }) {
  return (
    <div className="h-80" role="img" aria-label="Effectif par classe">
      <ResponsiveContainer width="100%" height="100%" debounce={CHART_DEBOUNCE}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#eee" />
          <XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={axis} axisLine={false} tickLine={false} width={64} interval={0} />
          <Tooltip formatter={(v) => `${v} élèves`} cursor={{ fill: "rgba(198,240,104,0.2)" }} contentStyle={{ borderRadius: 16, border: "none" }} />
          <Bar dataKey="effectif" name="Effectif" radius={[0, 20, 20, 0]} barSize={12}>
            {data.map((d) => (
              <Cell key={d.name} fill={CYCLE_COLORS[d.cycle]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
