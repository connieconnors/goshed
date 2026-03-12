/**
 * LocalStorage hint for which emails have a password set (so login page can show password field).
 * Key is shared between login and account pages.
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
