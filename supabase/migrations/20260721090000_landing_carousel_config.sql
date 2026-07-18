-- Configurações de comportamento do carrossel de imagens da landing page
ALTER TABLE public.landing_page_config
  ADD COLUMN IF NOT EXISTS carousel_autoplay boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS carousel_autoplay_speed integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS carousel_transition text NOT NULL DEFAULT 'slide' CHECK (carousel_transition IN ('slide', 'fade'));
