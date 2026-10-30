import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { supabase } from "@/lib/supabase";
import { getSchoolOverview } from "@/services/schoolService";
import { listTeacherRows } from "@/services/teacherService";
import * as timetableService from "@/services/timetableService";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

export default function TimetablePage() {
  const { user, schoolId } = useAuth();
  const { toast } = useToast();
  const isDirector = user?.role === "directeur";

  const [timetables, setTimetables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedTimetable, setSelectedTimetable] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [migrationError, setMigrationError] = useState(false);

  const [studentClassId, setStudentClassId] = useState<string | null>(null);
  const [studentTimetable, setStudentTimetable] = useState<any>(null);
  const [studentCourses, setStudentCourses] = useState<any[]>([]);
  const [loadingStudent, setLoadingStudent] = useState(true);

  const [form, setForm] = useState({
    name: "",
    classId: "",
    schoolYear: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
  });

  const [courseForm, setCourseForm] = useState({
    subjectId: "",
    teacherId: "",
    day: "Lundi",
    startTime: "08:00",
    endTime: "09:00",
    room: "",
  });

  useEffect(() => {
    loadData();
  }, [schoolId]);

  useEffect(() => {
    if (!isDirector && user) {
      loadStudentTimetable();
    } else {
      setLoadingStudent(false);
    }
  }, [isDirector, user, schoolId]);

  const loadData = async () => {
    if (!schoolId || !isDirector) {
      if (!isDirector) setLoading(false);
      return;
    }
    setLoading(true);
    setMigrationError(false);
    try {
      const [timetablesData, overview, teachersData] = await Promise.all([
        timetableService.listTimetables().catch((e) => {
          if (e.message?.includes("timetables") || e.message?.includes("schema cache")) {
            setMigrationError(true);
          }
          throw e;
        }),
        getSchoolOverview(schoolId),
        listTeacherRows(schoolId),
      ]);
      setTimetables(timetablesData || []);
      setClasses(overview.classes || []);
      setSubjects(overview.subjects || []);
      setTeachers(teachersData || []);
    } catch (e: any) {
      if (e.message?.includes("timetables") || e.message?.includes("schema cache")) {
        setMigrationError(true);
      } else {
        toast(e.message || "Erreur lors du chargement", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStudentTimetable = async () => {
    if (!user || !schoolId) {
      setLoadingStudent(false);
      return;
    }
    try {
      if (user.role === "eleve" && user.studentId) {
        const { data: student } = await supabase
          .from("students")
          .select("class_id")
          .eq("id", user.studentId)
          .single();
        if (student?.class_id) {
          setStudentClassId(student.class_id);
          const { data: timetable } = await supabase
            .from("timetables")
            .select("*")
            .eq("class_id", student.class_id)
            .eq("status", "published")
            .single();
          if (timetable) {
            setStudentTimetable(timetable);
            const { data: courseData } = await supabase
              .from("timetable_courses")
              .select(
                `
                *,
                subjects(name),
                profiles:teacher_id(first_name, last_name)
              `
              )
              .eq("timetable_id", timetable.id);
            setStudentCourses(courseData || []);
          }
        }
      } else if (user.role === "parent") {
        const { data: timetable } = await supabase
          .from("timetables")
          .select("*")
          .eq("status", "published")
          .limit(1)
          .single();
        if (timetable) {
          setStudentTimetable(timetable);
          const { data: courseData } = await supabase
            .from("timetable_courses")
            .select(
              `
              *,
              subjects(name),
              profiles:teacher_id(first_name, last_name)
            `
            )
            .eq("timetable_id", timetable.id);
          setStudentCourses(courseData || []);
        }
      }
    } catch (e) {
      // Pas d'emploi du temps trouvé
    } finally {
      setLoadingStudent(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.classId) {
      toast("Veuillez remplir tous les champs", "error");
      return;
    }
    try {
      await timetableService.createTimetable(
        {
          name: form.name,
          classId: form.classId,
          schoolYear: form.schoolYear,
        },
        schoolId!,
        user!.id
      );
      toast("Emploi du temps créé avec succès");
      setCreateOpen(false);
      setForm({
        name: "",
        classId: "",
        schoolYear: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
      });
      loadData();
    } catch (e: any) {
      toast(e.message || "Erreur lors de la création", "error");
    }
  };

  const openEdit = async (timetable: any) => {
    setSelectedTimetable(timetable);
    try {
      const data = await supabase
        .from("timetable_courses")
        .select(
          `
          *,
          subjects(name),
          profiles:teacher_id(first_name, last_name)
        `
        )
        .eq("timetable_id", timetable.id);
      setCourses(data.data || []);
    } catch (e: any) {
      toast(e.message || "Erreur", "error");
    }
    setEditOpen(true);
  };

  const handleAddCourse = async () => {
    if (!selectedTimetable || !courseForm.subjectId || !courseForm.teacherId) {
      toast("Veuillez sélectionner une matière et un professeur", "error");
      return;
    }
    try {
      await timetableService.addCourse(selectedTimetable.id, {
        subjectId: courseForm.subjectId,
        teacherId: courseForm.teacherId,
        day: courseForm.day,
        startTime: courseForm.startTime,
        endTime: courseForm.endTime,
        room: courseForm.room || undefined,
      });
      toast("Cours ajouté");
      const data = await supabase
        .from("timetable_courses")
        .select(
          `
          *,
          subjects(name),
          profiles:teacher_id(first_name, last_name)
        `
        )
        .eq("timetable_id", selectedTimetable.id);
      setCourses(data.data || []);
    } catch (e: any) {
      toast(e.message || "Erreur", "error");
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      await timetableService.deleteCourse(courseId);
      toast("Cours supprimé");
      if (selectedTimetable) {
        const data = await supabase
          .from("timetable_courses")
          .select(
            `
            *,
            subjects(name),
            profiles:teacher_id(first_name, last_name)
          `
          )
          .eq("timetable_id", selectedTimetable.id);
        setCourses(data.data || []);
      }
    } catch (e: any) {
      toast(e.message || "Erreur", "error");
    }
  };

  const handlePublish = async (timetable: any) => {
    try {
      if (timetable.status === "published") {
        await supabase.from("timetables").update({ status: "draft" }).eq("id", timetable.id);
        toast("Emploi du temps dépublié");
      } else {
        await supabase.from("timetables").update({ status: "published" }).eq("id", timetable.id);
        toast("Emploi du temps publié");
      }
      loadData();
    } catch (e: any) {
      toast(e.message || "Erreur", "error");
    }
  };

  const handleDelete = async (timetable: any) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet emploi du temps ?")) return;
    try {
      await timetableService.deleteTimetable(timetable.id);
      toast("Emploi du temps supprimé");
      loadData();
    } catch (e: any) {
      toast(e.message || "Erreur", "error");
    }
  };

  if (loading && isDirector) {
    return (
      <>
        <PageHeader title="Emploi du temps" subtitle="Chargement..." />
        <div className="p-8 text-center">Chargement...</div>
      </>
    );
  }

  if (migrationError && isDirector) {
    return (
      <>
        <PageHeader title="Emploi du temps" subtitle="Configuration requise" />
        <Card>
          <div className="p-8 text-center">
            <Icon name="warning" className="mx-auto text-4xl text-yellow-500 mb-4" />
            <h3 className="text-lg font-bold mb-2">Migration de base de données requise</h3>
            <p className="text-gray-600 mb-4">
              Les tables pour le module emploi du temps n'existent pas encore dans la base de données.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Appliquez la migration <code className="bg-gray-100 px-2 py-1 rounded">20260515000001_timetable_module.sql</code> dans votre base de données Supabase.
            </p>
          </div>
        </Card>
      </>
    );
  }

  // Vue pour élève/parent
  if (!isDirector) {
    if (loadingStudent) {
      return (
        <>
          <PageHeader title="Emploi du temps" subtitle="Chargement..." />
          <div className="p-8 text-center">Chargement...</div>
        </>
      );
    }

    return (
      <>
        <PageHeader title="Emploi du temps" subtitle="Consultez votre emploi du temps" />
        {studentTimetable ? (
          <Card>
            <div className="p-4">
              <h3 className="text-lg font-bold mb-4">{studentTimetable.name}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-gray-50">Horaire</th>
                      {DAYS.map((day) => (
                        <th key={day} className="border p-2 bg-gray-50">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HOURS.map((hour) => (
                      <tr key={hour}>
                        <td className="border p-2 text-center font-medium">{hour}</td>
                        {DAYS.map((day) => {
                          const course = studentCourses.find((c) => c.day === day && c.start_time === hour);
                          return (
                            <td key={day + hour} className="border p-2 h-20 align-top">
                              {course ? (
                                <div className="text-xs">
                                  <div className="font-bold text-forest">{course.subjects?.name}</div>
                                  <div className="text-gray-600">
                                    {course.profiles?.first_name} {course.profiles?.last_name}
                                  </div>
                                  {course.room && <div className="text-gray-500">Salle {course.room}</div>}
                                </div>
                              ) : (
                                <div className="text-gray-300">-</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="p-8 text-center text-gray-500">Aucun emploi du temps publié pour votre classe</div>
          </Card>
        )}
      </>
    );
  }

  // Vue pour directeur
  return (
    <>
      <PageHeader
        title="Emploi du temps"
        subtitle="Créez et gérez les emplois du temps par classe"
        actions={
          <Button icon="add" onClick={() => setCreateOpen(true)}>
            Créer un emploi du temps
          </Button>
        }
      />

      {(timetables || []).length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <Icon name="calendar_month" className="mx-auto text-4xl text-gray-400 mb-2" />
            <p className="text-gray-600 mb-4">Aucun emploi du temps créé</p>
            <Button onClick={() => setCreateOpen(true)}>Créer le premier emploi du temps</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(timetables || []).map((timetable) => (
            <Card key={timetable.id} hover>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg">{timetable.name}</h3>
                    <p className="text-sm text-gray-600">{timetable.class_name || "Classe non assignée"}</p>
                    <p className="text-xs text-gray-500">{timetable.school_year}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      timetable.status === "published"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {timetable.status === "published" ? "Publié" : "Brouillon"}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-4">{timetable.course_count || 0} cours</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => openEdit(timetable)}>
                    <Icon name="edit" className="mr-1" /> Modifier
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handlePublish(timetable)}>
                    {timetable.status === "published" ? "Dépublier" : "Publier"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(timetable)}>
                    <Icon name="delete" className="text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal création */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Créer un emploi du temps">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nom de l'emploi du temps</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Emploi du temps CM2 A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Classe</label>
            <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              <option value="">Sélectionner une classe</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Année scolaire</label>
            <Input
              value={form.schoolYear}
              onChange={(e) => setForm({ ...form, schoolYear: e.target.value })}
              placeholder="2025-2026"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate}>Créer</Button>
          </div>
        </div>
      </Modal>

      {/* Modal édition */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Modifier - ${selectedTimetable?.name}`} size="lg">
        <div className="space-y-4">
          <Card>
            <div className="p-4">
              <h4 className="font-bold mb-3">Ajouter un cours</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Select value={courseForm.subjectId} onChange={(e) => setCourseForm({ ...courseForm, subjectId: e.target.value })}>
                  <option value="">Matière</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Select value={courseForm.teacherId} onChange={(e) => setCourseForm({ ...courseForm, teacherId: e.target.value })}>
                  <option value="">Professeur</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </option>
                  ))}
                </Select>
                <Select value={courseForm.day} onChange={(e) => setCourseForm({ ...courseForm, day: e.target.value })}>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
                <Select value={courseForm.startTime} onChange={(e) => setCourseForm({ ...courseForm, startTime: e.target.value })}>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
                <Select value={courseForm.endTime} onChange={(e) => setCourseForm({ ...courseForm, endTime: e.target.value })}>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
                <Input
                  placeholder="Salle (optionnel)"
                  value={courseForm.room}
                  onChange={(e) => setCourseForm({ ...courseForm, room: e.target.value })}
                />
              </div>
              <Button className="mt-2" onClick={handleAddCourse}>
                Ajouter le cours
              </Button>
            </div>
          </Card>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border p-2 bg-gray-50">Horaire</th>
                  {DAYS.map((day) => (
                    <th key={day} className="border p-2 bg-gray-50">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="border p-2 text-center font-medium bg-gray-50">{hour}</td>
                    {DAYS.map((day) => {
                      const course = courses.find((c) => c.day === day && c.start_time === hour);
                      return (
                        <td key={day + hour} className="border p-1 h-16 align-top relative">
                          {course ? (
                            <div className="bg-forest/10 p-1 rounded text-xs">
                              <div className="font-bold">{course.subjects?.name}</div>
                              <div className="text-gray-600">
                                {course.profiles?.first_name?.[0]}. {course.profiles?.last_name}
                              </div>
                              {course.room && <div className="text-gray-500">Salle {course.room}</div>}
                              <button
                                onClick={() => handleDeleteCourse(course.id)}
                                className="absolute top-0 right-0 text-red-500 hover:text-red-700"
                              >
                                ×
                              </button>
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </>
  );
}
