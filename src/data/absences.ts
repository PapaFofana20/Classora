import type { AbsenceRecord } from "@/types";
import { students } from "./students";
import { hashString, mulberry32, pick } from "./seed";

const MOTIFS: Record<AbsenceRecord["type"], string[]> = {
  absence: ["Maladie", "Raison familiale", "Non justifiée", "Rendez-vous médical"],
  retard: ["Transport en commun", "Embouteillages", "Non justifié"],
  discipline: ["Bavardages répétés", "Téléphone en classe", "Oubli de matériel", "Chahut en rang"],
};
const SANCTIONS = ["Avertissement oral", "Avertissement écrit", "Retenue 1 h", "Convocation des parents"];
const TYPES: AbsenceRecord["type"][] = ["absence", "retard", "discipline", "absence", "retard"];

export const absences: AbsenceRecord[] = schoolAbsences();

function schoolAbsences(): AbsenceRecord[] {
  const bySchool = new Map<string, AbsenceRecord[]>();
  for (const s of students) {
    const r = mulberry32(hashString("abs" + s.id));
    const list = bySchool.get(s.schoolId) ?? [];
    const type = pick(TYPES, r());
    const day = 1 + Math.floor(r() * 14);
    list.push({
      schoolId: s.schoolId,
      id: `ab-${s.schoolId.slice(4, 6)}-${String(list.length + 1).padStart(3, "0")}`,
      studentId: s.id,
      date: `2026-12-${String(day).padStart(2, "0")}`,
      type,
      motif: pick(MOTIFS[type], r()),
      justified: type !== "discipline" && r() < 0.5,
      ...(type === "discipline" ? { sanction: pick(SANCTIONS, r()) } : {}),
    });
    bySchool.set(s.schoolId, list);
  }
  return Array.from(bySchool.values()).flat().sort((a, b) => b.date.localeCompare(a.date));
}