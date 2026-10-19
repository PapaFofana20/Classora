import type { SchoolRegistrationRequest } from "@/types";
import { SCHOOL_IDS } from "./schools";

/** Demandes d'inscription en attente de validation par la direction (école de démonstration). */
export const registrationRequests: SchoolRegistrationRequest[] = [
  {
    id: "req-1",
    schoolId: SCHOOL_IDS.sainteMarie,
    userId: "u-req-eleve-1",
    role: "eleve",
    firstName: "Aminata",
    lastName: "Sow",
    email: "aminata.sow@mail.sn",
    phone: "77 233 45 67",
    gender: "F",
    birthDate: "2014-05-18",
    classId: "c-ce2-a",
    createdAt: "2026-12-15T08:20",
    status: "EN_ATTENTE",
  },
  {
    id: "req-2",
    schoolId: SCHOOL_IDS.sainteMarie,
    userId: "u-req-eleve-2",
    role: "eleve",
    firstName: "Babacar",
    lastName: "Ndiaye",
    email: "babacar.ndiaye@mail.sn",
    phone: "78 455 12 09",
    gender: "M",
    birthDate: "2011-09-02",
    classId: "c-6a",
    createdAt: "2026-12-15T09:05",
    status: "EN_ATTENTE",
  },
  {
    id: "req-3",
    schoolId: SCHOOL_IDS.sainteMarie,
    userId: "u-req-parent-1",
    role: "parent",
    firstName: "Moussa",
    lastName: "Faye",
    email: "moussa.faye@mail.sn",
    phone: "70 118 65 40",
    classId: "c-4a",
    createdAt: "2026-12-14T19:40",
    status: "EN_ATTENTE",
  },
];