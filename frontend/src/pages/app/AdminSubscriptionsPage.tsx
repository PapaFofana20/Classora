import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

export default function AdminSubscriptionsPage() {
  return (
    <>
      <PageHeader
        title="Abonnements"
        subtitle="Suivi des abonnements gratuits et payants, renouvellements et expirations"
        actions={<LinkButton to="/admin/finances" icon="account_balance_wallet">Voir les finances</LinkButton>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader title="Vue d'ensemble" /><p className="px-6 pb-6 text-sm text-neutral-600">Module abonnements en cours de finalisation. Les données existantes sont consultables via les fiches établissements.</p></Card>
        <Card><CardHeader title="Renouvellements à venir" /><p className="px-6 pb-6 text-sm text-neutral-600">À venir selon les données d'abonnement.</p></Card>
        <Card><CardHeader title="Impayés / anomalies" /><p className="px-6 pb-6 text-sm text-neutral-600">À surveiller.</p></Card>
      </div>
    </>
  );
}
