-- Track bulk notification emails to prevent duplicates
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  campaign text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_email, campaign)
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- No direct client access - only edge functions with service role
CREATE POLICY "No direct access" ON public.notification_log FOR ALL USING (false);