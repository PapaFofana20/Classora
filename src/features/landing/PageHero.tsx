import type { ReactNode } from "react";

interface Props {
  title: ReactNode;
  text: string;
  children?: ReactNode;
}

/** En-tête centré des pages publiques secondaires. */
export function PageHero({ title, text, children }: Props) {
  return (
    <section className="mx-auto max-w-[1280px] px-5 pb-10 pt-16 text-center sm:px-8 sm:pt-20">
      <div className="animate-fade-up">
        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">{title}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">{text}</p>
        {children && <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>}
      </div>
    </section>
  );
}