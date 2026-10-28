import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";

export default function AdminAuditPage() {
  return (
    <>
      <PageHeader title="Journal d'audit" subtitle="Traçabilité des opérations sensibles" />
      <Card><CardHeader title="Événements récents" /><p className="px-6 pb-6 text-sm text-neutral-600">Journal détaillé à compléter avec les événements disponibles.</p></Card>
    </>
  );
}
