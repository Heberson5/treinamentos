-- Carrossel de imagens (prints do sistema) exibido na landing page pública
ALTER TABLE public.landing_page_config
  ADD COLUMN IF NOT EXISTS carousel_images jsonb NOT NULL DEFAULT '[]'::jsonb;
