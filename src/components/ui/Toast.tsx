import { cn } from "@/utils/cn";
import { Icon } from "./Icon";

export type ToastTone = "success" | "error" | "info";
export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const styles: Record<ToastTone, { box: string; icon: string }> = {
  success: { box: "bg-forest text-white", icon: "check_circle" },
  error: { box: "bg-danger text-white", icon: "error" },
  info: { box: "bg-white text-forest border border-forest/10", icon: "info" },
};

interface Props {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}

export function ToastViewport({ items, onDismiss }: Props) {
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-toast flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6" aria-live="polite" role="status">
      {items.map((t) => (
        <div key={t.id} className={cn("pointer-events-auto flex max-w-md animate-toast items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-soft", styles[t.tone].box)}>
          <Icon name={styles[t.tone].icon} fill className={t.tone === "success" ? "text-lime" : ""} />
          <span>{t.message}</span>
          <button type="button" onClick={() => onDismiss(t.id)} aria-label="Fermer la notification" className="-mr-2 grid size-9 place-items-center rounded-full hover:bg-white/10">
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
      ))}
    </div>
  );
}
