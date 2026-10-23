import { useEffect, useRef, useState } from "react";

interface CounterProps {
  value: string;
  label: string;
  duration?: number;
  delay?: number;
}

function parseTarget(value: string): number {
  const cleaned = value.replace(/[^\d]/g, "");
  return parseInt(cleaned, 10) || 0;
}

function formatNumber(num: number, originalValue: string): string {
  if (originalValue.includes("K")) {
    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + "K";
  }
  if (originalValue.includes("M")) {
    return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + "M";
  }
  return num.toLocaleString("fr-FR");
}

export function Counter({ value, label, duration = 1500, delay = 0 }: CounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const target = parseTarget(value);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            setTimeout(() => {
              const startTime = performance.now();
              const animate = (now: number) => {
                const progress = Math.min((now - startTime) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.floor(eased * target);
                setDisplayValue(formatNumber(current, value));
                if (progress < 1) {
                  requestAnimationFrame(animate);
                } else {
                  setDisplayValue(value);
                }
              };
              requestAnimationFrame(animate);
            }, delay);
          }
        });
      },
      { threshold: 0.3 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }
    return () => observer.disconnect();
  }, [target, duration, delay, hasAnimated, value]);

  return (
    <div ref={elementRef} className="rounded-2xl bg-lime p-4 text-forest text-center">
      <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">{displayValue}</p>
      <p className="mt-1 text-xs sm:text-sm font-medium text-neutral-600">{label}</p>
    </div>
  );
}