import { onFCP, onLCP, onCLS, onINP, onTTFB } from 'web-vitals';
import posthog from 'posthog-js';

/**
 * Reports Core Web Vitals to PostHog.
 * Call once on the landing page after PostHog is ready.
 */
export function initWebVitals() {
  const reportVital = ({ name, value, rating }: { name: string; value: number; rating: string }) => {
    if (posthog.__loaded) {
      posthog.capture('web_vital', {
        metric: name,
        value: Math.round(value),
        rating,       // 'good' | 'needs-improvement' | 'poor'
        page: 'landing',
      });
    }
  };

  onFCP(reportVital);
  onLCP(reportVital);
  onCLS(reportVital);
  onINP(reportVital);
  onTTFB(reportVital);
}
