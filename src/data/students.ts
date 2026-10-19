import type { Parent, Student } from "@/types";
import { classes } from "./classes";
import { levels } from "./school";
import { SCHOOL_IDS, schoolSeeds, type SchoolSeed } from "./schools";
import { generateChildCode } from "@/utils/matricule";
import { mulberry32, pick } from "./seed";

const FIRST_F = ["Aïssatou", "Fatou", "Aminata", "Mariama", "Khady", "Ndèye", "Awa", "Coumba", "Astou", "Rokhaya", "Sokhna", "Binta", "Mame Diarra", "Adja", "Dieynaba", "Marième"];
const FIRST_M = ["Mamadou", "Ibrahima", "Cheikh", "Moussa", "Ousmane", "Abdoulaye", "Modou", "Pape", "Serigne", "Alioune", "Lamine", "Babacar", "Assane", "Samba", "Idrissa", "Omar"];
const LAST = ["Diop", "Ndiaye", "Fall", "Sow", "Ba", "Sarr", "Gueye", "Faye", "Diallo", "Seck", "Mbaye", "Sy", "Thiam", "Cissé", "Kane", "Diouf", "Ndoye", "Niang", "Badji", "Sène", "Camara", "Gaye", "Mendy", "Tall"];
const QUARTIERS = ["Sicap Liberté", "Parcelles Assainies", "Mermoz", "Ouakam", "Yoff", "Grand Yoff", "Almadies", "Médina", "HLM", "Ngor"];

export const parents: Parent[] = [
  {
    schoolId: SCHOOL_IDS.sainteMarie,
    id: "p-demo",
    firstName: "Fatou",
    lastName: "Ndiaye",
    phone: "77 412 56 90",
    email: "parent@classora.sn",
    address: "Sicap Liberté 4, Dakar",
  },
];

export const students: Student[] = [];

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");

const codes = (count: number): string[] => Array.from({ length: count }, () => generateChildCode());

function phone(r: () => number): string {
  return `${pick(["77", "78", "76", "70"], r())} ${100 + Math.floor(r() * 899)} ${10 + Math.floor(r() * 89)} ${10 + Math.floor(r() * 89)}`;
}

/** Élèves du Collège Sainte Marie (identifiants historiques conservés). */
function genSainteMarie(): void {
  const sizes = schoolSeeds.find((s) => s.id === SCHOOL_IDS.sainteMarie)?.sizes ?? {};
  const r = mulberry32(20262027);
  let n = 0;
  for (const cls of classes.filter((c) => c.schoolId === SCHOOL_IDS.sainteMarie)) {
    const level = levels.find((l) => l.id === cls.levelId);
    const order = level ? level.order : 0;
    for (let i = 0, size = sizes[cls.cycle] ?? 5; i < size; i++) {
      n += 1;
      const demo = cls.id === "c-ce2-a" && i === 0 ? "aida" : cls.id === "c-4a" && i === 0 ? "mamadou" : null;
      const gender: "F" | "M" = demo === "aida" ? "F" : demo === "mamadou" ? "M" : r() < 0.5 ? "F" : "M";
      const firstName = demo === "aida" ? "Aïda" : demo === "mamadou" ? "Mamadou" : pick(gender === "F" ? FIRST_F : FIRST_M, r());
      let parentId: string;
      let lastName: string;
      if (demo) {
        parentId = "p-demo";
        lastName = "Ndiaye";
      } else if (n % 11 === 0 && students.length >= 6 && students[students.length - 6].parentId !== "p-demo") {
        const sibling = students[students.length - 6];
        parentId = sibling.parentId;
        lastName = sibling.lastName;
      } else {
        lastName = pick(LAST, r());
        parentId = `p-${String(n).padStart(3, "0")}`;
        const pf = pick(r() < 0.5 ? FIRST_F : FIRST_M, r());
        parents.push({ schoolId: SCHOOL_IDS.sainteMarie, id: parentId, firstName: pf, lastName, phone: phone(r), email: `${slug(pf)}.${slug(lastName)}${n}@mail.sn`, address: `${pick(QUARTIERS, r())}, Dakar` });
      }
      const year = 2026 - (6 + order);
      const month = 1 + Math.floor(r() * 12);
      const day = 1 + Math.floor(r() * 28);
      students.push({
        schoolId: SCHOOL_IDS.sainteMarie,
        id: demo ? `s-${demo}` : `s-${String(n).padStart(3, "0")}`,
        matricule: `EC26-${String(n).padStart(4, "0")}`,
        childCode: codes(1)[0],
        firstName,
        lastName,
        gender,
        birthDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        classId: cls.id,
        parentId,
        options: { cantine: r() < 0.4, transport: r() < 0.25, tenue: r() < 0.5 },
        enrolledAt: `2026-09-${String(1 + Math.floor(r() * 20)).padStart(2, "0")}`,
      });
    }
  }
}

/** Élèves générés pour les autres écoles de démonstration. */
function genSchool(seed: SchoolSeed): void {
  const r = mulberry32(seed.seed + 7);
  let n = 0;
  for (const cls of classes.filter((c) => c.schoolId === seed.id)) {
    const level = levels.find((l) => l.id === cls.levelId);
    const order = level ? level.order : 0;
    const size = seed.sizes[cls.cycle] ?? 4;
    for (let i = 0; i < size; i++) {
      n += 1;
      const gender: "F" | "M" = r() < 0.5 ? "F" : "M";
      const firstName = pick(gender === "F" ? FIRST_F : FIRST_M, r());
      let lastName = pick(LAST, r());
      let parentId = `p-${seed.prefix}-${String(n).padStart(3, "0")}`;
      if (n > 1 && n % 9 === 0) {
        const sibling = students[students.length - 2];
        parentId = sibling.parentId;
        lastName = sibling.lastName;
      } else {
        const pf = pick(r() < 0.5 ? FIRST_F : FIRST_M, r());
        parents.push({ schoolId: seed.id, id: parentId, firstName: pf, lastName, phone: phone(r), email: `${slug(pf)}.${slug(lastName)}${seed.prefix}${n}@mail.sn`, address: `${pick(QUARTIERS, r())}, ${seed.city}` });
      }
      const year = 2026 - (6 + order);
      const month = 1 + Math.floor(r() * 12);
      const day = 1 + Math.floor(r() * 28);
      students.push({
        schoolId: seed.id,
        id: `s-${seed.prefix}-${String(n).padStart(3, "0")}`,
        matricule: `EC26${seed.prefix.toUpperCase()}${String(n).padStart(3, "0")}`,
        childCode: codes(1)[0],
        firstName,
        lastName,
        gender,
        birthDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        classId: cls.id,
        parentId,
        options: { cantine: r() < 0.35, transport: r() < 0.2, tenue: r() < 0.45 },
        enrolledAt: `2026-09-${String(1 + Math.floor(r() * 20)).padStart(2, "0")}`,
      });
    }
  }
}

genSainteMarie();
for (const seed of schoolSeeds.filter((s) => s.id !== SCHOOL_IDS.sainteMarie)) genSchool(seed);

/** Codes des enfants d'un parent — utilisés par les messages d'aide à la connexion. */
export function childCodesOf(parentId: string): string[] {
  return students.filter((s) => s.parentId === parentId).map((s) => s.childCode);
}

export function studentByChildCode(schoolId: string, code: string): Student | undefined {
  return students.find((s) => s.schoolId === schoolId && s.childCode.toUpperCase() === code.toUpperCase());
}