import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/** Apparition au scroll (IntersectionObserver). */
export function Reveal({ children, className, delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={cn("reveal", shown && "in", className)}>
      {children}
    </div>
  );
}
