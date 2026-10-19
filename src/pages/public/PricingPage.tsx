import { CtaSection } from "@/features/landing/CtaSection";
import { FaqSection } from "@/features/landing/FaqSection";
import { Highlight } from "@/features/landing/Highlight";
import { PageHero } from "@/features/landing/PageHero";
import { PriceEstimator } from "@/features/landing/PriceEstimator";
import { PricingSection } from "@/features/landing/PricingSection";

export default function PricingPage() {
  return (
    <>
      <PageHero
        title={
          <>
            Un tarif clair, <Highlight>par élève</Highlight>
          </>
        }
        text="Choisissez la formule adaptée à la taille de votre école. Sans engagement, sans frais d'installation."
      />
      <PricingSection withHeader={false} />
      <PriceEstimator />
      <FaqSection />
      <CtaSection />
    </>
  );
}
