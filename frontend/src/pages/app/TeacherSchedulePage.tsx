import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useTeaching } from "@/context/TeachingContext";
import { useAsync } from "@/hooks/useAsync";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";
import { Table, TableHeader, TableRow, TableCell, TableHead } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatTime } from "@/utils/format";

export interface TeacherScheduleSlot {
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

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default function TeacherSchedulePage() {
  const { user } = useAuth();
  const school = useSchool();
  const { contexts, loading, error } = useTeaching();

  if (!user || !school) {
    return null;
  }

  // Fetch schedules for the teacher's assigned classes and subjects
  const { data: schedules, isLoading, error: schedulesError } = useAsync(
    async () => {
      if (!contexts || contexts.length === 0) return [];

      // Get all class IDs and subject IDs the teacher is assigned to
      const classIds = new Set(contexts.map((c) => c.classId));
      const subjectIds = new Set(contexts.map((c) => c.subjectId));

      // Fetch schedules filtered by the teacher's assigned classes and subjects
      const { data, error } = await supabase
        .from("schedules")
        .select(
          `
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
        `
        )
        .eq("school_id", school.id)
        .in("class_id", Array.from(classIds))
        .in("subject_id", Array.from(subjectIds))
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      return data as TeacherScheduleSlot[];
    },
    [school.id, contexts?.length ?? 0]
  );

  if (loading || isLoading) {
    return (
      <Card>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || schedulesError) {
    return (
      <Card>
        <CardContent>
          <p className="text-red-600">Erreur lors du chargement de l'emploi du temps</p>
        </CardContent>
      </Card>
    );
  }

  if (!schedules || schedules.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-muted-foreground">
            Aucun créneau trouvé pour vos affectations. Contactez le directeur si vous pensez que ceci est une erreur.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group schedules by day of week
  const groupedSchedules = schedules.reduce((acc, slot) => {
    const day = DAYS[slot.dayOfWeek] || "Inconnu";
    if (!acc[day]) acc[day] = [];
    acc[day].push(slot);
    return acc;
  }, Record<string, TeacherScheduleSlot[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{`Emploi du temps de ${user.first_name ?? ""} ${user.last_name ?? ""}`}</CardTitle>
      </CardHeader>
      <CardContent>
        {Object.entries(groupedSchedules).length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jour</TableHead>
                <TableHead>Heure</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Matière</TableHead>
                <TableHead>Salle</TableHead>
              </TableRow>
            </TableHeader>
            {Object.entries(groupedSchedules).map(([day, slots]) => (
              <TableRow key={day} className="border-b">
                <TableCell colSpan={5}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{day}</span>
                    {slots.length > 0 && (
                      <Badge variant="secondary">{slots.length} créneau(s)</Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              {slots.map((slot) => (
                <TableRow key={slot.id} className="hover:bg-muted/50">
                  <TableCell>{DAYS[slot.dayOfWeek]}</TableCell>
                  <TableCell>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</TableCell>
                  <TableCell>{slot.className}</TableCell>
                  <TableCell>{slot.subjectName ?? "Non attribué"}</TableCell>
                  <TableCell>{slot.room ?? "Non spécifiée"}</TableCell>
                </TableRow>
              ))}
            ))}
          </Table>
        ) : (
          <p className="text-muted-foreground">Aucun créneau programmé</p>
        )}
      </CardContent>
    </Card>
  );
}