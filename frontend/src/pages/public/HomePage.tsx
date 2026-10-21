import { AboutSection } from "@/features/landing/AboutSection";
import { CtaSection } from "@/features/landing/CtaSection";
import { FaqSection } from "@/features/landing/FaqSection";
import { FeaturesCarousel } from "@/features/landing/FeaturesCarousel";
import { Hero } from "@/features/landing/Hero";
import { LogoStrip } from "@/features/landing/LogoStrip";
import { PricingSection } from "@/features/landing/PricingSection";
import { StepsBento } from "@/features/landing/StepsBento";
import { TestimonialsSection } from "@/features/landing/TestimonialsSection";

export default function HomePage() {
  return (
    <>
      <Hero />
      <LogoStrip />
      <AboutSection />
      <FeaturesCarousel />
      <StepsBento />
      <PricingSection />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
