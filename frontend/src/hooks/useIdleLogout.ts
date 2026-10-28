import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

/**
 * Déconnexion automatique après une période d'inactivité.
 * Le délai est configuré dans /admin/parametres (session_timeout_minutes).
 */
export function useIdleLogout(timeoutMinutes: number, onTimeout: () => void) {
  const callback = useRef(onTimeout);
  callback.current = onTimeout;

  useEffect(() => {
    const minutes = Number(timeoutMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return;

    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback.current(), minutes * 60_000);
    };

    schedule();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, schedule, { passive: true });
    }
    return () => {
      window.clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, schedule);
      }
    };
  }, [timeoutMinutes]);
}
