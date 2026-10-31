import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { useCurrentUser } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { supabase } from "@/lib/supabase";

interface ClassOption {
  id: string;
  name: string;
  levels?: { label: string | null }[] | null;
}

export default function TimetableCreationPage() {
  const user = useCurrentUser();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [form, setForm] = useState({ title: "", classId: "", periodType: "semestre" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("class_rooms")
        .select("id, name, levels(label)")
        .eq("school_id", user.schoolId)
        .order("name");

      if (cancelled) return;
      if (error) toast(error.message, "error");
      else setClasses((data ?? []) as ClassOption[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user.schoolId, toast]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.title.trim() || !form.classId) {
      toast("Renseignez un titre et une classe.", "error");
      return;
    }

    const room = classes.find((c) => c.id === form.classId);
    setBusy(true);
    const { data, error } = await supabase
      .from("timetables")
      .insert({
        school_id: user.schoolId,
        title: form.title.trim(),
        class_id: form.classId,
        grade_level: room?.levels?.[0]?.label ?? null,
        period_type: form.periodType,
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single();
    setBusy(false);

    if (error) {
      toast(error.message, "error");
      return;
    }

    toast("Emploi du temps créé.");
    navigate(data?.id ? `/app/timetables/${data.id}` : "/app/timetables");
  };

  return (
    <>
      <PageHeader
        title="Nouvel emploi du temps"
        subtitle="Créez un brouillon, puis ajoutez les créneaux."
        actions={
          <LinkButton to="/app/timetables" variant="outline" icon="arrow_back">
            Retour
          </LinkButton>
        }
      />

      <Card className="max-w-3xl">
        <form onSubmit={submit} className="space-y-5">
          <Input
            label="Titre"
            required
            placeholder="Ex. Emploi du temps 2026-2027"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label="Classe"
              required
              placeholder={loading ? "Chargement…" : "Sélectionner une classe"}
              disabled={loading}
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
              value={form.classId}
              onChange={(event) => setForm((prev) => ({ ...prev, classId: event.target.value }))}
            />

            <Select
              label="Période"
              options={[
                { value: "semestre", label: "Semestre" },
                { value: "trimestre", label: "Trimestre" },
              ]}
              value={form.periodType}
              onChange={(event) => setForm((prev) => ({ ...prev, periodType: event.target.value }))}
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" loading={busy} icon="save">
              Créer l'emploi du temps
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/app/timetables")}>
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
