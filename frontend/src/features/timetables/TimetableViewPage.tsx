import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCards, SkeletonTable } from "@/components/ui/Skeleton";
import { Table, type Column } from "@/components/ui/Table";
import { useCurrentUser } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

interface LevelRef {
  label: string | null;
}

interface ClassRoomRef {
  name: string | null;
  levels?: LevelRef[] | null;
}

interface TimetableRow {
  id: string;
  title: string;
  description: string | null;
  class_id: string | null;
  grade_level: string | null;
  period_type: string;
  status: string;
  created_by: string;
  created_at: string;
  published_at: string | null;
  class_rooms?: ClassRoomRef | null;
}

interface SlotRow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  teacher_id: string | null;
  class_room_id: string | null;
  notes: string | null;
}

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Brouillon", tone: "warning" },
  published: { label: "Publié", tone: "success" },
  archived: { label: "Archivé", tone: "neutral" },
};

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const formatDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "—");
const formatTime = (time: string) => time.slice(0, 5);

const classLabel = (timetable: TimetableRow) => {
  const room = timetable.class_rooms;
  const level = room?.levels?.[0]?.label ?? timetable.grade_level;
  if (room?.name && level) return `${room.name} · ${level}`;
  return room?.name ?? level ?? "Classe non spécifiée";
};

export default function TimetableViewPage() {
  const user = useCurrentUser();
  const { id } = useParams<{ id: string }>();

  const [timetables, setTimetables] = useState<TimetableRow[]>([]);
  const [timetable, setTimetable] = useState<TimetableRow | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setTimetable(null);
      setSlots([]);

      if (id) {
        const [{ data: row, error: rowError }, { data: slotRows, error: slotError }] = await Promise.all([
          supabase.from("timetables").select("*, class_rooms(name, levels(label))").eq("id", id).single(),
          supabase.from("timetable_slots").select("*").eq("timetable_id", id).order("day_of_week").order("start_time"),
        ]);

        if (cancelled) return;
        if (rowError) setError(rowError.message);
        else setTimetable(row as TimetableRow);
        if (slotError) setError(slotError.message);
        else setSlots((slotRows ?? []) as SlotRow[]);
      } else {
        const { data, error: listError } = await supabase
          .from("timetables")
          .select("*, class_rooms(name, levels(label))")
          .eq("school_id", user.schoolId)
          .order("created_at", { ascending: false });

        if (cancelled) return;
        if (listError) setError(listError.message);
        else setTimetables((data ?? []) as TimetableRow[]);
      }

      if (!cancelled) setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, user.schoolId]);

  /* ----------------------------- Liste ----------------------------- */
  if (!id) {
    return (
      <>
        <PageHeader
          title="Emplois du temps"
          subtitle="Plannings des classes de l'école"
          actions={
            user.role === "directeur" ? (
              <LinkButton to="/app/timetables/nouveau" icon="add">
                Nouvel emploi du temps
              </LinkButton>
            ) : undefined
          }
        />

        {loading ? (
          <SkeletonCards count={3} className="lg:grid-cols-3" />
        ) : error ? (
          <Card>
            <p className="text-sm text-danger">{error}</p>
          </Card>
        ) : timetables.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Icon name="calendar_month" className="text-4xl text-neutral-300" />
              <p className="font-semibold text-ink">Aucun emploi du temps</p>
              <p className="max-w-sm text-sm text-neutral-500">
                {user.role === "directeur"
                  ? "Créez le premier emploi du temps de votre école."
                  : "Aucun emploi du temps n'a encore été publié pour votre classe."}
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {timetables.map((row) => {
              const status = STATUS[row.status] ?? STATUS.draft;
              return (
                <Link key={row.id} to={`/app/timetables/${row.id}`} className="block">
                  <Card hover className="h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-ink">{row.title}</p>
                        <p className="mt-1 text-sm text-neutral-500">{classLabel(row)}</p>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-4 text-xs text-neutral-500">Créé le {formatDate(row.created_at)}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-forest">
                      Consulter <Icon name="arrow_forward" className="text-[18px]" />
                    </span>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </>
    );
  }

  /* ---------------------------- Détail ----------------------------- */
  const status = timetable ? STATUS[timetable.status] ?? STATUS.draft : STATUS.draft;

  const columns: Column<SlotRow>[] = [
    { key: "day", header: "Jour", render: (slot) => DAYS[slot.day_of_week] ?? "Inconnu" },
    { key: "start", header: "Début", render: (slot) => formatTime(slot.start_time) },
    { key: "end", header: "Fin", render: (slot) => formatTime(slot.end_time) },
    { key: "subject", header: "Matière", render: (slot) => slot.subject || "Non spécifié" },
    { key: "teacher", header: "Enseignant", render: (slot) => slot.teacher_id ?? "Non assigné" },
    { key: "room", header: "Salle", render: (slot) => slot.class_room_id ?? "Non assignée" },
  ];

  return (
    <>
      <PageHeader
        title={timetable?.title ?? "Emploi du temps"}
        subtitle={timetable ? classLabel(timetable) : undefined}
        actions={
          <>
            <LinkButton to="/app/timetables" variant="outline" icon="arrow_back">
              Retour
            </LinkButton>
            {timetable && user.role === "directeur" && (
              <Button
                variant="outline"
                icon="download"
                onClick={() => window.open(`/api/timetables/${timetable.id}/export-pdf`, "blank")}
              >
                Télécharger le PDF
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <SkeletonTable rows={5} />
      ) : error ? (
        <Card>
          <p className="text-sm text-danger">{error}</p>
        </Card>
      ) : !timetable ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Icon name="event_busy" className="text-4xl text-neutral-300" />
            <p className="font-semibold text-ink">Emploi du temps introuvable</p>
            <p className="text-sm text-neutral-500">Il a peut-être été supprimé ou vous n'y avez pas accès.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={status.tone}>{status.label}</Badge>
              {timetable.description && <p className="text-sm text-neutral-600">{timetable.description}</p>}
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Période</dt>
                <dd className="mt-1 text-sm font-medium text-ink">
                  {timetable.period_type === "trimestre" ? "Trimestre" : "Semestre"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Créé le</dt>
                <dd className="mt-1 text-sm font-medium text-ink">{formatDate(timetable.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Publié le</dt>
                <dd className="mt-1 text-sm font-medium text-ink">{formatDate(timetable.published_at)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-bold text-ink">Créneaux</h2>
            {slots.length === 0 ? (
              <p className="rounded-2xl bg-mist p-6 text-sm text-neutral-500">Aucun créneau enregistré pour cet emploi du temps.</p>
            ) : (
              <Table columns={columns} rows={slots} rowKey={(slot) => slot.id} caption={`Créneaux de ${timetable.title}`} stagger />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
