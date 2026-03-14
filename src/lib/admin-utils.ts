/**
 * UI-only admin check. Security is enforced server-side.
 */
const ADMIN_EMAILS: string[] = [
  'hassan@raresense.so',
  'sophia@raresense.so',
  'uswa@raresense.so',
];

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
