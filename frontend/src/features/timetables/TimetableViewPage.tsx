import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "react-router-dom";
import { useSupabase } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export const TimetableViewPage = () => {
  const { id } = useParams();
  const navigate = useRouter();
  const { supabase, user } = useSupabase();
  const [timetable, setTimetable] = useState(null);
  const [slots, setSlots] = useState([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!id || !user) {
      setLoading(false);
      return;
    }

    // Fetch the timetable
    supabase.from("timetables").select(`*, class_rooms!timetables_class_id_fkey(label, level)`).eq("id", id).single().then(({ data, error }) => {
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Check permissions by calling the backend API
      // We use a simple fetch to our API which has proper RLS checks
      fetch(`/api/timetables/${id}`, {
        credentials: "include" // Use include to send the auth cookie/session
      })
        .then((response) => {
          if (response.ok) {
            // Authorized - set the timetable
            setTimetable(data);
          } else {
            // Not authorized - show access denied
            toast({
              title: "Accès refusé",
              description: "Vous n'avez pas accès à cet emploi du temps.",
              variant: "destructive",
            });
            navigate("/");
          }
        })
        .catch((_) => {
          // Error in fetch - deny access
          toast({
            title: "Erreur",
            description: "Impossible de vérifier vos permissions.",
            variant: "destructive",
          });
          navigate("/");
        });
    });

    // Fetch slots
    supabase.from("timetable_slots").select("*").eq("timetable_id", id).order("day_of_week").order("start_time").then(({ data, error }) => {
      if (error) setError(error.message);
      else setSlots(data);
    });

    setLoading(false);
  }, [id, user]);

  // Le vérification des permissions est maintenant gérée par l'appel API ci-dessus
  // La fonction checkPermissions inline a été retirée au profit de l'appel API direct

  if (loading) {
    return <div className="min-h-screen p-8">Chargement de l'emploi du temps...</div>;
  }

  if (error) {
    return <div className="min-h-screen p-8 text-red-600">Erreur: {error}</div>;
  }

  if (!timetable) {
    return <div className="min-h-screen p-8">Emploi du temps introuvable</div>;
  }

  const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white shadow rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {timetable.title} - {timetable.class_rooms?.label || "Non spécifié"}
          </h1>
          <p className="text-gray-500">
            Niveau: {timetable.class_rooms?.level || "Non spécifié"} | Type: {timetable.period_type}
          </p>
        </header>

        <div className="bg-white rounded-lg shadow p-6">
          {/* Timetable info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500">Créé le</p>
              <p className="font-medium">{new Date(timetable.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Publié le</p>
              <p className="font-medium">{timetable.published_at ? new Date(timetable.published_at).toLocaleDateString() : "Non publié"}</p>
            </div>
          </div>

          {/* Slots table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-full bg-white rounded-lg shadow">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="p-3 text-left text-xs font-medium text-gray-500">Jour</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-500">Début</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-500">Fin</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-500">Matière</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-500">Enseignant</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-500">Salle</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3">{dayNames[slot.day_of_week] || "Inconnu"}</td>
                    <td className="p-3">{slot.start_time}</td>
                    <td className="p-3">{slot.end_time}</td>
                    <td className="p-3">{slot.subject || "Non spécifié"}</td>
                    <td className="p-3">{slot.teacher_id || "Non assigné"}</td>
                    <td className="p-3">{slot.class_room_id || "Non assigné"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PDF Export Button */}
          {user.role === "directeur" && (
            <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => window.open(`/api/timetables/${id}/export-pdf`, "blank")}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
              >
                Télécharger PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};