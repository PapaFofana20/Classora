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
import { useToast } from "@/context/ToastContext";
import {
  courseSubject,
  courseTeacher,
  getTimetable,
  listTimetables,
  publishTimetable,
  timetableClassLabel,
  timetableCourseCount,
  type Timetable,
  type TimetableCourse,
} from "@/services/timetableService";

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Brouillon", tone: "warning" },
  published: { label: "Publié", tone: "success" },
};

const DAY_ORDER = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const DAY_LABELS: Record<string, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
};

const formatDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "—");
const formatTime = (time: string) => time.slice(0, 5);

const sortCourses = (courses: TimetableCourse[]) =>
  [...courses].sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    return dayDiff !== 0 ? dayDiff : a.start_time.localeCompare(b.start_time);
  });

export default function TimetableViewPage() {
  const user = useCurrentUser();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [courses, setCourses] = useState<TimetableCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setTimetable(null);
      setCourses([]);

      try {
        if (id) {
          const data = await getTimetable(id);
          if (cancelled) return;
          setTimetable(data.timetable);
          setCourses(sortCourses(data.courses));
        } else {
          const data = await listTimetables(user.schoolId);
          if (cancelled) return;
          setTimetables(data);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Impossible de charger les emplois du temps.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, user.schoolId]);

  const publish = async () => {
    if (!timetable) return;
    setPublishing(true);
    try {
      await publishTimetable(timetable.id);
      setTimetable({ ...timetable, status: "published", published_at: new Date().toISOString() });
      toast("Emploi du temps publié.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Publication impossible.", "error");
    } finally {
      setPublishing(false);
    }
  };

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
                        <p className="text-lg font-bold text-ink">{row.name}</p>
                        <p className="mt-1 text-sm text-neutral-500">{timetableClassLabel(row)}</p>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-neutral-500">
                      {row.school_year} · {timetableCourseCount(row)} cours
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">Créé le {formatDate(row.created_at)}</p>
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

  const columns: Column<TimetableCourse>[] = [
    { key: "day", header: "Jour", render: (course) => DAY_LABELS[course.day] ?? course.day },
    { key: "start", header: "Début", render: (course) => formatTime(course.start_time) },
    { key: "end", header: "Fin", render: (course) => formatTime(course.end_time) },
    { key: "subject", header: "Matière", render: (course) => courseSubject(course) },
    { key: "teacher", header: "Enseignant", render: (course) => courseTeacher(course) },
    { key: "room", header: "Salle", render: (course) => course.room || "Non spécifiée" },
  ];

  return (
    <>
      <PageHeader
        title={timetable?.name ?? "Emploi du temps"}
        subtitle={timetable ? `${timetableClassLabel(timetable)} · ${timetable.school_year}` : undefined}
        actions={
          <>
            <LinkButton to="/app/timetables" variant="outline" icon="arrow_back">
              Retour
            </LinkButton>
            {timetable && user.role === "directeur" && timetable.status !== "published" && (
              <Button icon="publish" loading={publishing} onClick={publish}>
                Publier
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
              <p className="text-sm text-neutral-600">{timetableClassLabel(timetable)}</p>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Année scolaire</dt>
                <dd className="mt-1 text-sm font-medium text-ink">{timetable.school_year}</dd>
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
            <h2 className="mb-4 text-lg font-bold text-ink">Cours</h2>
            {courses.length === 0 ? (
              <p className="rounded-2xl bg-mist p-6 text-sm text-neutral-500">Aucun cours enregistré pour cet emploi du temps.</p>
            ) : (
              <Table columns={columns} rows={courses} rowKey={(course) => course.id} caption={`Cours de ${timetable.name}`} stagger />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
