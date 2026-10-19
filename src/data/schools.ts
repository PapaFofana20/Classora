import type { Cycle, School, SchoolSettings } from "@/types";
import { DEFAULT_ANNEX_FEES, DEFAULT_SIBLING_DISCOUNT, SCHOOL_YEAR, scaleFees } from "./school";

/**
 * Identifiants des écoles de démonstration.
 * Les identifiants courts (`sainteMarie`, …) sont utilisés partout dans les données.
 */
export const SCHOOL_IDS = {
  sainteMarie: "sch-sainte-marie",
  cheikhAnta: "sch-cheikh-anta",
  horizon: "sch-horizon",
  teranga: "sch-teranga",
} as const;

export type SchoolKey = keyof typeof SCHOOL_IDS;

/** Paramètres de génération des données de démonstration par école. */
export interface SchoolSeed {
  id: string;
  name: string;
  matricule: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  cycles: Cycle[];
  registrationOpen: boolean;
  autoApproveStudents: boolean;
  /** Préfixe des identifiants (classes, élèves, parents). */
  prefix: string;
  /** Domaine des adresses e-mail des enseignants. */
  domain: string;
  /** Classes générées automatiquement (Sainte Marie est écrite à la main dans data/classes). */
  levels: { levelId: string; sections: string[]; series?: string[] }[];
  /** Matières enseignées (hors élémentaire, où l'instituteur prend tout). */
  subjects: string[];
  /** Nombre d'enseignants générés automatiquement (0 pour Sainte Marie). */
  teachers: number;
  /** Élèves générés par classe et par cycle. */
  sizes: Partial<Record<Cycle, number>>;
  feesFactor: number;
  seed: number;
  createdAt: string;
}

export const schoolSeeds: SchoolSeed[] = [
  {
    id: SCHOOL_IDS.sainteMarie,
    name: "Collège Sainte Marie",
    matricule: "SM7K4Q",
    city: "Dakar",
    address: "Cité Keur Gorgui, Rue 12 · Dakar",
    phone: "+221 33 821 45 60",
    email: "direction@saintemarie-ecole.sn",
    cycles: ["elementaire", "moyen", "secondaire"],
    registrationOpen: true,
    autoApproveStudents: false,
    prefix: "sm",
    domain: "saintemarie-ecole.sn",
    levels: [],
    subjects: ["fr", "math", "ang", "hg", "svt", "pc", "philo", "eps"],
    teachers: 0,
    sizes: { elementaire: 5, moyen: 5, secondaire: 4 },
    feesFactor: 1,
    seed: 20262027,
    createdAt: "2026-08-12",
  },
  {
    id: SCHOOL_IDS.cheikhAnta,
    name: "Groupe Scolaire Cheikh Anta",
    matricule: "CA9M3X",
    city: "Thiès",
    address: "Avenue de la Nation, Quartier Kennedy · Thiès",
    phone: "+221 33 811 07 22",
    email: "direction@cheikhanta-ecole.sn",
    cycles: ["elementaire", "moyen"],
    registrationOpen: false,
    autoApproveStudents: false,
    prefix: "ca",
    domain: "cheikhanta-ecole.sn",
    levels: [
      { levelId: "ce1", sections: ["A"] },
      { levelId: "cm2", sections: ["A"] },
      { levelId: "6e", sections: ["A", "B"] },
      { levelId: "5e", sections: ["A"] },
    ],
    subjects: ["fr", "math", "ang", "hg", "eps"],
    teachers: 6,
    sizes: { elementaire: 4, moyen: 4 },
    feesFactor: 0.9,
    seed: 771205,
    createdAt: "2026-09-02",
  },
  {
    id: SCHOOL_IDS.horizon,
    name: "Institut Horizon",
    matricule: "HZ4T8R",
    city: "Mbour",
    address: "Zone de l'Aéroport, Mbour",
    phone: "+221 33 845 90 11",
    email: "contact@institut-horizon.sn",
    cycles: ["moyen", "secondaire"],
    registrationOpen: true,
    autoApproveStudents: false,
    prefix: "ho",
    domain: "institut-horizon.sn",
    levels: [
      { levelId: "6e", sections: ["A"] },
      { levelId: "3e", sections: ["A"] },
      { levelId: "2nde", sections: ["S1"] },
    ],
    subjects: ["fr", "math", "ang", "hg", "pc", "svt", "eps"],
    teachers: 5,
    sizes: { moyen: 4, secondaire: 3 },
    feesFactor: 1.1,
    seed: 348812,
    createdAt: "2026-07-20",
  },
  {
    id: SCHOOL_IDS.teranga,
    name: "Complexe Scolaire Teranga",
    matricule: "TG6N2P",
    city: "Saint-Louis",
    address: "Quartier Nord, Saint-Louis",
    phone: "+221 33 822 30 05",
    email: "direction@teranga-ecole.sn",
    cycles: ["elementaire", "secondaire"],
    registrationOpen: true,
    autoApproveStudents: true,
    prefix: "te",
    domain: "teranga-ecole.sn",
    levels: [
      { levelId: "cp", sections: ["A"] },
      { levelId: "tle", sections: ["A"] },
    ],
    subjects: ["fr", "math", "ang", "hg", "philo", "eps"],
    teachers: 4,
    sizes: { elementaire: 3, secondaire: 3 },
    feesFactor: 1,
    seed: 559021,
    createdAt: "2026-06-14",
  },
];

export const schools: School[] = schoolSeeds.map((s) => ({
  id: s.id,
  name: s.name,
  matricule: s.matricule,
  city: s.city,
  address: s.address,
  phone: s.phone,
  email: s.email,
  cycles: s.cycles,
  registrationOpen: s.registrationOpen,
  autoApproveStudents: s.autoApproveStudents,
  createdAt: s.createdAt,
}));

/** Matricules des écoles de démonstration (utilisés par les écrans d'aide). */
export const SCHOOLS = schools.filter((s) => s.matricule.length > 0);

export const schoolSettings: SchoolSettings[] = schoolSeeds.map((s) => ({
  schoolId: s.id,
  name: s.name,
  address: s.address,
  phone: s.phone,
  email: s.email,
  schoolYear: SCHOOL_YEAR,
  cycles: s.cycles,
  periodType: "semestre" as const,
  currentPeriod: "S1",
  fees: scaleFees(s.feesFactor),
  annexFees: {
    cantine: Math.round((DEFAULT_ANNEX_FEES.cantine * s.feesFactor) / 500) * 500,
    transport: Math.round((DEFAULT_ANNEX_FEES.transport * s.feesFactor) / 500) * 500,
    tenue: Math.round((DEFAULT_ANNEX_FEES.tenue * s.feesFactor) / 500) * 500,
  },
  siblingDiscount: DEFAULT_SIBLING_DISCOUNT,
}));

export const seedOf = (schoolId: string): SchoolSeed => {
  const found = schoolSeeds.find((s) => s.id === schoolId);
  if (!found) throw new Error(`École inconnue : ${schoolId}`);
  return found;
};

export const schoolName = (schoolId: string): string => schools.find((s) => s.id === schoolId)?.name ?? "École";