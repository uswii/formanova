import posthog from 'posthog-js';

/** Safe wrapper — only fires when PostHog is loaded */
function capture(event: string, properties?: Record<string, unknown>) {
  if (posthog.__loaded) {
    posthog.capture(event, properties);
  }
}

// ═══════ Auth Events ═══════

export function trackSignup(method: string, email?: string) {
  capture('user_signed_up', { method, email });
}

export function trackLogin(method: string, email?: string) {
  capture('user_logged_in', { method, email });
}

export function trackLogout() {
  capture('user_logged_out');
  if (posthog.__loaded) posthog.reset();
}

// ═══════ Feature Usage ═══════

export function trackStudioOpen(category: string) {
  capture('studio_opened', { category });
}

export function trackBatchSubmit(imageCount: number, category: string) {
  capture('batch_submitted', { image_count: imageCount, category });
}

export function trackGenerationStart(source: string) {
  capture('generation_started', { source });
}

export function trackGenerationComplete(source: string, durationMs?: number) {
  capture('generation_completed', { source, duration_ms: durationMs });
}

// ═══════ Conversion / Checkout ═══════

export function trackCheckoutStart(plan?: string) {
  capture('checkout_started', { plan });
}

export function trackPaymentSuccess(plan?: string) {
  capture('payment_success', { plan });
}

export function trackPaymentCancel() {
  capture('payment_cancelled');
}

// ═══════ Engagement ═══════

export function trackButtonClick(buttonName: string, context?: string) {
  capture('button_clicked', { button: buttonName, context });
}

export function trackFormSubmit(formName: string) {
  capture('form_submitted', { form: formName });
}

// ═══════ User Identification ═══════

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (posthog.__loaded) {
    posthog.identify(userId, properties);
  }
}
