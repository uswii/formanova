-- Add global inspiration URL to batch_jobs
ALTER TABLE public.batch_jobs
ADD COLUMN inspiration_url text DEFAULT NULL;

-- Add per-image inspiration URL override to batch_images
ALTER TABLE public.batch_images
ADD COLUMN inspiration_url text DEFAULT NULL;

COMMENT ON COLUMN public.batch_jobs.inspiration_url IS 'Global mood board / inspiration image URL (Azure Blob). Applied to all images unless overridden per-image.';
COMMENT ON COLUMN public.batch_images.inspiration_url IS 'Per-image inspiration override URL (Azure Blob). When set, overrides the global batch-level inspiration for this image only.';