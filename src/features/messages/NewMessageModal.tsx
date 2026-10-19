import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useCurrentUser } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { startConversation, type Contact } from "@/services/messageService";

interface Props {
  open: boolean;
  contacts: Contact[];
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export function NewMessageModal({ open, contacts, onClose, onCreated }: Props) {
  const user = useCurrentUser();
  const { toast } = useToast();
  const [key, setKey] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const contact = contacts.find((c) => c.key === key);
  const valid = !!contact && subject.trim().length >= 3 && text.trim().length >= 5;

  const send = async () => {
    if (!contact) return;
    setBusy(true);
    try {
      const c = await startConversation(user, contact, subject, text);
      toast("Message envoyé.");
      setKey("");
      setSubject("");
      setText("");
      onCreated(c.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Envoi impossible.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouveau message" footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button variant="dark" icon="send" disabled={!valid} loading={busy} onClick={() => void send()}>Envoyer</Button></>}>
      <div className="grid gap-4">
        <Select label="Destinataire" required placeholder="Choisir un destinataire" value={key} onChange={(e) => setKey(e.target.value)} options={contacts.map((c) => ({ value: c.key, label: c.label }))} />
        <Input label="Objet" required value={subject} onChange={(e) => setSubject(e.target.value)} error={subject && subject.trim().length < 3 ? "L'objet doit contenir au moins 3 caractères." : null} />
        <Textarea label="Message" required value={text} onChange={(e) => setText(e.target.value)} error={text && text.trim().length < 5 ? "Le message est trop court." : null} />
      </div>
    </Modal>
  );
}
