import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";

export default function AdminSecurityPage() {
  return (
    <>
      <PageHeader title="Sécurité" subtitle="Supervision de la sécurité et des accès" />
      <Card><CardHeader title="État de sécurité" /><p className="px-6 pb-6 text-sm text-neutral-600">RLS actives, authentification JWT vérifiée.</p></Card>
    </>
  );
}
