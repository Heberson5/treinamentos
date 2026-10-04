-- ============================================================
-- Registro dos backups automáticos do servidor (scripts/vps/backup.sh).
-- Só o Master vê; quem grava é o script na VPS (usuário do banco).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.registro_backups (
  id bigserial PRIMARY KEY,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  sucesso boolean NOT NULL DEFAULT false,
  tamanho_bytes bigint,
  arquivo text,
  copia_externa boolean NOT NULL DEFAULT false,
  mensagem text
);

CREATE INDEX IF NOT EXISTS registro_backups_iniciado_em_idx ON public.registro_backups (iniciado_em DESC);

ALTER TABLE public.registro_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master ve registro de backups" ON public.registro_backups;
CREATE POLICY "Master ve registro de backups" ON public.registro_backups
  FOR SELECT TO authenticated
  USING (public.verificar_role(auth.uid(), 'master'::public.tipo_role));

REVOKE ALL ON public.registro_backups FROM anon, authenticated;
GRANT SELECT ON public.registro_backups TO authenticated;
GRANT ALL ON public.registro_backups TO service_role;
