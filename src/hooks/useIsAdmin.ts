import { useAuth } from '@/contexts/AuthContext';

/**
 * UI-only admin gating. Security is enforced server-side by the backend whitelist.
 * This list controls visibility of admin UI elements only.
 */
const ADMIN_EMAILS: string[] = [
  'hassan@raresense.so',
  'sophia@raresense.so',
  'uswa@raresense.so',
];

export function useIsAdmin(): boolean {
  const { user } = useAuth();
  if (!user?.email) return false;
  return ADMIN_EMAILS.includes(user.email.toLowerCase());
}
