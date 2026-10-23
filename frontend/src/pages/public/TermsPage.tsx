import { cgu } from "@/data/legal";
import { LegalPage } from "@/pages/public/LegalPage";

export default function TermsPage() {
  return <LegalPage doc={cgu} />;
}
