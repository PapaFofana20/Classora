import type { Announcement, Conversation } from "@/types";
import { SCHOOL_IDS } from "./schools";
import { students } from "./students";

const inClass = (classId: string, idx: number) => students.filter((s) => s.classId === classId)[idx];

const cm2a1 = inClass("c-cm2-a", 1);
const cm2a2 = inClass("c-cm2-a", 2);
const c5b = inClass("c-5b", 0);
const c6a = inClass("c-6a", 1);
const c2l = inClass("c-2l", 0);
const ca6a = inClass("c-ca-6ea", 0);
const ca5a = inClass("c-ca-5ea", 1);

const msg = (id: string, senderId: string, text: string, at: string) => ({ id, senderId, text, at });
const SM = SCHOOL_IDS.sainteMarie;
const CA = SCHOOL_IDS.cheikhAnta;

export const conversations: Conversation[] = [
  {
    schoolId: SM,
    id: "cv-1",
    teacherId: "t-math2",
    parentId: "p-demo",
    studentId: "s-mamadou",
    subject: "Résultats de Mamadou en mathématiques",
    lastReadAt: { "p-demo": "2026-12-10T09:30", "t-math2": "2026-12-10T14:30" },
    messages: [
      msg("m1", "p-demo", "Bonjour Monsieur Sow, pouvez-vous me dire comment Mamadou se débrouille en mathématiques ce semestre ?", "2026-12-10T09:12"),
      msg("m2", "t-math2", "Bonjour Madame Ndiaye, Mamadou a de bons résultats : 14/20 au premier devoir. Je l'encourage à poursuivre ses efforts.", "2026-12-10T14:30"),
    ],
  },
  {
    schoolId: SM,
    id: "cv-2",
    teacherId: "ti-ce2",
    parentId: "p-demo",
    studentId: "s-aida",
    subject: "Sortie pédagogique à Gorée",
    lastReadAt: { "p-demo": "2026-12-08T18:00", "ti-ce2": "2026-12-12T08:00" },
    messages: [
      msg("m3", "p-demo", "Bonsoir Madame Ba, Aïda peut-elle participer à la sortie ? Quel est le coût ?", "2026-12-08T17:40"),
      msg("m4", "ti-ce2", "Bonsoir Madame Ndiaye, la sortie à Gorée est prévue le 19/12/2026. Participation : 5 000 FCFA. Merci de signer l'autorisation dans le cahier de liaison.", "2026-12-12T07:55"),
    ],
  },
  {
    schoolId: SM,
    id: "cv-3",
    teacherId: "ti-cm2a",
    parentId: cm2a1.parentId,
    studentId: cm2a1.id,
    subject: "Préparation du CFEE",
    lastReadAt: { "ti-cm2a": "2026-12-09T10:00", [cm2a1.parentId]: "2026-12-11T12:00" },
    messages: [
      msg("m5", "ti-cm2a", "Bonjour, pour préparer le CFEE, je recommande 30 minutes de lecture et de calcul mental chaque soir.", "2026-12-09T09:30"),
      msg("m6", cm2a1.parentId, "Merci Monsieur Sarr. Pouvez-vous nous indiquer les annales à utiliser pour l'entraînement ?", "2026-12-13T19:05"),
    ],
  },
  {
    schoolId: SM,
    id: "cv-4",
    teacherId: "ti-cm2a",
    parentId: cm2a2.parentId,
    studentId: cm2a2.id,
    subject: "Absence de lundi",
    lastReadAt: { "ti-cm2a": "2026-12-14T09:00", [cm2a2.parentId]: "2026-12-14T08:20" },
    messages: [
      msg("m7", cm2a2.parentId, "Bonjour Monsieur, mon enfant était malade lundi. Un certificat sera remis demain.", "2026-12-14T07:50"),
      msg("m8", "ti-cm2a", "Bien reçu, merci de l'information. Je lui transmettrai les leçons manquées.", "2026-12-14T08:15"),
    ],
  },
  {
    schoolId: SM,
    id: "cv-5",
    teacherId: "t-math1",
    parentId: c5b.parentId,
    studentId: c5b.id,
    subject: "Devoir de mathématiques du 12/12/2026",
    lastReadAt: { "t-math1": "2026-12-12T10:00" },
    messages: [msg("m9", c5b.parentId, "Bonjour Monsieur Diop, mon enfant n'a pas pu composer vendredi. Peut-il rattraper le devoir ?", "2026-12-14T18:20")],
  },
  {
    schoolId: SM,
    id: "cv-6",
    teacherId: "t-math1",
    parentId: c6a.parentId,
    studentId: c6a.id,
    subject: "Soutien en mathématiques",
    lastReadAt: { "t-math1": "2026-12-11T16:00", [c6a.parentId]: "2026-12-11T16:10" },
    messages: [
      msg("m10", c6a.parentId, "Bonjour, y a-t-il des séances de soutien en mathématiques pour la 6ème ?", "2026-12-11T15:00"),
      msg("m11", "t-math1", "Oui, tous les mercredis de 15 h à 16 h 30, salle 4. Inscription auprès de la surveillance.", "2026-12-11T15:45"),
    ],
  },
  {
    schoolId: SM,
    id: "cv-7",
    teacherId: "t-fr1",
    parentId: c2l.parentId,
    studentId: c2l.id,
    subject: "Œuvre au programme : Une si longue lettre",
    lastReadAt: { "t-fr1": "2026-12-13T09:00" },
    messages: [msg("m12", c2l.parentId, "Bonjour Madame Fall, où peut-on se procurer l'œuvre au programme ?", "2026-12-14T20:10")],
  },
  {
    schoolId: CA,
    id: "cv-ca-1",
    teacherId: "t-ca-2",
    parentId: ca6a.parentId,
    studentId: ca6a.id,
    subject: "Devoir surveillé de mathématiques",
    lastReadAt: { "t-ca-2": "2026-12-14T18:00", [ca6a.parentId]: "2026-12-15T07:10" },
    messages: [
      msg("m-ca-1", ca6a.parentId, "Bonjour, mon enfant a manqué le devoir surveillé de lundi. Y a-t-il une session de rattrapage ?", "2026-12-15T07:05"),
      msg("m-ca-2", "t-ca-2", "Bonjour, une session de rattrapage est prévue mercredi à 15 h. Merci de prévenir l'administration.", "2026-12-15T08:12"),
    ],
  },
  {
    schoolId: CA,
    id: "cv-ca-2",
    teacherId: "t-ca-1",
    parentId: ca5a.parentId,
    studentId: ca5a.id,
    subject: "Fermeture temporaire des inscriptions",
    lastReadAt: { "t-ca-1": "2026-12-15T09:00", [ca5a.parentId]: "2026-12-15T09:30" },
    messages: [msg("m-ca-3", "t-ca-1", "Bonjour, les inscriptions sont momentanément fermées pour cause de réorganisation des effectifs. Elles rouvriront après la rentrée de janvier.", "2026-12-15T08:45")],
  },
];

export const announcements: Announcement[] = [
  {
    schoolId: SM,
    id: "an-1",
    title: "Composition du 1er semestre",
    body: "Les compositions du 1er semestre auront lieu du 11/01/2027 au 22/01/2027. Le calendrier détaillé par classe sera affiché à l'entrée de l'école.",
    at: "2026-12-14T08:00",
    author: "Direction",
    audience: "all",
  },
  {
    schoolId: SM,
    id: "an-2",
    title: "Réunion parents-professeurs",
    body: "La réunion parents-professeurs aura lieu le samedi 19/12/2026 à 9 h dans la cour principale. Votre présence est vivement souhaitée.",
    at: "2026-12-11T10:30",
    author: "Direction",
    audience: ["parent", "instituteur", "professeur", "directeur"],
  },
  {
    schoolId: SM,
    id: "an-3",
    title: "Rappel : mensualité de décembre",
    body: "Nous rappelons aux parents que la mensualité de décembre était attendue avant le 05/12/2026. Paiement possible par Wave, Orange Money et Free Money depuis votre espace.",
    at: "2026-12-09T09:00",
    author: "Économat",
    audience: ["parent", "econome", "directeur"],
  },
  {
    schoolId: SM,
    id: "an-4",
    title: "Rentrée 2026-2027",
    body: "Bienvenue à toutes et à tous pour cette nouvelle année scolaire 2026-2027 ! Les cours ont débuté le 01/10/2026.",
    at: "2026-10-01T07:30",
    author: "Direction",
    audience: "all",
  },
  {
    schoolId: CA,
    id: "an-ca-1",
    title: "Inscriptions temporairement fermées",
    body: "Les inscriptions en ligne sont fermées jusqu'à la rentrée de janvier. Les familles déjà inscrites sont priées de passer à l'administration pour la deuxième tranche.",
    at: "2026-12-15T08:00",
    author: "Direction",
    audience: "all",
  },
];