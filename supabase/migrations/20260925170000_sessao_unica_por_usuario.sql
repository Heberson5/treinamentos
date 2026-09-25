-- ------------------------------------------------------------
-- Sessão única por usuário: impede acesso simultâneo pela
-- plataforma em mais de um dispositivo/navegador ao mesmo tempo.
--
-- Cada login grava um id de sessão novo em perfis.sessao_atual_id.
-- O frontend guarda esse id localmente e assina o Realtime dessa
-- linha: se o id mudar (login em outro lugar), a sessão local é
-- derrubada em poucos segundos. Reforço nativo do GoTrue
-- (GOTRUE_SESSIONS_SINGLE_PER_USER, configurado à parte no .env
-- do self-hosted) cobre o caso do token já emitido tentar renovar.
-- ------------------------------------------------------------

ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS sessao_atual_id uuid;

CREATE OR REPLACE FUNCTION public.definir_sessao_atual(p_sessao_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.perfis SET sessao_atual_id = p_sessao_id WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.definir_sessao_atual(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_sessao_atual(uuid) TO authenticated;

-- Garante que a tabela perfis está na publicação do Realtime, sem
-- duplicar caso já esteja (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'perfis'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.perfis;
  END IF;
END $$;
