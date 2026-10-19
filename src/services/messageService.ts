import type { Announcement, Conversation, Role, SessionUser } from "@/types";
import { TODAY_ISO } from "@/data/school";
import { ensure, visibleClassIds } from "./access";
import { announcementsOf, assignmentsOf, classesOf, conversationsOf, db, parentsOf, persist, respond, studentsOf, subjectsOf, teachersOf, uid } from "./db";

/** Notifie l'interface (badge de messages non lus) qu'une conversation a changé. */
function emitChange(): void {
  window.dispatchEvent(new Event("ec:messages"));
}

/** Identifiant "acteur" dans la messagerie : parent, enseignant, élève, ou compte administratif. */
export function actorIdOf(user: SessionUser): string {
  if (user.role === "parent") return user.parentId ?? user.id;
  if (user.role === "instituteur" || user.role === "professeur") return user.teacherId ?? user.id;
  if (user.role === "eleve") return user.studentId ?? user.id;
  return user.id;
}

export function unreadIn(c: Conversation, actorId: string): number {
  const last = c.lastReadAt[actorId] ?? "";
  return c.messages.filter((m) => m.senderId !== actorId && m.at > last).length;
}

/** Conversations de l'école de l'acteur, restreintes à son périmètre. */
function conversationsFor(actor: SessionUser): Conversation[] {
  const mine = conversationsOf(actor.schoolId);
  switch (actor.role) {
    case "directeur":
    case "econome":
    case "surveillant":
      return mine;
    case "parent":
      return mine.filter((c) => c.parentId === actor.parentId);
    case "eleve": {
      const myParents = new Set(parentsOf(actor.schoolId).filter((p) => studentsOf(actor.schoolId).some((s) => s.id === actor.studentId && s.parentId === p.id)).map((p) => p.id));
      return mine.filter((c) => c.studentId === actor.studentId || myParents.has(c.parentId));
    }
    case "instituteur":
    case "professeur":
      return mine.filter((c) => c.teacherId === actor.teacherId);
    default:
      return [];
  }
}

export interface ConversationView extends Conversation {
  teacherName: string;
  parentName: string;
  studentName: string;
  unread: number;
}

function view(actor: SessionUser, c: Conversation, actorId: string): ConversationView {
  const t = teachersOf(actor.schoolId).find((x) => x.id === c.teacherId);
  const p = parentsOf(actor.schoolId).find((x) => x.id === c.parentId);
  const s = studentsOf(actor.schoolId).find((x) => x.id === c.studentId);
  return {
    ...c,
    teacherName: t ? `${t.firstName} ${t.lastName}` : "Enseignant",
    parentName: p ? `${p.firstName} ${p.lastName}` : "Parent",
    studentName: s ? `${s.firstName} ${s.lastName}` : "",
    unread: unreadIn(c, actorId),
  };
}

export function listConversations(actor: SessionUser): Promise<ConversationView[]> {
  return respond(() => {
    const id = actorIdOf(actor);
    return conversationsFor(actor)
      .map((c) => view(actor, c, id))
      .sort((a, b) => (b.messages[b.messages.length - 1]?.at ?? "").localeCompare(a.messages[a.messages.length - 1]?.at ?? ""));
  });
}

export function countUnread(actor: SessionUser): Promise<number> {
  return respond(() => {
    const id = actorIdOf(actor);
    return conversationsFor(actor).reduce((a, c) => a + unreadIn(c, id), 0);
  }, 50, 120);
}

export function sendMessage(actor: SessionUser, conversationId: string, text: string): Promise<ConversationView> {
  return respond(() => {
    const id = actorIdOf(actor);
    const c = conversationsFor(actor).find((x) => x.id === conversationId);
    ensure(!!c && actor.role !== "directeur", "Conversation indisponible.");
    if (!c) throw new Error("Conversation indisponible.");
    const at = `${TODAY_ISO}T${new Date().toTimeString().slice(0, 5)}`;
    c.messages.push({ id: uid("m"), senderId: id, text: text.trim(), at });
    c.lastReadAt[id] = at;
    persist();
    emitChange();
    return view(actor, c, id);
  }, 200, 400);
}

export function markRead(actor: SessionUser, conversationId: string): Promise<void> {
  return respond(() => {
    const id = actorIdOf(actor);
    const c = conversationsFor(actor).find((x) => x.id === conversationId);
    if (c && actor.role !== "directeur") {
      c.lastReadAt[id] = `${TODAY_ISO}T23:59`;
      persist();
      emitChange();
    }
  }, 30, 80);
}

export interface Contact {
  key: string;
  teacherId: string;
  parentId: string;
  studentId: string;
  label: string;
}

/** Destinataires possibles : parents de mes élèves (enseignant) ou enseignants de mes enfants (parent). */
export function listContacts(actor: SessionUser): Promise<Contact[]> {
  return respond(() => {
    const out: Contact[] = [];
    const students = studentsOf(actor.schoolId);
    const parents = parentsOf(actor.schoolId);
    const teachers = teachersOf(actor.schoolId);
    const subjects = subjectsOf(actor.schoolId);
    const assignments = assignmentsOf(actor.schoolId);
    if (actor.role === "parent" || actor.role === "eleve") {
      students
        .filter((s) => (actor.role === "parent" ? s.parentId === actor.parentId : s.id === actor.studentId))
        .forEach((s) => {
          const ids = Array.from(new Set(assignments.filter((a) => a.classId === s.classId).map((a) => a.teacherId)));
          ids.forEach((tid) => {
            const t = teachers.find((x) => x.id === tid);
            if (t) {
              const subs = assignments.filter((a) => a.classId === s.classId && a.teacherId === tid).map((a) => subjects.find((x) => x.id === a.subjectId)?.name ?? "");
              const subjectsLabel = t.kind === "instituteur" ? "Instituteur" : subs.join(", ");
              out.push({ key: `${tid}-${s.id}`, teacherId: tid, parentId: s.parentId, studentId: s.id, label: `${t.firstName} ${t.lastName} (${subjectsLabel}) · ${s.firstName}` });
            }
          });
        });
    } else if (actor.role === "instituteur" || actor.role === "professeur") {
      const tid = actor.teacherId ?? "";
      const classIds = actor.role === "instituteur" ? visibleClassIds(actor) : Array.from(new Set(assignments.filter((a) => a.teacherId === tid).map((a) => a.classId)));
      students
        .filter((s) => classIds.includes(s.classId))
        .forEach((s) => {
          const p = parents.find((x) => x.id === s.parentId);
          const cls = classesOf(actor.schoolId).find((c) => c.id === s.classId);
          if (p) out.push({ key: `${tid}-${s.id}`, teacherId: tid, parentId: p.id, studentId: s.id, label: `${p.firstName} ${p.lastName} · parent de ${s.firstName} (${cls?.name ?? ""})` });
        });
    }
    return out;
  });
}

export function startConversation(actor: SessionUser, contact: Contact, subject: string, text: string): Promise<ConversationView> {
  return respond(() => {
    const id = actorIdOf(actor);
    let c = conversationsOf(actor.schoolId).find((x) => x.teacherId === contact.teacherId && x.parentId === contact.parentId && x.studentId === contact.studentId);
    const at = `${TODAY_ISO}T${new Date().toTimeString().slice(0, 5)}`;
    if (!c) {
      c = { schoolId: actor.schoolId, id: uid("cv"), teacherId: contact.teacherId, parentId: contact.parentId, studentId: contact.studentId, subject: subject.trim(), messages: [], lastReadAt: {} };
      db.conversations.push(c);
    }
    c.messages.push({ id: uid("m"), senderId: id, text: text.trim(), at });
    c.lastReadAt[id] = at;
    persist();
    return view(actor, c, id);
  }, 250, 450);
}

export function listAnnouncements(actor: SessionUser): Promise<Announcement[]> {
  return respond(() =>
    announcementsOf(actor.schoolId)
      .filter((a) => a.audience === "all" || a.audience.includes(actor.role))
      .sort((a, b) => b.at.localeCompare(a.at)),
  );
}

export function postAnnouncement(actor: SessionUser, input: { title: string; body: string; audience: Role[] | "all" }): Promise<Announcement> {
  return respond(() => {
    ensure(actor.role === "directeur" || actor.role === "econome", "Seule la direction peut publier une annonce.");
    const a: Announcement = { schoolId: actor.schoolId, id: uid("an"), title: input.title.trim(), body: input.body.trim(), at: `${TODAY_ISO}T${new Date().toTimeString().slice(0, 5)}`, author: actor.role === "econome" ? "Économat" : "Direction", audience: input.audience };
    db.announcements.unshift(a);
    persist();
    return a;
  });
}