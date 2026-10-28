import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";

export default function AdminFinancesPage() {
  return (
    <>
      <PageHeader
        title="Finances et revenus"
        subtitle="Chiffre d'affaires, encaissements, factures et prévisions"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard dark icon="payments" label="Revenus encaissés (mois)" value="—" note="En attente de données financières" />
        <StatCard icon="receipt_long" label="Facturé" value="—" note="Non disponible" />
        <StatCard icon="schedule" label="En attente" value="—" note="Non disponible" />
        <StatCard icon="warning" label="Impayés" value="—" note="Non disponible" />
      </div>
      <Card className="mt-4"><CardHeader title="Graphique des revenus" /><p className="px-6 pb-6 text-sm text-neutral-600">Intégration des graphiques selon les données réelles disponibles.</p></Card>
    </>
  );
}
