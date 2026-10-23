import { supabase } from "@/lib/supabase";

export interface ContactMessage {
  name: string;
  email: string;
  phone: string;
  school: string;
  subject: string;
  message: string;
}

/** Envoi du formulaire de contact public via Supabase (insert-only, RLS). */
export async function sendContactMessage(msg: ContactMessage): Promise<boolean> {
  const { error } = await supabase.from("contact_messages").insert({
    name: msg.name,
    email: msg.email,
    phone: msg.phone,
    school: msg.school,
    subject: msg.subject,
    message: msg.message,
  });
  if (error) throw new Error(error.message);
  return true;
}