import { PageHero } from "@/components/layout/PageHero";
import { pageHeroes } from "@/data/pageHeroes";
import { CtaSection } from "@/features/landing/CtaSection";
import { FaqSection } from "@/features/landing/FaqSection";
import { PriceEstimator } from "@/features/landing/PriceEstimator";
import { PricingSection } from "@/features/landing/PricingSection";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function PricingPage() {
  usePageMeta({
    title: "Tarifs et offres scolaires",
    description:
      "Un tarif clair, calculé par élève : formules Essentiel et Premium avec estimateur en ligne. Découvrez le budget pour votre école privée.",
    path: "/tarifs",
  });
  return (
    <>
      <PageHero {...pageHeroes.tarifs} />
      <PricingSection withHeader={false} />
      <PriceEstimator />
      <FaqSection />
      <CtaSection />
    </>
  );
}
