import type { Teacher } from "@/types";
import { classes } from "./classes";
import { SCHOOL_IDS, schoolSeeds } from "./schools";
import { mulberry32, pick } from "./seed";

const t = (schoolId: string, id: string, firstName: string, lastName: string, kind: Teacher["kind"], specialties: string[], phone: string): Teacher => ({
  schoolId,
  id,
  firstName,
  lastName,
  kind,
  specialties,
  phone,
  email: `${firstName}.${lastName}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z.]/g, "") + "@saintemarie-ecole.sn",
});

const ALL_ELEM = ["fr", "math", "sci", "hg", "civ", "arts", "eps"];

/** Enseignants du Collège Sainte Marie. */
const sainteMarie: Teacher[] = [
  t(SCHOOL_IDS.sainteMarie, "ti-ci", "Rokhaya", "Diouf", "instituteur", ALL_ELEM, "77 301 22 10"),
  t(SCHOOL_IDS.sainteMarie, "ti-cp", "Ndèye", "Sarr", "instituteur", ALL_ELEM, "78 455 12 09"),
  t(SCHOOL_IDS.sainteMarie, "ti-ce1", "Ibou", "Fall", "instituteur", ALL_ELEM, "76 220 90 31"),
  t(SCHOOL_IDS.sainteMarie, "ti-ce2", "Aminata", "Ba", "instituteur", ALL_ELEM, "77 640 18 22"),
  t(SCHOOL_IDS.sainteMarie, "ti-cm1", "Samba", "Thiam", "instituteur", ALL_ELEM, "70 118 65 40"),
  t(SCHOOL_IDS.sainteMarie, "ti-cm2a", "Moussa", "Sarr", "instituteur", ALL_ELEM, "77 560 71 02"),
  t(SCHOOL_IDS.sainteMarie, "ti-cm2b", "Coumba", "Gaye", "instituteur", ALL_ELEM, "78 902 33 14"),
  t(SCHOOL_IDS.sainteMarie, "t-math1", "Ibrahima", "Diop", "professeur", ["math"], "77 810 45 66"),
  t(SCHOOL_IDS.sainteMarie, "t-math2", "Cheikh", "Sow", "professeur", ["math"], "76 331 09 87"),
  t(SCHOOL_IDS.sainteMarie, "t-math3", "Pape", "Gueye", "professeur", ["math", "pc"], "70 744 21 53"),
  t(SCHOOL_IDS.sainteMarie, "t-fr1", "Awa", "Fall", "professeur", ["fr"], "77 905 11 28"),
  t(SCHOOL_IDS.sainteMarie, "t-fr2", "Mariama", "Sy", "professeur", ["fr"], "78 217 84 60"),
  t(SCHOOL_IDS.sainteMarie, "t-phil", "Ousmane", "Kane", "professeur", ["philo", "fr"], "77 628 03 91"),
  t(SCHOOL_IDS.sainteMarie, "t-ang1", "Fatou", "Mbaye", "professeur", ["ang"], "76 503 77 12"),
  t(SCHOOL_IDS.sainteMarie, "t-ang2", "Daouda", "Thiam", "professeur", ["ang"], "70 291 48 05"),
  t(SCHOOL_IDS.sainteMarie, "t-hg1", "Moustapha", "Cissé", "professeur", ["hg"], "77 134 56 79"),
  t(SCHOOL_IDS.sainteMarie, "t-hg2", "Abdou", "Ndoye", "professeur", ["hg"], "78 660 20 43"),
  t(SCHOOL_IDS.sainteMarie, "t-sc", "Khady", "Faye", "professeur", ["svt"], "77 472 90 18"),
  t(SCHOOL_IDS.sainteMarie, "t-pc", "Ndèye", "Diouf", "professeur", ["pc", "svt"], "76 888 31 07"),
  t(SCHOOL_IDS.sainteMarie, "t-eps", "Lamine", "Badji", "professeur", ["eps"], "70 355 62 84"),
];

const FIRST_F = ["Aïssatou", "Fatou", "Aminata", "Mariama", "Khady", "Ndèye", "Awa", "Coumba", "Astou", "Rokhaya"];
const FIRST_M = ["Mamadou", "Ibrahima", "Cheikh", "Moussa", "Ousmane", "Abdoulaye", "Modou", "Pape", "Serigne", "Alioune"];
const LAST = ["Diop", "Ndiaye", "Fall", "Sow", "Ba", "Sarr", "Gueye", "Faye", "Diallo", "Seck", "Mbaye", "Sy", "Thiam", "Cissé", "Kane"];
const PREFIXES = ["77", "78", "76", "70"];

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");

/** Enseignants générés pour les autres écoles de démonstration. */
const generated: Teacher[] = schoolSeeds.flatMap((seed) => {
  if (seed.teachers === 0) return [];
  const r = mulberry32(seed.seed);
  const hasElementary = seed.cycles.includes("elementaire");
  return Array.from({ length: seed.teachers }, (_, i) => {
    const isInstituteur = hasElementary && i === 0;
    const firstName = pick(r() < 0.5 ? FIRST_F : FIRST_M, r());
    const lastName = pick(LAST, r());
    const specialties = isInstituteur ? ALL_ELEM : [seed.subjects[i % seed.subjects.length], seed.subjects[(i + 2) % seed.subjects.length]].filter((v, k, a) => a.indexOf(v) === k);
    return {
      schoolId: seed.id,
      id: `t-${seed.prefix}-${i + 1}`,
      firstName,
      lastName,
      kind: isInstituteur ? ("instituteur" as const) : ("professeur" as const),
      email: `${slug(firstName)}.${slug(lastName)}${i + 1}@${seed.domain}`,
      phone: `${pick(PREFIXES, r())} ${100 + Math.floor(r() * 899)} ${10 + Math.floor(r() * 89)} ${10 + Math.floor(r() * 89)}`,
      specialties,
    };
  });
});

export const teachers: Teacher[] = [...sainteMarie, ...generated];

/**
 * Chaque classe générée reçoit un titulaire (élémentaire) ou un professeur
 * principal : le premier enseignant de l'école de ce type.
 */
for (const seed of schoolSeeds) {
  if (seed.teachers === 0) continue;
  const staff = generated.filter((x) => x.schoolId === seed.id);
  const titular = staff.find((x) => x.kind === "instituteur");
  const principal = staff.find((x) => x.kind === "professeur");
  for (const c of classes.filter((x) => x.schoolId === seed.id)) {
    c.headTeacherId = (c.cycle === "elementaire" ? titular?.id : principal?.id) ?? null;
  }
}