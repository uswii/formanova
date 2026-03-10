/**
 * Frontend feature flags for gating features to specific users.
 * This is a UI-only gate — not a security boundary.
 */

const CAD_ALLOWED_EMAILS = ['uswa@raresense.so'];

export function isCADEnabled(userEmail: string | undefined | null): boolean {
  if (!userEmail) return false;
  return CAD_ALLOWED_EMAILS.includes(userEmail.toLowerCase());
}

/**
 * Toggle to show/hide the Edit, Rebuild Part, and Add-On tools
 * in the Text-to-CAD left panel. Set to true to re-enable.
 */
export const CAD_EDIT_TOOLS_ENABLED = false;
