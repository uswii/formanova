/**
 * Frontend feature flags for gating features to specific users.
 * This is a UI-only gate — not a security boundary.
 */

export function isCADEnabled(_userEmail: string | undefined | null): boolean {
  return true;
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

/**
 * Users allowed to see the weight estimation + STL export tools.
 */
const WEIGHT_STL_EMAILS = ['uswa@raresense.so'];

export function isWeightStlEnabled(email: string | undefined | null): boolean {
  if (!email) return false;
  return WEIGHT_STL_EMAILS.includes(email.toLowerCase());
}

/**
 * Users who see the alternate two-column upload layout (internal experiment).
 */
const ALT_UPLOAD_LAYOUT_EMAILS = ['uswa@raresense.so'];

export function isAltUploadLayoutEnabled(email: string | undefined | null): boolean {
  if (!email) return false;
  return ALT_UPLOAD_LAYOUT_EMAILS.includes(email.toLowerCase());
}

/**
 * Users allowed to see the "Upload CAD File" button on the initial prompt screen.
 */
const CAD_UPLOAD_EMAILS = ['uswa@raresense.so', 'abdullah@raresense.so'];

export function isCadUploadEnabled(email: string | undefined | null): boolean {
  if (!email) return false;
  return CAD_UPLOAD_EMAILS.includes(email.toLowerCase());
}
