import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSchool } from "@/context/SchoolContext";
import { useAsync } from "@/hooks/useAsync";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/context/ToastContext";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabList, Tab } from "@/components/ui/Tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

export default function ParentSchedulePage() {
function ScheduleGrid({ schedule }: { schedule: any[] }) {
  const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const slotsByDay = schedule.reduce((acc: any, slot: any) => {
    const day = slot.day_of_week || 0;
    if (!acc[day]) acc[day] = [];
    acc[day].push(slot);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-7 gap-2">
      <div className="grid grid-cols-7 border-b py-2 text-center text-sm text-muted-foreground">
        {DAYS.map((day, i) => (
          <div key={day} className="flex items-center justify-center">
            {i > 0 && <div className="w-1 h-4 bg-border" />}
            <span>{day}</span>
          </div>
        ))}
      </div>
      {Array.from({ length: 6 }, (_, p) => (
        <div
          key={p}
          className="border rounded-t bg-card/50 flex flex-col items-center justify-center min-h-[140px]"
        >
          {DAYS.map((day) => {
            const daySlots = slotsByDay[DAYS.indexOf(day)] || [];
            const slot = daySlots.find((s: any) => s.period_index === p);
            if (!slot) return null;
            return (
              <div
                key={day}
                className="w-full h-6 border-b cursor-pointer hover:bg-primary/10 transition-colors"
              >
                <div className="text-xs text-muted-foreground">{slot.subject_name || "—"}</div>
                <div className="text-xs font-medium">{slot.teacher_name || "—"}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
  const { user } = useAuth();
  const { schoolId, schoolName } = useSchool();

  if (!user || user.role !== "parent") {
    return <div className="min-h-screen p-8">Accès non autorisé.</div>;
  }

  const parentId = user.parentId;
  const [children, setChildren] = useState<Array<{ id: string; first_name: string; last_name: string; classId: string; className?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parentId || !schoolId) {
      setLoading(false);
      return;
    }
    ;(async () => {
      try {
        const { data, error: supaError } = await supabase
          .from("students")
          .select("*")
          .eq("school_id", schoolId)
          .eq("parent_id", parentId);
        if (supaError) throw supaError;
        const childrenData = (data as any[]).map((s: any) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          classId: s.class_id,
          className: s.className,
        }));
        setChildren(childrenData);
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    })();
  }, [parentId, schoolId]);

  if (loading) {
    return <div className="min-h-screen p-8"><Skeleton className="h-64 w-3/4 mx-auto mb-4" /><Skeleton className="h-24 w-3/4 mx-auto" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Réessayer</button>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="min-h-screen p-8 text-center">
        <p className="text-gray-600">Aucun enfant trouvé.</p>
      </div>
    );
  }

  // Fetch schedules for each child's class
  const [classSchedules, setClassSchedules] = useState<Map<string, any[]>>(new Map());
  useEffect(() => {
    if (children.length === 0) return;
    const classIds = [...new Set(children.map((c: any) => c.classId))];
    const promises = classIds.map((cid: string) =>
      supabase.from("schedule").select("*").eq("school_id", schoolId).eq("class_id", cid)
    );
    Promise.all(promises).then((results: any[]) => {
      const map = new Map<string, any[]>();
      classIds.forEach((cid: string, i: number) => map.set(cid, results[i] || []));
      setClassSchedules(map);
    });
  }, [children, schoolId]);

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="text-2xl font-bold mb-6">Emploi du temps - {schoolName}</h1>
      {children.map((child: any) => (
        <div key={child.id} className="mb-8 p-6 rounded-xl border bg-card shadow-sm">
          <h2 className="text-xl font-medium mb-4">{child.first_name} {child.last_name}</h2>
          <p className="text-sm text-gray-500 mb-4">Classe: {child.className || "Non assignée"}</p>
          <ScheduleGrid schedule={classSchedules.get(child.classId) || []} />
        </div>
      ))}
      <div className="mt-8 p-6 rounded-xl border bg-card">
        <p className="text-sm text-gray-500">
          {children.length} enfant(s): {children.map((c: any) => `${c.first_name} ${c.last_name}`).join(", ")}
        </p>
      </div>
    </div>
  );
}