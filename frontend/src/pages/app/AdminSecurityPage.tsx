import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncView } from "@/components/ui/AsyncView";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsync } from "@/hooks/useAsync";
import { getAdminSecurity } from "@/services/admin";
import type { AdminSecurityData } from "@/types";
import { actionLabel, roleLabel } from "@/features/admin/labels";
import { LoginActivityChart } from "@/features/admin/charts";
import { formatDateTime } from "@/utils/format";

function roleTone(role: string): BadgeTone {
  if (role === "superadmin") return "dark";
  if (role === "admin") return "info";
  return "neutral";
}

function alertReason(payload: Record<string, unknown>): string {
  const reason = payload.reason ?? payload.message ?? payload.detail;
  return typeof reason === "string" && reason.trim() ? reason : "Tentative refusée par le contrôle d'accès.";
}

export default function AdminSecurityPage() {
  const state = useAsync(() => getAdminSecurity(), []);

  return (
    <>
      <PageHeader
        title="Sécurité"
        subtitle="Surveillance des accès administratifs, des tentatives bloquées et des actions sensibles"
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/admin/agents" variant="outline" icon="manage_accounts">
              Agents
            </LinkButton>
            <LinkButton to="/admin/supervision/audit" icon="history">
              Journal d'audit
            </LinkButton>
          </div>
        }
      />
      <AsyncView state={state}>{(data) => <Content data={data} />}</AsyncView>
    </>
  );
}

function Content({ data }: { data: AdminSecurityData }) {
  const s = data.summary;
  const recentAlerts = data.alerts.slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          dark
          icon="verified_user"
          label="Agents actifs"
          value={String(s.activeAgents)}
          badge={{ text: `${s.totalAgents} au total`, tone: "neutral" }}
          note={`${s.pendingAgents} en attente · ${s.disabledAgents} désactivé(s)`}
        />
        <StatCard icon="login" label="Connexions (30 j)" value={String(s.logins30)} note={s.lastLoginAt ? `Dernière : ${formatDateTime(s.lastLoginAt)}` : "Aucune connexion enregistrée"} />
        <StatCard
          icon="gpp_bad"
          label="Tentatives bloquées"
          value={String(s.blocked30)}
          badge={s.blockedRate > 0 ? { text: `${s.blockedRate} %`, tone: s.blockedRate > 20 ? "down" : "neutral" } : undefined}
          note="Sur les 30 derniers jours"
        />
        <StatCard icon="speed" label="Limites de débit actives" value={String(s.activeRateLimits)} note="Fenêtres ouvertes sur 15 minutes" />
        <StatCard icon="history" label="Événements journalisés (24 h)" value={String(s.auditEvents24h)} note="Toutes actions confondues" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Activité de connexion sur 14 jours"
            subtitle="Connexions réussies et tentatives refusées, relevées dans le journal d'audit."
            action={<Badge tone={s.blocked30 > 0 ? "warning" : "success"}>{s.blocked30} tentative(s) bloquée(s) / 30 j</Badge>}
          />
          <LoginActivityChart data={data.daily} />
        </Card>

        <Card>
          <CardHeader title="Posture de sécurité" subtitle="Faits observés sur la plateforme." />
          <div className="space-y-2.5">
            <PostureRow
              icon="lock"
              label="Authentification des agents"
              value={s.activeAgents > 0 ? `${s.activeAgents} compte(s) actif(s)` : "Aucun compte actif"}
              tone={s.activeAgents > 0 ? "success" : "warning"}
            />
            <PostureRow
              icon="block"
              label="Tentatives refusées suivies"
              value={s.blocked30 > 0 ? `${s.blocked30} sur 30 jours` : "Aucune"}
              tone={s.blocked30 > 0 ? "warning" : "success"}
            />
            <PostureRow
              icon="hourglass_empty"
              label="Agents en attente de validation"
              value={String(s.pendingAgents)}
              tone={s.pendingAgents > 0 ? "warning" : "success"}
            />
            <PostureRow
              icon="person_off"
              label="Agents désactivés"
              value={String(s.disabledAgents)}
              tone="neutral"
            />
            <PostureRow
              icon="visibility"
              label="Actions sensibles journalisées"
              value={`${data.sensitiveActions.length} sur 30 jours`}
              tone="success"
            />
          </div>
          <div className="mt-4 rounded-2xl bg-mist p-4 text-xs leading-relaxed text-neutral-600">
            Les tentatives bloquées incluent les échecs de mot de passe, les comptes scolaires utilisés sur la console et les agents
            désactivés ou en attente. Chaque refus est conservé dans <code>audit_log</code>.
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Agents administratifs"
          subtitle="Dernière connexion et activité de chacun sur 30 jours."
          action={<LinkButton to="/admin/agents" variant="ghost" size="sm" icon="arrow_forward">Gérer les accès</LinkButton>}
        />
        {data.agents.length === 0 ? (
          <EmptyState icon="group_off" title="Aucun agent" text="Créez un premier agent depuis la page Agents." />
        ) : (
          <Table
            caption="Activité des agents administratifs"
            rows={data.agents}
            rowKey={(agent) => agent.id}
            columns={[
              {
                key: "agent",
                header: "Agent",
                render: (agent) => (
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                      {agent.firstName} {agent.lastName}
                    </p>
                    <p className="text-xs text-neutral-500">
                      <span className="font-mono">{agent.matricule}</span> · {agent.email}
                    </p>
                  </div>
                ),
              },
              {
                key: "role",
                header: "Rôle",
                align: "center",
                render: (agent) => <Badge tone={roleTone(agent.role)}>{roleLabel(agent.role)}</Badge>,
              },
              {
                key: "status",
                header: "Statut",
                align: "center",
                render: (agent) => (
                  <Badge tone={agent.status === "ACTIF" ? "success" : agent.status === "EN_ATTENTE" ? "warning" : "neutral"}>
                    {agent.status === "ACTIF" ? "Actif" : agent.status === "EN_ATTENTE" ? "En attente" : "Désactivé"}
                  </Badge>
                ),
              },
              {
                key: "last",
                header: "Dernière connexion",
                render: (agent) => <span className="whitespace-nowrap text-xs text-neutral-600">{agent.lastLoginAt ? formatDateTime(agent.lastLoginAt) : "Jamais"}</span>,
              },
              { key: "logins", header: "Connexions 30 j", align: "right", render: (agent) => <span className="tabular-nums">{agent.loginCount30}</span> },
              {
                key: "blocked",
                header: "Refus 30 j",
                align: "right",
                render: (agent) => (
                  <span className={agent.blockedCount30 > 0 ? "font-bold tabular-nums text-danger" : "tabular-nums text-neutral-400"}>
                    {agent.blockedCount30}
                  </span>
                ),
              },
            ]}
          />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tentatives d'accès refusées" subtitle="Les 20 derniers refus enregistrés." />
          {recentAlerts.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <Icon name="check_circle" fill className="text-[20px] text-emerald-600" />
              Aucune tentative refusée sur les 30 derniers jours.
            </div>
          ) : (
            <div className="space-y-2">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50/60 p-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-red-100 text-danger">
                    <Icon name="gpp_bad" className="text-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{actionLabel(alert.action)}</p>
                    <p className="text-xs text-neutral-600">{alertReason(alert.payload)}</p>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {alert.actorName ?? "Acteur inconnu"} · {roleLabel(alert.actorRole)} · {formatDateTime(alert.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Limites de débit atteintes" subtitle="Fenêtres actives sur les 15 dernières minutes." />
          {data.rateLimits.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <Icon name="check_circle" fill className="text-[20px] text-emerald-600" />
              Aucune limite de débit atteinte actuellement.
            </div>
          ) : (
            <div className="space-y-2">
              {data.rateLimits.map((limit) => (
                <div key={limit.key} className="flex items-center justify-between gap-3 rounded-xl bg-mist px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-ink">{limit.key}</p>
                    <p className="text-[11px] text-neutral-500">Fenêtre ouverte le {formatDateTime(limit.windowStart)}</p>
                  </div>
                  <Badge tone={limit.count >= 10 ? "danger" : "warning"}>{limit.count} requête(s)</Badge>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-neutral-500">
            Les clés correspondent aux compteurs serveur (agent ou adresse IP). Elles expirent automatiquement.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Actions sensibles récentes"
          subtitle="Modifications d'établissements, d'agents, d'abonnements et de paramètres."
          action={<LinkButton to="/admin/supervision/audit" variant="ghost" size="sm" icon="open_in_new">Ouvrir le journal</LinkButton>}
        />
        {data.sensitiveActions.length === 0 ? (
          <EmptyState icon="shield" title="Aucune action sensible" text="Les opérations à fort impact apparaîtront ici." />
        ) : (
          <Table
            caption="Actions sensibles récentes"
            rows={data.sensitiveActions}
            rowKey={(action) => action.id}
            columns={[
              { key: "date", header: "Date", render: (action) => <span className="whitespace-nowrap text-xs text-neutral-600">{formatDateTime(action.createdAt)}</span> },
              { key: "action", header: "Action", render: (action) => <span className="text-sm font-semibold text-ink">{actionLabel(action.action)}</span> },
              {
                key: "actor",
                header: "Auteur",
                render: (action) => (
                  <div>
                    <p className="text-sm">{action.actorName ?? "Système"}</p>
                    <p className="text-xs text-neutral-500">{roleLabel(action.actorRole)}</p>
                  </div>
                ),
              },
              {
                key: "entity",
                header: "Entité",
                render: (action) => (
                  <div className="min-w-0">
                    <p className="text-sm">{action.entity}</p>
                    <p className="truncate font-mono text-[11px] text-neutral-400">{action.entityId ?? "—"}</p>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

function PostureRow({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: BadgeTone }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-mist px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-forest">
        <Icon name={icon} className="text-[18px]" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium text-neutral-700">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
