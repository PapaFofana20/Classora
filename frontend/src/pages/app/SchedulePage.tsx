import { ReactNode } from "react";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useTeacherAssignments } from "@/hooks/useTeacherAssignments";
import { supabase } from "@/lib/supabase";
import { useUtilsPermissions } from "@/utils/permissions";
import {
  Card,
  CardHeader,
  Table,
  TableRow,
  TableCell,
  TableHead,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
  InputLabel,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  Option,
  Button,
  Badge,
  Alert,
  Form,
  FormControl,
  FormLabel,
  FormMessage,
} from "@/components/ui";
import { useNavigate } from "react-router-dom";
import { formatTime } from "@/utils/format";
import { useToast } from "@/context/ToastContext";

export interface ScheduleSlot {
  id: string;
  classId: string | null;
  subjectId: string | null;
  teacherId: string | null;
  dayOfWeek: number; // 0=Lundi, 1=Mardi, ..., 5=Samedi
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  room: string | null;
  className: string;
  subjectName: string | null;
  teacherName: string | null;
}

export interface ScheduleFormValues {
  classId: string;
  subjectId: string;
  teacherId: string;
  day: number;
  startTime: string;
  endTime: string;
  room?: string;
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DAYS_SHORT = ["L", "M", "M", "J", "V", "S"];

export default function SchedulePage() {
  const { user } = useAuth();
  const { school, status } = useSchool();
  const navigate = useNavigate();

  if (!user || !school) {
    return null;
  }

  // Vérifier les permissions
  const isDirector = user.role === "directeur";
  if (!isDirector) {
    return <Alert variant="destructive">Vous n'avez pas la permission d'accéder à cette page.</Alert>;
  }

  const { data: schedules, isLoading, error } = useAsync(() =>
    fetchSchedules(school.id)
fetchSchedules = async (schoolId: string) => {
    const { data, error } = await supabase
      .from("schedules")
      .select(`
        id,
        class_id,
        subject_id,
        teacher_id,
        day_of_week,
        start_time,
        end_time,
        room,
        class_rooms:name,
        subjects:name,
        teachers:users.first_name, last_name
      `)
      .eq("school_id", schoolId)
      .order("day_of_week")
      .order("start_time");

    if (error) throw error;
    return data as ScheduleSlot[];
  };

  );
  const { data: fetchedSchedules, isLoading: loadIsLoading, error: loadError, retry } = useAsync(
    async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select(`
          id,
          class_id,
          subject_id,
          teacher_id,
          day_of_week,
          start_time,
          end_time,
          room,
          class_rooms:name,
          subjects:name,
          teachers:users(first_name, last_name)
        `)
        .eq("school_id", school.id)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      return data as ScheduleSlot[];
    }
  );

  // Mise à jour de l'état local en async
  React.useEffect(() => {
    if (fetchedSchedules) {
      setSchedules(fetchedSchedules);
      setIsLoading(false);
    }
    if (loadError) {
      setError(loadError.message);
      setIsLoading(false);
    }
  }, [fetchedSchedules, loadError]);

  // Fetch function with retry
  const fetchSchedules = async (schoolId: string) => {
    const { data, error } = await supabase
      .from("schedules")
      .select(`
        id,
        class_id,
        subject_id,
        teacher_id,
        day_of_week,
        start_time,
        end_time,
        room,
        class_rooms:name,
        subjects:name,
        teachers:users(first_name, last_name)
      `)
      .eq("school_id", schoolId)
      .order("day_of_week")
      .order("start_time");

    if (error) throw error;
    return data as ScheduleSlot[];
  };

  // Ouvrir le formulaire (ajout ou édition)
  const openForm = React.useCallback(
    (mode: "add" | "edit", id?: string, initialValues?: ScheduleFormValues) => {
      setFormOpen({
        open: true,
        mode,
        id,
        values:
          initialValues ||
          { classId: "", subjectId: "", teacherId: "", day: 0, startTime: "", endTime: "", room: "" },
      });
    },
    []
  );

  // Soumettre le formulaire (ajouter ou modifier)
  const onSubmit = async (values: ScheduleFormValues) => {
    try {
      setIsLoading(true);

      if (formOpen.mode === "add") {
        // Ajouter un nouvel emploi du temps
        const { data, error } = await supabase
          .from("schedules")
          .insert({
            school_id: school.id,
            class_id: values.classId,
            subject_id: values.subjectId,
            teacher_id: values.teacherId,
            day_of_week: values.day,
            start_time: values.startTime,
            end_time: values.endTime,
            room: values.room,
          })
          .select()
          .single();

        if (error) throw error;
        toast("Emploi du temps ajouté avec succès");
      } else {
        // Modifier un emploi du temps existant
        const { data, error } = await supabase
          .from("schedules")
          .update({
            class_id: values.classId,
            subject_id: values.subjectId,
            teacher_id: values.teacherId,
            day_of_week: values.day,
            start_time: values.startTime,
            end_time: values.endTime,
            room: values.room,
          })
          .eq("id", formOpen.id!)
          .select()
          .single();

        if (error) throw error;
        toast("Emploi du temps modifié avec succès");
      }

      // Fermer le formulaire et recharger
      setFormOpen({ open: false, mode: "add", values: { classId: "", subjectId: "", teacherId: "", day: 0, startTime: "", endTime: "", room: "" } });
      await retry();
    } catch (e: any) {
      toast(e instanceof Error ? e.message : "Impossible d'enregistrer l'emploi du temps", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Supprimer un créneau
  const deleteSlot = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce créneau?")) return;

    try {
      const { error } = await supabase.from("schedules").delete().eq("id", id);

      if (error) throw error;
      toast("Créneau supprimé avec succès");
      await retry();
    } catch (e: any) {
      toast(e instanceof Error ? e.message : "Impossible de supprimer le créneau", "error");
    }
  };

  // État pour les options des selects
  const [classes, setClasses] = React.useState<string[]>([]);
  const [subjects, setSubjects] = React.useState<string[]>([]);
  const [teachers, setTeachers] = React.useState<string[]>([]);

  // Charger les classes, matières et enseignants
  React.useEffect(() => {
    fetchClassesSubjectsTeachers();
  }, [school.id]);

  const fetchClassesSubjectsTeachers = async () => {
    try {
      // Récupérer les classes de l'école
      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", school.id);

      if (classesError) throw classesError;
      setClasses(classesData?.map((c: any) => c.id) || []);

      // Récupérer les matières
      const { data: subjectsData, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("school_id", school.id);

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData?.map((s: any) => s.id) || []);

      // Récupérer les enseignants
      const { data: teachersData, error: teachersError } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .eq("school_id", school.id)
        .eq("role", "professeur");

      if (teachersError) throw teachersError;
      setTeachers(teachersData?.map((t: any) => `${t.first_name} ${t.last_name}`) || []);
    } catch (e: any) {
      toast(e instanceof Error ? e.message : "Impossible de charger les données de référence", "error");
    }
  };

  if (isLoading || error) {

  const fetchClassesSubjectsTeachers = async () => {
    try {
      // Récupérer les classes de l'école
      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", school.id);

      if (classesError) throw classesError;
      setClasses(classesData?.map((c: any) => c.id) || []);

      // Récupérer les matières
      const { data: subjectsData, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("school_id", school.id);

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData?.map((s: any) => s.id) || []);

      // Récupérer les enseignants
      const { data: teachersData, error: teachersError } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .eq("school_id", school.id)
        .eq("role", "professeur");

      if (teachersError) throw teachersError;
      setTeachers(teachersData?.map((t: any) => `${t.first_name} ${t.last_name}`) || []);
    } catch (e: any) {
      toast(e instanceof Error ? e.message : "Impossible de charger les données de référence", "error");
    }
  };