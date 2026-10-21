// ============================================================================
// AUDIT — Tests de parité et de cohérence côté front (exécutables sans
// navigateur). Lancement : node scripts/audit-parite.mjs
//
// Ces tests encodent le comportement ATTENDU. Ils échouent sur le code
// audité : chaque échec est un constat.
// ============================================================================
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(process.cwd());
const TMP = mkdtempSync(join(tmpdir(), "scolia-audit-"));
const OUT = join(TMP, "bundle.mjs");

const ENTRY = `
export { computeSubscriptionInfo } from "@/utils/subscription";
export { subjectAverage, weightedAverage, computeRanks, appreciation, parseGradeInput, round2, devoirsAverage } from "@/utils/grades";
export { computeStatus, discountedMonthly } from "@/utils/payments";
export { TODAY_ISO, SCHOOL_YEAR } from "@/data/school";
export { generateCode, formatMatriculeInput, isValidMatricule } from "@/utils/matricule";
`;

await build({
  stdin: { contents: ENTRY, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile: OUT,
  alias: { "@": join(ROOT, "src") },
  logLevel: "silent",
});

const m = await import(pathToFileURL(OUT).href);

let failures = 0;
let checks = 0;
function is(label, actual, expected) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.log(`  x ${label}\n      obtenu   = ${a}\n      attendu  = ${e}`);
  } else {
    console.log(`  ok ${label}`);
  }
}
function ok(label, cond) {
  checks++;
  if (!cond) {
    failures++;
    console.log(`  x ${label}`);
  } else {
    console.log(`  ok ${label}`);
  }
}

// ---------------------------------------------------------------------------
console.log("\n[1] Statut d'abonnement : le front doit utiliser la date réelle");
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const realToday = iso(today);
const inFiveDays = iso(new Date(today.getTime() + 5 * 86400000));

const sub = {
  id: "s1", schoolId: "e1", plan: "pro", status: "ACTIF", startsAt: realToday,
  endsAt: inFiveDays, studentLimit: 300, amountPaid: 0, paymentRef: "", paidAt: realToday,
};
// Ce que le serveur calcule (subscription_status_of : ends_at >= current_date).
const serverStatus = "ACTIF";
// Ce que le front calcule en utilisant TODAY_ISO.
const frontStatus = m.computeSubscriptionInfo(sub, undefined, 0, m.TODAY_ISO).status;
is("le statut d'abonnement du front concorde avec celui du serveur (J+5)", frontStatus, serverStatus);
ok("TODAY_ISO n'est pas figé", m.TODAY_ISO === new Date().toISOString().slice(0, 10));

// ---------------------------------------------------------------------------
console.log("\n[2] Statut de paiement : idem");
const frontPay = m.computeStatus(20000, 0, inFiveDays, m.TODAY_ISO);
const serverPay = "a_venir";
is("le statut d'échéance du front concorde avec celui du serveur (J+5)", frontPay, serverPay);

// ---------------------------------------------------------------------------
console.log("\n[3] Parité des moyennes avec le serveur (grade_subject_average)");
is("élémentaire : composition seule", m.subjectAverage({ devoir1: 15, devoir2: 15, composition: 12 }, "elementaire"), 12);
is("moyen : (devoirs + composition) / 2", m.subjectAverage({ devoir1: 10, devoir2: 14, composition: 12 }, "moyen"), 12);
is("devoir1 seul", m.subjectAverage({ devoir1: 10, devoir2: null, composition: null }, "moyen"), 10);
is("composition seule", m.subjectAverage({ devoir1: null, devoir2: null, composition: 12 }, "moyen"), 12);
is("devoirs sans composition", m.subjectAverage({ devoir1: 10, devoir2: 14, composition: null }, "moyen"), 12);
is("aucune note", m.subjectAverage({ devoir1: null, devoir2: null, composition: null }, "moyen"), null);
is("moyenne des devoirs", m.devoirsAverage({ devoir1: 10, devoir2: 14 }), 12);
is("moyenne pondérée", m.weightedAverage([{ average: 10, coefficient: 1 }, { average: 14, coefficient: 3 }]), 13);
is("matière sans note ignorée", m.weightedAverage([{ average: 10, coefficient: 1 }, { average: null, coefficient: 5 }]), 10);
is("coefficient 0 : pas de division par zéro", m.weightedAverage([{ average: 10, coefficient: 0 }]), null);

// ---------------------------------------------------------------------------
console.log("\n[4] Appréciations : seuils exacts");
is("16", m.appreciation(16), "Excellent");
is("15,99", m.appreciation(15.99), "Très bien");
is("14", m.appreciation(14), "Très bien");
is("12", m.appreciation(12), "Bien");
is("10", m.appreciation(10), "Assez bien");
is("8", m.appreciation(8), "Passable");
is("5", m.appreciation(5), "Insuffisant");
is("4,99", m.appreciation(4.99), "Très faible");
is("sans note", m.appreciation(null), "—");

// ---------------------------------------------------------------------------
console.log("\n[5] Saisie de note : bornes");
is("20 accepté", m.parseGradeInput("20"), { ok: true, value: 20 });
is("0 accepté", m.parseGradeInput("0"), { ok: true, value: 0 });
is("20,01 refusé", m.parseGradeInput("20,01").ok, false);
is("virgule acceptée", m.parseGradeInput("12,5"), { ok: true, value: 12.5 });
is("NaN refusé", m.parseGradeInput("NaN").ok, false);
is("texte refusé", m.parseGradeInput("abc").ok, false);

// ---------------------------------------------------------------------------
console.log("\n[6] Rangs : ex æquo");
const ranks = m.computeRanks([
  { id: "a", value: 15 }, { id: "b", value: 15 }, { id: "c", value: 10 }, { id: "d", value: null },
]);
is("ex æquo : même rang", [ranks.get("a"), ranks.get("b")], [1, 1]);
is("élève sans note : pas de rang", ranks.get("d"), undefined);
is("élève suivant : rang 3", ranks.get("c"), 3);

// ---------------------------------------------------------------------------
console.log("\n[7] Remise fratrie : arrondi à 500 FCFA");
is("arrondi à 500 (20000 - 10 %)", m.discountedMonthly(20000, 10), 18000);
is("arrondi à 500 (22500 - 10 %)", m.discountedMonthly(22500, 10), 20500);

// ---------------------------------------------------------------------------
console.log("\n[8] Matricule : alphabet et longueur");
const code = m.generateCode([], 6);
is("longueur 6", code.length, 6);
ok("alphabet sans 0/O/1/I", /^[2-9A-HJ-NP-Z]{6}$/.test(code));
is("nettoyage d'une saisie collée", m.formatMatriculeInput("x7 k-9q"), "X7K9Q");
is("matricule valide", m.isValidMatricule("X7K9Q", 5), true);

console.log(`\n--- ${checks} vérifications, ${failures} échec(s) ---`);
process.exit(failures === 0 ? 0 : 1);
