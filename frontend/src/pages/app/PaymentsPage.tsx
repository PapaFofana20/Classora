import { useCurrentUser } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useChild } from "@/context/ChildContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { FinancePayments } from "@/features/payments/FinancePayments";
import { ParentPayments } from "@/features/payments/ParentPayments";

export default function PaymentsPage() {
  const user = useCurrentUser();
  const { schoolName } = useSchool();
  const { activeChild } = useChild();
  const isParent = user.role === "parent";
  const isStudent = user.role === "eleve";
  return (
    <>
      <PageHeader
        title="Paiements"
        subtitle={
          isStudent
            ? "Votre échéancier · paiement Wave, Orange Money ou Free Money"
            : isParent
              ? `Échéancier de ${activeChild ? activeChild.firstName : "vos enfants"} · Wave, Orange Money, Free Money`
              : "Échéanciers, encaissements, relances et reçus · 2026-2027"
        }
      />
      {isParent ? (
        <ParentPayments schoolName={schoolName} />
      ) : isStudent ? (
        <ParentPayments schoolName={schoolName} self />
      ) : (
        <FinancePayments schoolName={schoolName} canAct={user.role === "econome" || user.role === "directeur"} />
      )}
    </>
  );
}