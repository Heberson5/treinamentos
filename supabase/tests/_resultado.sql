-- Fecha o teste: lista as falhas e desfaz a transação
-- ------------------------------------------------------------------ resultado
DO $fim$
DECLARE
  f text;
  total int;
  n int := 0;
BEGIN
  SELECT t.n INTO total FROM tst.total t;
  FOR f IN SELECT descricao FROM tst.falhas LOOP
    n := n + 1;
    RAISE WARNING 'FALHOU: %', f;
  END LOOP;
  IF n > 0 THEN
    RAISE EXCEPTION '% de % verificações falharam', n, total;
  END IF;
  RAISE NOTICE 'Verificações: %, todas OK', total;
END
$fim$;

ROLLBACK;
