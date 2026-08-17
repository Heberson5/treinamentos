-- ============================================================
-- Corrige favicon/logo/título não aparecendo na landing pública e na
-- tela de login: essas telas rodam antes do login, então a RPC de
-- branding (que só tinha GRANT para 'authenticated') nunca respondia
-- para elas. Libera para 'anon' também — a função só devolve campos
-- não sensíveis (nome do sistema, logo, favicon, timeout de sessão).
-- ============================================================
GRANT EXECUTE ON FUNCTION public.obter_config_sistema_publica() TO anon;
