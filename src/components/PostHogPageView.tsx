import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import posthog from 'posthog-js';

/**
 * Captures a PostHog $pageview on every React Router route change.
 * Must be rendered inside <BrowserRouter>.
 */
export function PostHogPageView() {
  const location = useLocation();

  useEffect(() => {
    // Only fire if PostHog has been initialized
    if (posthog.__loaded) {
      posthog.capture('$pageview', {
        $current_url: window.location.href,
      });
    }
  }, [location.pathname, location.search]);

  return null;
}
