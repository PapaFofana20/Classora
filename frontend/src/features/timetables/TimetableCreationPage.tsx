import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabase } from "@/contexts/AuthContext";

export const TimetableCreationPage = () => {
  const [navigate] = useNavigate();
  const { supabase, user } = useSupabase();
  const [timetable, setTimetable] = useState({ title: "", gradeLevel: "", periodType: "semestre", slots: [] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("class_rooms").select("id, label, level").order("label").then(({ data, error }) => {
      if (error) setError(error.message);
      else setTimetable((prev) => ({ ...prev, availableClasses: data }));
    });
  }, [supabase, user]);

  const handleSave = async () => {
    try {
      const { error: apiError } = await supabase.from("timetables").insert({
        title: timetable.title,
        school_id: user.school_id,
        grade_level: timetable.gradeLevel,
        period_type: timetable.periodType,
        status: "draft",
        created_by: user.id,
      });
      if (apiError) throw apiError;
      navigate("/director/timetables");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white shadow rounded-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Création d'emploi du temps</h1>
          <p className="text-gray-600">Interface pour remplir les dates et créneaux</p>
        </header>
        <div className="px-4 py-8">
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Titre de l'emploi du temps</label>
                <input
                  type="text"
                  value={timetable.title}
                  onChange={(e) => setTimetable((t) => ({ ...t, title: e.target.value }))}
                  className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Ex: Emploi du temps 2024-2025"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Niveau</label>
                <select
                  value={timetable.gradeLevel}
                  onChange={(e) => setTimetable((t) => ({ ...t, gradeLevel: e.target.value }))}
                  className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Sélectionner</option>
                  <option value="6ème">6ème</option>
                  <option value="5ème">5ème</option>
                  <option value="4ème">4ème</option>
                  <option value="3ème">3ème</option>
                  <option value="seconde">Seconde</option>
                  <option value="première">Première</option>
                  <option value="terminale">Terminale</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Type de période</label>
                <select
                  value={timetable.periodType}
                  onChange={(e) => setTimetable((t) => ({ ...t, periodType: e.target.value }))}
                  className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="semestre">Semestre</option>
                  <option value="trimestre">Trimestre</option>
                </select>
              </div>
            </div>
            <div className="mt-6">
              <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700">
                Créer l'emploi du temps
              </button>
              <button
                type="button"
                onClick={() => navigate("/director/timetables")}
                className="ml-2 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};