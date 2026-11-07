// Donne la valeur « stable » après un délai, pour éviter d'agir à chaque frappe.
import { useEffect, useState } from "react";

// Retarde la propagation d'une valeur pour ne pas déclencher un appel à chaque touche.
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
