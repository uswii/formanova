/**
 * Frontend feature flags for gating features to specific users.
 * This is a UI-only gate — not a security boundary.
 */

const CAD_ALLOWED_DOMAIN = 'raresense.so';

export function isCADEnabled(userEmail: string | undefined | null): boolean {
  if (!userEmail) return false;
  return userEmail.toLowerCase().endsWith(`@${CAD_ALLOWED_DOMAIN}`);
}

/**
 * Toggle to show/hide the Edit, Rebuild Part, and Add-On tools
 * in the Text-to-CAD left panel. Set to true to re-enable.
 */
export const CAD_EDIT_TOOLS_ENABLED = false;

/**
 * Toggle to show/hide the AI model quality selector
 * in the Text-to-CAD studio. When false, defaults to 'gemini' (Lite).
 * Set to true to re-enable model selection.
 */
export const CAD_MODEL_SELECTOR_ENABLED = false;
