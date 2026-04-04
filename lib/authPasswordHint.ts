/**
 * LocalStorage list of emails that have a password on this device (login shows password + Sign in).
 * Key: goshed_has_password_emails — JSON string array of lowercase emails.
 */
export const HAS_PASSWORD_EMAILS_KEY = "goshed_has_password_emails";

export function getEmailsWithPassword(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HAS_PASSWORD_EMAILS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addEmailWithPassword(email: string): void {
  if (typeof window === "undefined" || !email?.includes("@")) return;
  const set = new Set(getEmailsWithPassword());
  set.add(email.toLowerCase());
  localStorage.setItem(HAS_PASSWORD_EMAILS_KEY, JSON.stringify([...set]));
}
