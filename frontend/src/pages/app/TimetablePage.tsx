import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { supabase } from "@/lib/supabase";

export default function TimetablePage() {
  const { schoolId } = useAuth();
  const { toast } = useToast();
  const [timetables, setTimetables] = useState<Array<{
    id: string;
    name: string;
    school_year: string;
    status: "draft" | "published";
    course_count: number;
  }>>([]);
  const [newTimetableName, setNewTimetableName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Load timetables
  useEffect(() => {
    fetchTimetables();
  }, [schoolId]);

  const fetchTimetables = async () => {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from("timetables")
        .select("id, name, school_year, status, _count");
      if (error) throw error;
      setTimetables((data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        school_year: t.school_year,
        status: t.status,
        course_count: t._count?.timetable_courses || 0,
      })));
    } catch (err: any) {
      toast("Erreur", undefined);
    }
  };

  const handleCreate = async () => {
    if (!newTimetableName.trim()) return;
    setCreating(true);
    try {
      await supabase.from("timetables").insert({
        school_id: schoolId,
        name: newTimetableName,
        status: "draft",
      });
      fetchTimetables();
      setNewTimetableName("");
      toast("Succès", undefined);
    } catch (err: any) {
      toast("Erreur", undefined);
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (timetableId: string) => {
    const confirmed = window.confirm("Êtes-vous sûr de vouloir publier cet emploi du temps ?");
    if (!confirmed) return;
    try {
      await supabase.from("timetables").update({ status: "published" }).eq("id", timetableId);
      fetchTimetables();
      toast("Succès", undefined);
    } catch (err: any) {
      toast("Erreur", undefined);
    }
  };

  const handleDelete = async (timetableId: string) => {
    const confirmed = window.confirm("Êtes-vous sûr de vouloir supprimer cet emploi du temps ?");
    if (!confirmed) return;
    try {
      await supabase.from("timetable_courses").delete().eq("timetable_id", timetableId);
      await supabase.from("timetables").delete().eq("id", timetableId);
      fetchTimetables();
      toast("Succès", undefined);
    } catch (err: any) {
      toast("Erreur", undefined);
    }
  };

  return (
    <>

      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Emploi du temps</h1>
      <p className="mt-2 text-neutral-600">Organisez et gérez les horaires de vos classes en un seul endroit.</p>
      <div className="mb-4">
        <input
          placeholder="Nom de l'emploi du temps"
          value={newTimetableName}
          onChange={e => setNewTimetableName((e.target as HTMLInputElement).value)}
          disabled={creating}
        />
        <button
          onClick={handleCreate}
          disabled={creating}
          className="button primary mt-2">
            {creating ? "Création en cours..." : "Créer un emploi du temps"}
        </button>
      </div>
      {timetables.length > 0 && (
        <div>
          {timetables.map((t) => (
            <div key={t.id} className="card mb-3">
              <div className="flex justify-between items-center p-2">
                <span>
                  {t.name} {t.school_year}
                  <span className="text-sm text-muted-foreground ml-2">
                    {t.status === "published" ? "Publié" : "Brouillon"}
                  </span>
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(t.id)}
                    disabled={editingId === t.id}
                    className="button icon"
                  >
                    <span aria-label="Modifier">✎</span>
                  </button>
                  <button
                    onClick={() => handlePublish(t.id)}
                    className="button icon"
                  >
                    {t.status === "published" ? "Dépublier" : "Publier"}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="button icon destructive"
                  >
                    <span aria-label="Supprimer">×</span>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.course_count} cours
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}