-- Add drive_link column for Google Drive links on sent/delivered batches
ALTER TABLE public.batch_jobs ADD COLUMN drive_link text;