import { Icon } from "@/components/ui/Icon";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_PARENT_CODES } from "@/data/users";

interface Props {
  onPick: (email: string, password: string) => void;
  disabled?: boolean;
  pendingEmail?: string | null;
}

/** Boutons « Compte démo » : un par rôle, avec l'école associée. */
export function DemoAccounts({ onPick, disabled, pendingEmail }: Props) {
  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
        <span className="h-px flex-1 bg-neutral-200" />
        Comptes démo · mot de passe {DEMO_PASSWORD}
        <span className="h-px flex-1 bg-neutral-200" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {DEMO_ACCOUNTS.map((a) => {
          const hint = a.role === "parent" && DEMO_PARENT_CODES.length ? `Codes enfants : ${DEMO_PARENT_CODES.join(", ")}` : a.hint;
          return (
            <button
              key={a.email}
              type="button"
              disabled={disabled}
              onClick={() => onPick(a.email, DEMO_PASSWORD)}
              title={`${a.email} — ${a.schoolName}`}
              className="group flex min-h-14 items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left transition hover:border-forest hover:bg-lime-pale disabled:opacity-60"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime-soft text-forest group-hover:bg-lime">
                {pendingEmail === a.email ? <span className="size-4 animate-spin rounded-full border-2 border-forest border-t-transparent" /> : <Icon name={a.icon} fill className="text-[20px]" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{a.label}</span>
                <span className="block truncate text-xs text-neutral-500">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
