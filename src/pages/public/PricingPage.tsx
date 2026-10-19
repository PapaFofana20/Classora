import { PageHero } from "@/components/layout/PageHero";
import { pageHeroes } from "@/data/pageHeroes";
import { CtaSection } from "@/features/landing/CtaSection";
import { FaqSection } from "@/features/landing/FaqSection";
import { PriceEstimator } from "@/features/landing/PriceEstimator";
import { PricingSection } from "@/features/landing/PricingSection";

export default function PricingPage() {
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
