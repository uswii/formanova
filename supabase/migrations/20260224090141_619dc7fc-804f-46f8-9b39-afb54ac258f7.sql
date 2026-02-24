
-- ============================================
-- DELIVERY SYSTEM TABLES
-- ============================================

-- Delivery batches - groups of reviewed results ready for email delivery
CREATE TABLE IF NOT EXISTS public.delivery_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    safe_email TEXT NOT NULL,
    override_email TEXT,
    category TEXT,
    token TEXT UNIQUE,
    delivery_status TEXT NOT NULL DEFAULT 'completed',
    delivered_at TIMESTAMPTZ,
    email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_batches_batch_id ON public.delivery_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_user_email ON public.delivery_batches(user_email);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_token ON public.delivery_batches(token);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_status ON public.delivery_batches(delivery_status);

-- Delivery images - individual images within a delivery batch
CREATE TABLE IF NOT EXISTS public.delivery_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_batch_id UUID NOT NULL REFERENCES public.delivery_batches(id) ON DELETE CASCADE,
    image_filename TEXT NOT NULL,
    image_url TEXT NOT NULL,
    sequence INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_images_batch_id ON public.delivery_images(delivery_batch_id);

-- Enable RLS
ALTER TABLE public.delivery_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_images ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owner
ALTER TABLE public.delivery_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_images FORCE ROW LEVEL SECURITY;

-- Deny-all RLS policies (all access via service role in edge functions)
CREATE POLICY "No direct select on delivery_batches" ON public.delivery_batches FOR SELECT USING (false);
CREATE POLICY "No direct insert on delivery_batches" ON public.delivery_batches FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct update on delivery_batches" ON public.delivery_batches FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "No direct delete on delivery_batches" ON public.delivery_batches FOR DELETE USING (false);

CREATE POLICY "No direct select on delivery_images" ON public.delivery_images FOR SELECT USING (false);
CREATE POLICY "No direct insert on delivery_images" ON public.delivery_images FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct update on delivery_images" ON public.delivery_images FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "No direct delete on delivery_images" ON public.delivery_images FOR DELETE USING (false);

-- Updated_at triggers
CREATE TRIGGER update_delivery_batches_updated_at
    BEFORE UPDATE ON public.delivery_batches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
