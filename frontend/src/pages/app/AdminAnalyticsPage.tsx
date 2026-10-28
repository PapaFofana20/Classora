import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";

export default function AdminAnalyticsPage() {
  return (
    <>
      <PageHeader title="Analyses et statistiques" subtitle="Croissance, abonnements, performance commerciale" />
      <Card><CardHeader title="Statistiques globales" /><p className="px-6 pb-6 text-sm text-neutral-600">Tableau d'analyse en cours d'implémentation.</p></Card>
    </>
  );
}
