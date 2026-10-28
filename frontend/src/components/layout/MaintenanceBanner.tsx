import { Icon } from "@/components/ui/Icon";
import { usePlatformStatus } from "@/context/PlatformContext";

/**
 * Bandeau affiché sur toutes les pages (console admin et espace scolaire)
 * quand le mode maintenance est activé dans /admin/parametres.
 */
export function MaintenanceBanner({ className }: { className?: string }) {
  const { status } = usePlatformStatus();
  if (!status.maintenanceMode) return null;

  return (
    <div
      role="status"
      className={`mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 ${className ?? ""}`}
    >
      <Icon name="engineering" fill className="mt-0.5 shrink-0 text-[22px]" />
      <div className="min-w-0">
        <p className="text-sm font-bold">Maintenance en cours</p>
        <p className="mt-0.5 text-sm text-amber-800">
          {status.maintenanceMessage || "Certaines fonctionnalités sont temporairement indisponibles. Les inscriptions sont suspendues."}
        </p>
        <p className="mt-1 text-xs text-amber-700">
          Support :{" "}
          <a className="font-semibold underline" href={`mailto:${status.supportEmail}`}>
            {status.supportEmail}
          </a>
          {status.supportPhone ? ` · ${status.supportPhone}` : ""}
        </p>
      </div>
    </div>
  );
}
