import { useState } from "react";
import { AsyncView } from "@/components/ui/AsyncView";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useCurrentUser } from "@/context/AuthContext";
import { CoefficientsTab, FeesTab } from "@/features/settings/PricingTabs";
import { CyclesTab, PeriodsTab, ProfileTab, SchoolTab, SubjectsTab } from "@/features/settings/SettingsTabs";
import { useAsync } from "@/hooks/useAsync";
import { getSchoolOverview } from "@/services/schoolService";

const TABS = [
  { id: "ecole", label: "École", icon: "domain" },
  { id: "cycles", label: "Cycles", icon: "stairs" },
  { id: "periodes", label: "Périodes", icon: "date_range" },
  { id: "matieres", label: "Matières", icon: "menu_book" },
  { id: "coefficients", label: "Coefficients", icon: "balance" },
  { id: "tarifs", label: "Tarifs", icon: "sell" },
];

export default function SettingsPage() {
  const user = useCurrentUser();
  const state = useAsync(() => getSchoolOverview(user.schoolId), [user.schoolId]);
  const [tab, setTab] = useState("ecole");

  if (user.role !== "directeur")
    return (
      <>
        <PageHeader title="Mon profil" subtitle="Vos informations de compte." />
        <ProfileTab />
      </>
    );

  return (
    <>
      <PageHeader title="Paramètres" subtitle="École, cycles, périodes, matières, coefficients et tarifs." />
      <Tabs className="mb-4" label="Sections des paramètres" items={TABS} value={tab} onChange={setTab} />
      <AsyncView state={state} skeleton={<Skeleton className="h-80 w-full" />}>
        {(o) => (
          <div key={tab}>
            {tab === "ecole" && <SchoolTab overview={o} onSaved={state.reload} />}
            {tab === "cycles" && <CyclesTab overview={o} onSaved={state.reload} />}
            {tab === "periodes" && <PeriodsTab overview={o} onSaved={state.reload} />}
            {tab === "matieres" && <SubjectsTab overview={o} onSaved={state.reload} />}
            {tab === "coefficients" && <CoefficientsTab overview={o} onSaved={state.reload} />}
            {tab === "tarifs" && <FeesTab overview={o} onSaved={state.reload} />}
          </div>
        )}
      </AsyncView>
    </>
  );
}
