import { useState, useEffect } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { AUTHENTICATED_IMAGES_ENABLED } from "@/lib/feature-flags";

/**
 * Returns a renderable URL for an image src.
 *
 * - If the URL contains "/artifacts/", fetches with Bearer token and
 *   returns a temporary blob URL. Revokes the blob URL on cleanup.
 * - All other URLs (static assets, external CDN, null) are returned as-is.
 *
 * The "/artifacts/" check covers both dev (http://localhost:8000/artifacts/...)
 * and prod (https://formanova.ai/api/artifacts/...) without env-specific logic.
 */
export function useAuthenticatedImage(url: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      return;
    }

    // Pass through when feature is disabled or URL is not an artifacts path
    if (!AUTHENTICATED_IMAGES_ENABLED || !url.includes("/artifacts/")) {
      setBlobUrl(url);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    authenticatedFetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return blobUrl;
}
