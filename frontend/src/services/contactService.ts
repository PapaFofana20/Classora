import { respond } from "./db";

export interface ContactMessage {
  name: string;
  email: string;
  phone: string;
  school: string;
  subject: string;
  message: string;
}

/** Envoi simulé du formulaire de contact (remplaçable par un appel API). */
export function sendContactMessage(msg: ContactMessage): Promise<boolean> {
  return respond(() => {
    void msg;
    return true;
  });
}
