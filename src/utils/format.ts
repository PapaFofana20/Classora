export function formatCurrency(amount: number): string {
  const n = Math.round(amount);
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")}\u00A0FCFA`;
}

export function formatNumber(n: number, digits = 2): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

/** ISO (AAAA-MM-JJ…) → JJ/MM/AAAA */
export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso: string): string {
  const time = iso.length > 10 ? iso.slice(11, 16).replace(":", " h ") : "";
  return `${formatDate(iso)}${time ? " · " + time : ""}`;
}

export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const text = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** JJ/MM/AAAA saisi → ISO, ou null si invalide */
export function parseFrDate(value: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) return null;
  return `${y}-${mo}-${d}`;
}

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}

export function ageFrom(iso: string, todayIso: string): number {
  const b = new Date(iso);
  const t = new Date(todayIso);
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age -= 1;
  return age;
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

/** Numéro sénégalais : 7X XXX XX XX */
export function isValidSnPhone(v: string): boolean {
  return /^(\+221)?\s?7[0678]\s?\d{3}\s?\d{2}\s?\d{2}$/.test(v.trim());
}
