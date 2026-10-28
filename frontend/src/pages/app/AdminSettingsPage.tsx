import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="Paramètres généraux" subtitle="Configuration de la console d'administration Classora" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Préférences administratives" subtitle="Paramètres généraux de la plateforme" />
          <div className="space-y-4 px-6 pb-6">
            <Switch checked label="Journal d'audit activé" description="Enregistrer toutes les actions sensibles" onChange={() => {}} />
            <Switch checked label="Surveillance des connexions" description="Suivi des sessions administratives" onChange={() => {}} />
            <Switch checked={false} label="Maintenance" description="Mettre la plateforme en mode maintenance" onChange={() => {}} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Sécurité" subtitle="Paramètres de sécurité de la console" />
          <div className="space-y-3 px-6 pb-6 text-sm text-neutral-700">
            <div className="flex items-center justify-between rounded-xl bg-mist p-3"><span>Authentification JWT</span><span className="font-semibold text-forest">Activée</span></div>
            <div className="flex items-center justify-between rounded-xl bg-mist p-3"><span>Politiques RLS</span><span className="font-semibold text-forest">Actives</span></div>
            <div className="flex items-center justify-between rounded-xl bg-mist p-3"><span>Contrôle des rôles</span><span className="font-semibold text-forest">Appliqué</span></div>
          </div>
        </Card>
      </div>
    </>
  );
}
