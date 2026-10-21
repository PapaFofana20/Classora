import { useEffect, useRef, useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/Brand";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useCurrentUser } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { actorIdOf, markRead, sendMessage, type ConversationView } from "@/services/messageService";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/format";

interface Props {
  conversation: ConversationView;
  onBack: () => void;
  onChanged: () => void;
}

export function counterpartName(c: ConversationView, role: string): string {
  if (role === "parent") return c.teacherName;
  if (role === "directeur") return `${c.teacherName} ↔ ${c.parentName}`;
  return c.parentName;
}

export function Thread({ conversation: c, onBack, onChanged }: Props) {
  const user = useCurrentUser();
  const { toast } = useToast();
  const me = actorIdOf(user);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const readOnly = user.role === "directeur";

  useEffect(() => {
    if (c.unread > 0) void markRead(user, c.id).then(onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, c.unread]);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [c.messages.length, c.id]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (text.trim().length < 1 || sending) return;
    setSending(true);
    try {
      await sendMessage(user, c.id, text);
      setText("");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Envoi impossible.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[70vh] min-h-[480px] flex-col overflow-hidden rounded-2xl bg-white shadow-card">
      <header className="flex items-center gap-3 border-b border-neutral-100 p-4">
        <button type="button" onClick={onBack} aria-label="Retour aux conversations" className="grid size-11 place-items-center rounded-full hover:bg-mist lg:hidden">
          <Icon name="arrow_back" />
        </button>
        <Avatar name={counterpartName(c, user.role)} size={42} />
        <div className="min-w-0">
          <p className="truncate font-bold">{counterpartName(c, user.role)}</p>
          <p className="truncate text-xs text-neutral-500">{c.subject} · élève : {c.studentName}</p>
        </div>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto bg-mist/60 p-4" role="log" aria-live="polite">
        {c.messages.map((m) => {
          const mine = m.senderId === me;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-card sm:max-w-[70%]", mine ? "rounded-br-sm bg-forest text-white" : "rounded-bl-sm bg-white")}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                <p className={cn("mt-1 text-right text-[10px]", mine ? "text-white/60" : "text-neutral-400")}>{formatDateTime(m.at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {readOnly ? (
        <p className="border-t border-neutral-100 p-4 text-center text-xs text-neutral-500">Supervision de la direction : lecture seule.</p>
      ) : (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-neutral-100 p-3">
          <label htmlFor="msg" className="sr-only">Votre message</label>
          <textarea
            id="msg"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) void send();
              if (e.key === "Enter" && !e.shiftKey) e.preventDefault();
            }}
            placeholder="Écrire un message…"
            maxLength={1000}
            className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-neutral-300 px-4 py-3 text-sm focus:border-forest focus:outline-none focus:ring-4 focus:ring-lime/50"
          />
          <Button type="submit" icon="send" loading={sending} disabled={text.trim().length === 0} aria-label="Envoyer" />
        </form>
      )}
    </div>
  );
}
