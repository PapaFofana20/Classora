import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="Paramètres généraux" subtitle="Configuration de la console d'administration" />
      <Card><CardHeader title="Préférences administratives" /><p className="px-6 pb-6 text-sm text-neutral-600">Paramètres à configurer selon les besoins.</p></Card>
    </>
  );
}
