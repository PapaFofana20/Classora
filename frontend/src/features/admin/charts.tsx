import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminAnalyticsGrowthPoint, AdminFinanceMonthlyPoint } from "@/types";
import { formatCurrency } from "@/utils/format";
import { CHART_DEBOUNCE } from "@/features/dashboard/charts";

const axis = { fontSize: 12, fill: "#6b7280" };
const tooltipStyle = { borderRadius: 16, border: "none", boxShadow: "0 10px 40px -14px rgba(15,61,30,.3)" };

const PLAN_COLORS = ["#0f3d1e", "#12a150", "#c6f068", "#8fb7a1", "#d7e5db"];

/** Revenus encaissés mois par mois (journal des abonnements). */
export function RevenueChart({ data }: { data: AdminFinanceMonthlyPoint[] }) {
  return (
    <div className="h-72" role="img" aria-label="Revenus encaissés sur les douze derniers mois">
      <ResponsiveContainer width="100%" height="100%" debounce={CHART_DEBOUNCE}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
          <YAxis
            tick={axis}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(value))}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value ?? 0))}
            cursor={{ fill: "rgba(198,240,104,0.2)" }}
            contentStyle={tooltipStyle}
          />
          <Bar dataKey="revenue" name="Encaissé" fill="#12a150" radius={[14, 14, 14, 14]} barSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Croissance : nouvelles écoles (barres) et parc cumulé (courbe). */
export function GrowthChart({ data }: { data: AdminAnalyticsGrowthPoint[] }) {
  return (
    <div className="h-80" role="img" aria-label="Croissance des établissements et des effectifs sur douze mois">
      <ResponsiveContainer width="100%" height="100%" debounce={CHART_DEBOUNCE}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="newSchools" name="Nouvelles écoles" fill="#c6f068" radius={[10, 10, 10, 10]} barSize={18} />
          <Bar yAxisId="left" dataKey="newStudents" name="Nouveaux élèves" fill="#12a150" radius={[10, 10, 10, 10]} barSize={18} />
          <Line yAxisId="right" type="monotone" dataKey="totalSchools" name="Parc cumulé" stroke="#0f3d1e" strokeWidth={3} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Répartition des écoles par cycle. */
export function CycleShareChart({ data }: { data: Array<{ cycle: string; label: string; schools: number }> }) {
  const items = data.filter((d) => d.schools > 0);
  if (items.length === 0) return <p className="py-10 text-center text-sm text-neutral-500">Aucun cycle renseigné.</p>;
  return (
    <div className="h-64" role="img" aria-label="Répartition des établissements par cycle">
      <ResponsiveContainer width="100%" height="100%" debounce={CHART_DEBOUNCE}>
        <PieChart>
          <Pie data={items} dataKey="schools" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="#fff" strokeWidth={2}>
            {items.map((item, index) => (
              <Cell key={item.cycle} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value} établissement(s)`} contentStyle={tooltipStyle} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Connexions et tentatives bloquées sur 14 jours. */
export function LoginActivityChart({ data }: { data: Array<{ label: string; logins: number; blocked: number }> }) {
  return (
    <div className="h-64" role="img" aria-label="Connexions administratives et tentatives bloquées sur quatorze jours">
      <ResponsiveContainer width="100%" height="100%" debounce={CHART_DEBOUNCE}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="logins" name="Connexions" fill="#0f3d1e" radius={[8, 8, 8, 8]} barSize={12} />
          <Bar dataKey="blocked" name="Bloquées" fill="#dc2626" radius={[8, 8, 8, 8]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
