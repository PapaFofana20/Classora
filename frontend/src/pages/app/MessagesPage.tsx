import { useState } from "react";
import { AsyncView } from "@/components/ui/AsyncView";
import { Avatar } from "@/components/ui/Brand";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useCurrentUser } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { counterpartName, Thread } from "@/features/messages/Thread";
import { NewMessageModal } from "@/features/messages/NewMessageModal";
import { useAsync } from "@/hooks/useAsync";
import { listAnnouncements, listContacts, listConversations, postAnnouncement } from "@/services/messageService";
import type { Role } from "@/types";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/format";

export default function MessagesPage() {
  const user = useCurrentUser();
  const { toast } = useToast();
  const hasConversations = user.role === "directeur" || user.role === "instituteur" || user.role === "professeur" || user.role === "parent" || user.role === "eleve";
  const canCompose = user.role === "instituteur" || user.role === "professeur" || user.role === "parent" || user.role === "eleve";
  const canAnnounce = user.role === "directeur" || user.role === "econome";
  const convs = useAsync(() => listConversations(user), [user.id]);
  const anns = useAsync(() => listAnnouncements(user), [user.id]);
  const contacts = useAsync(() => (canCompose ? listContacts(user) : Promise.resolve([])), [user.id]);
  const [tab, setTab] = useState(hasConversations ? "conv" : "ann");
  const [sel, setSel] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [annOpen, setAnnOpen] = useState(false);
  const [ann, setAnn] = useState({ title: "", body: "", audience: "all" });
  const [busy, setBusy] = useState(false);

  const totalUnread = (convs.data ?? []).reduce((a, c) => a + c.unread, 0);
  const selected = (convs.data ?? []).find((c) => c.id === sel) ?? null;
  const annValid = ann.title.trim().length >= 3 && ann.body.trim().length >= 10;

  const publish = async () => {
    setBusy(true);
    try {
      const audience: Role[] | "all" = ann.audience === "all" ? "all" : ann.audience === "parents" ? ["parent", "eleve", "directeur", "econome"] : ["instituteur", "professeur", "directeur", "econome"];
      await postAnnouncement(user, { title: ann.title, body: ann.body, audience });
      toast("Annonce publiée.");
      setAnnOpen(false);
      setAnn({ title: "", body: "", audience: "all" });
      anns.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Publication impossible.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle={user.role === "directeur" ? "Supervision des échanges parents-enseignants et annonces de l'école." : "Conversations parents-enseignants et annonces de l'école."}
        actions={<>{canCompose && <Button icon="edit" onClick={() => setComposeOpen(true)}>Nouveau message</Button>}{canAnnounce && <Button icon="campaign" variant={canCompose ? "outline" : "primary"} onClick={() => setAnnOpen(true)}>Nouvelle annonce</Button>}</>}
      />
      {hasConversations && <Tabs className="mb-4" label="Messagerie" value={tab} onChange={setTab} items={[{ id: "conv", label: "Conversations", icon: "forum", badge: totalUnread || undefined }, { id: "ann", label: "Annonces", icon: "campaign", badge: anns.data?.length }]} />}

      {tab === "conv" && hasConversations ? (
        <AsyncView state={convs} skeleton={<SkeletonTable rows={5} />}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState icon="forum" title="Aucune conversation" text="Écrivez un premier message pour démarrer un échange." action={canCompose && <Button onClick={() => setComposeOpen(true)}>Nouveau message</Button>} />
            ) : (
              <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
                <div className={cn("space-y-2", selected && "hidden lg:block")}>
                  {list.map((c, index) => {
                    const last = c.messages[c.messages.length - 1];
                    return (
                      <button key={c.id} type="button" onClick={() => setSel(c.id)} aria-current={c.id === sel} className={cn("flex w-full items-center gap-3 rounded-2xl p-4 text-left shadow-card transition stagger-item hover:-translate-y-0.5", c.id === sel ? "bg-lime" : "bg-white")} style={{ animationDelay: `${index * 50}ms` }}>
                        <Avatar name={counterpartName(c, user.role)} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className={cn("truncate text-sm", c.unread ? "font-extrabold" : "font-semibold")}>{counterpartName(c, user.role)}</span>
                            <span className="shrink-0 text-[11px] text-neutral-500">{last ? formatDateTime(last.at).slice(0, 10) : ""}</span>
                          </span>
                          <span className="block truncate text-xs font-semibold text-forest">{c.subject}</span>
                          <span className="block truncate text-xs text-neutral-500">{last?.text}</span>
                        </span>
                        {c.unread > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-danger px-1.5 text-xs font-bold leading-6 text-white" aria-label={`${c.unread} non lu(s)`}>{c.unread}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className={cn(!selected && "hidden lg:block")}>
                  {selected ? <Thread conversation={selected} onBack={() => setSel(null)} onChanged={convs.reload} /> : <EmptyState icon="chat" title="Sélectionnez une conversation" />}
                </div>
              </div>
            )
          }
        </AsyncView>
      ) : (
        <AsyncView state={anns} skeleton={<SkeletonTable rows={4} />}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState icon="campaign" title="Aucune annonce" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {list.map((a) => (
                  <Card key={a.id} hover>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone="lime">{a.author}</Badge>
                      <span className="text-xs text-neutral-500">{formatDateTime(a.at)}</span>
                    </div>
                    <h2 className="text-lg font-bold">{a.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">{a.body}</p>
                  </Card>
                ))}
              </div>
            )
          }
        </AsyncView>
      )}

      <NewMessageModal open={composeOpen} contacts={contacts.data ?? []} onClose={() => setComposeOpen(false)} onCreated={(id) => { setComposeOpen(false); setTab("conv"); setSel(id); convs.reload(); }} />
      <Modal open={annOpen} onClose={() => setAnnOpen(false)} title="Nouvelle annonce" footer={<><Button variant="outline" onClick={() => setAnnOpen(false)}>Annuler</Button><Button variant="dark" disabled={!annValid} loading={busy} onClick={() => void publish()}>Publier</Button></>}>
        <div className="grid gap-4">
          <Input label="Titre" required value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} error={ann.title && ann.title.trim().length < 3 ? "Titre trop court." : null} />
          <Select label="Destinataires" value={ann.audience} onChange={(e) => setAnn({ ...ann, audience: e.target.value })} options={[{ value: "all", label: "Toute l'école" }, { value: "parents", label: "Parents" }, { value: "teachers", label: "Enseignants" }]} />
          <Textarea label="Message" required value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} error={ann.body && ann.body.trim().length < 10 ? "Au moins 10 caractères." : null} />
        </div>
      </Modal>
    </>
  );
}
