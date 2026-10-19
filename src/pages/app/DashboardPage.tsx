import { useCurrentUser } from "@/context/AuthContext";
import { AdminDashboard } from "@/features/dashboard/AdminDashboard";
import { ParentHome } from "@/features/dashboard/ParentHome";
import { StudentHome } from "@/features/dashboard/StudentHome";
import { SurveillantDashboard } from "@/features/dashboard/SurveillantDashboard";
import { TeacherHome } from "@/features/dashboard/TeacherHome";

/** /app : tableau de bord selon le rôle. */
export default function DashboardPage() {
  const user = useCurrentUser();
  switch (user.role) {
    case "directeur":
      return <AdminDashboard />;
    case "econome":
      return <AdminDashboard finance />;
    case "surveillant":
      return <SurveillantDashboard />;
    case "instituteur":
    case "professeur":
      return <TeacherHome />;
    case "eleve":
      return <StudentHome />;
    case "parent":
      return <ParentHome />;
  }
}