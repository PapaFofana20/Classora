import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useAsync } from "@/hooks/useAsync";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatTime } from "@/utils/format";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export interface StudentScheduleSlot {
  id: string;
  classId: string;
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

export default function StudentSchedulePage() {
  const { user } = useAuth();
  const school = useSchool();

  if (!user || !school) {
    return null;
  }

  // Fetch the student's class using their user ID and school
  const { data: student, isLoading, error: studentError } = useAsync(
    async () => {
      if (!user.id) return null;

      // Query the students table to find the student record for this user
      const { data, error } = await supabase
        .from("students")
        .select(`
          *,
          class_rooms (
            name,
            cycle
          )
        `)
        .eq("school_id", school.id)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data as StudentScheduleSlot & {
        class_rooms: { name: string; cycle: string };
      };
    },
    [user.id, school.id]
  );

  if (studentError) {
    return (
      <Card>
        <CardContent>
          <p className="text-red-600">Erreur lors du chargement des informations étudiant</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !student) {
    return (
      <Card>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Fetch schedules for the student's class
  const { data: schedules, isLoading: schedulesLoading, error: schedulesError } = useAsync(
    async () => {
      if (!student.classId) return [];

      // Fetch schedules filtered by the student's class
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
        .eq("class_id", student.classId)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      return data as StudentScheduleSlot[];
    },
    [school.id, student.classId]
  );

  if (schedulesLoading || schedulesError) {
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

  // Group schedules by day of week for the weekly grid
  const groupedSchedules = schedules.reduce((acc, slot) => {
    if (!acc[slot.dayOfWeek]) {
      acc[slot.dayOfWeek] = [];
    }
    acc[slot.dayOfWeek].push(slot);
    return acc;
  }, {} as Record<number, StudentScheduleSlot[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Emploi du temps de {student.lastName || "Élève"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {student.className && (
          <Badge
            variant="secondary"
            className="text-sm mb-3"
          >
            {student.className}
          </Badge>
        )}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {DAYS.map((day, dayIndex) => (
            <div
              key={dayIndex}
              className={
                "border rounded p-3 bg-white/5 min-h-64 shadow-sm " +
                (groupedSchedules[dayIndex]
                  ? "bg-white/8"
                  : "text-neutral-500 opacity-50")
              }
            >
              <h3 className="font-medium text-sm mb-2">{day}</h3>
              {groupedSchedules[dayIndex]?.map((slot, i) => (
                <div
                  key={slot.id}
                  className="p-2 rounded border-t border-neutral-300/30"
                >
                  <p className="font-semibold text-xs">{slot.subjectName || "Matière"}</p>
                  <p className="text-xs text-neutral-400">
                    {slot.startTime} - {slot.endTime}
                  </p>
                  {slot.room && (
                    <p className="text-xs text-neutral-400 mt-1">
                      {slot.room}
                    </p>
                  )}
                  {slot.teacherName && (
                    <p className="text-xs text-neutral-400 mt-1">
                      {slot.teacherName}
                    </p>
                  )}
                </div>
              ))}
              {(!groupedSchedules[dayIndex] || groupedSchedules[dayIndex].length === 0) && (
                <p className="text-xs text-neutral-400 text-center pt-4">Pas de cours</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}