import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";

export interface HoverExpandOptions {
  /** Délai d'intention avant déploiement (survol). */
  openDelay?: number;
  /** Délai avant repli, pour tolérer les écarts du pointeur. */
  closeDelay?: number;
}

export interface HoverExpandHandlers {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocusCapture: (event: FocusEvent<HTMLElement>) => void;
  onBlurCapture: (event: FocusEvent<HTMLElement>) => void;
}

export interface HoverExpand {
  expanded: boolean;
  /** Ouverture forcée (menu mobile, modale ouverte depuis la sidebar…). */
  pinned: boolean;
  setPinned: (pinned: boolean) => void;
  handlers: HoverExpandHandlers;
  expand: () => void;
  collapse: () => void;
}

/**
 * Ouverture/repli au survol, sans scintillement :
 * • déploiement après `openDelay` d'intention (parcourt de souris ignoré),
 * • repli après `closeDelay` (écarts du pointeur tolérés),
 * • tout délai en attente est annulé si le pointeur revient,
 * • reste dépliée si un élément de la sidebar a le focus clavier ou si elle est épinglée.
 *
 * pointerenter / pointerleave (et non mouseenter) : fonctionne aussi au stylet.
 * Aucun écouteur de scroll ni de mousemove.
 */
export function useHoverExpand({ openDelay = 120, closeDelay = 250 }: HoverExpandOptions = {}): HoverExpand {
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);

  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);

  // Miroir de l'état courant : les callbacks restent stables et évitent les closures périmées.
  const flags = useRef({ pinned, focusWithin });
  flags.current = { pinned, focusWithin };

  const clearTimers = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    openTimer.current = undefined;
    closeTimer.current = undefined;
  }, []);

  const expand = useCallback(() => {
    clearTimers();
    setExpanded(true);
  }, [clearTimers]);

  const scheduleCollapse = useCallback(() => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => {
      if (!flags.current.pinned && !flags.current.focusWithin) setExpanded(false);
    }, closeDelay);
  }, [clearTimers, closeDelay]);

  const collapse = useCallback(() => {
    clearTimers();
    if (flags.current.pinned || flags.current.focusWithin) return;
    setExpanded(false);
  }, [clearTimers]);

  const onPointerEnter = useCallback(() => {
    clearTimers();
    openTimer.current = window.setTimeout(() => setExpanded(true), openDelay);
  }, [clearTimers, openDelay]);

  const onPointerLeave = useCallback(() => {
    scheduleCollapse();
  }, [scheduleCollapse]);

  const onFocusCapture = useCallback((event: FocusEvent<HTMLElement>) => {
    const target = event.target;
    // Seul le focus Clavier (:focus-visible) maintient la sidebar déployée.
    // Le focus donné par un clic pointeur (navigation par onglet) ne doit pas
    // bloquer le repli programmé, sinon la sidebar reste déployée "plantée".
    if (!(target instanceof Element) || !target.matches(":focus-visible")) {
      // Un clic pointeur supprime un éventuel suivi clavier : la sortie du
      // pointeur redevient seule décisionnaire pour le repli.
      if (flags.current.focusWithin) setFocusWithin(false);
      return;
    }
    clearTimers();
    setFocusWithin(true);
    setExpanded(true);
  }, [clearTimers]);

  const onBlurCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      // Le focus reste dans la sidebar tant qu'il reste sur l'un de ses descendants.
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setFocusWithin(false);
      scheduleCollapse();
    },
    [scheduleCollapse],
  );

  useEffect(() => clearTimers, [clearTimers]);

  return {
    expanded: expanded || pinned,
    pinned,
    setPinned,
    handlers: { onPointerEnter, onPointerLeave, onFocusCapture, onBlurCapture },
    expand,
    collapse,
  };
}