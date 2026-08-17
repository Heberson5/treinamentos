-- ============================================================
-- Avisos & Pop-ups internos (Admin/Master)
-- - Data de nascimento no cadastro de usuário (para aniversariantes)
-- - Cadastro de avisos/pop-ups com recorrência e segmentação
-- - RPC de entrega (calcula elegibilidade sem expor a tabela via RLS direta)
-- - Bucket de storage para banner/foto dos avisos
-- ============================================================

-- ------------------------------------------------------------
-- 1) Data de nascimento no cadastro de usuário
-- ------------------------------------------------------------
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS data_nascimento date;

-- ------------------------------------------------------------
-- 2) Tabelas
-- ------------------------------------------------------------
CREATE TABLE public.avisos_popup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE, -- NULL = global (apenas Master)
  titulo text NOT NULL,
  tipo_conteudo text NOT NULL CHECK (tipo_conteudo IN ('texto','imagem','video')),
  texto_conteudo text,
  midia_url text, -- imagem: URL do bucket 'avisos'; vídeo: link externo (YouTube/Vimeo/URL direta)
  recorrencia text NOT NULL CHECK (recorrencia IN ('diario','semanal','quinzenal','mensal','anual')),
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date,
  publico_tipo text NOT NULL DEFAULT 'todos' CHECK (publico_tipo IN ('todos','departamento','usuarios')),
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  eh_aniversario boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT avisos_popup_data_fim_apos_inicio CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);

CREATE TABLE public.avisos_popup_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id uuid NOT NULL REFERENCES public.avisos_popup(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, usuario_id)
);

CREATE TABLE public.avisos_popup_visualizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id uuid NOT NULL REFERENCES public.avisos_popup(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_visualizacao date NOT NULL DEFAULT CURRENT_DATE,
  visualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, usuario_id, data_visualizacao)
);

CREATE INDEX idx_avisos_popup_empresa ON public.avisos_popup(empresa_id);
CREATE INDEX idx_avisos_popup_usuarios_aviso ON public.avisos_popup_usuarios(aviso_id);
CREATE INDEX idx_avisos_popup_visualizacoes_lookup ON public.avisos_popup_visualizacoes(usuario_id, data_visualizacao);

CREATE TRIGGER atualizar_avisos_popup_timestamp BEFORE UPDATE ON public.avisos_popup
FOR EACH ROW EXECUTE FUNCTION public.atualizar_timestamp();

-- ------------------------------------------------------------
-- 3) RLS
-- ------------------------------------------------------------
ALTER TABLE public.avisos_popup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos_popup_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos_popup_visualizacoes ENABLE ROW LEVEL SECURITY;

-- avisos_popup: master vê/gerencia tudo; admin só a própria empresa e nunca
-- cria/edita avisos globais (empresa_id NULL é exclusivo do Master)
CREATE POLICY "Admin/master veem avisos"
  ON public.avisos_popup FOR SELECT TO authenticated
  USING (
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (
      public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
      AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())
    )
  );

CREATE POLICY "Admin/master criam avisos"
  ON public.avisos_popup FOR INSERT TO authenticated
  WITH CHECK (
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (
      public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
      AND empresa_id IS NOT NULL
      AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())
    )
  );

CREATE POLICY "Admin/master atualizam avisos"
  ON public.avisos_popup FOR UPDATE TO authenticated
  USING (
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (
      public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
      AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())
    )
  )
  WITH CHECK (
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (
      public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
      AND empresa_id IS NOT NULL
      AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())
    )
  );

CREATE POLICY "Admin/master excluem avisos"
  ON public.avisos_popup FOR DELETE TO authenticated
  USING (
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (
      public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
      AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())
    )
  );

-- avisos_popup_usuarios: mesma regra, checando o dono do aviso pai
CREATE POLICY "Admin/master veem alvos de avisos"
  ON public.avisos_popup_usuarios FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.avisos_popup a WHERE a.id = aviso_id
        AND (
          public.verificar_role(auth.uid(), 'master'::public.tipo_role)
          OR (
            public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
            AND a.empresa_id = public.get_empresa_id_do_usuario(auth.uid())
          )
        )
    )
  );

CREATE POLICY "Admin/master adicionam alvos de avisos"
  ON public.avisos_popup_usuarios FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.avisos_popup a WHERE a.id = aviso_id
        AND (
          public.verificar_role(auth.uid(), 'master'::public.tipo_role)
          OR (
            public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
            AND a.empresa_id = public.get_empresa_id_do_usuario(auth.uid())
          )
        )
    )
  );

CREATE POLICY "Admin/master removem alvos de avisos"
  ON public.avisos_popup_usuarios FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.avisos_popup a WHERE a.id = aviso_id
        AND (
          public.verificar_role(auth.uid(), 'master'::public.tipo_role)
          OR (
            public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
            AND a.empresa_id = public.get_empresa_id_do_usuario(auth.uid())
          )
        )
    )
  );

-- avisos_popup_visualizacoes: cada usuário só enxerga/registra a própria visualização
CREATE POLICY "Usuario ve proprias visualizacoes de avisos"
  ON public.avisos_popup_visualizacoes FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Usuario registra propria visualizacao de aviso"
  ON public.avisos_popup_visualizacoes FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- ------------------------------------------------------------
-- 4) RPC de entrega: retorna, para o usuário autenticado, os avisos
--    elegíveis hoje (recorrência OU aniversário + público-alvo + ainda
--    não visualizados hoje). SECURITY DEFINER para não precisar expor
--    avisos_popup/avisos_popup_usuarios via RLS a usuários comuns.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.obter_avisos_popup_pendentes()
RETURNS TABLE (
  id uuid,
  titulo text,
  tipo_conteudo text,
  texto_conteudo text,
  midia_url text,
  eh_aniversario boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
  v_empresa_id uuid;
  v_departamento_id uuid;
  v_nascimento date;
  v_hoje date := CURRENT_DATE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT p.nome, p.empresa_id, p.departamento_id, p.data_nascimento
    INTO v_nome, v_empresa_id, v_departamento_id, v_nascimento
  FROM public.perfis p
  WHERE p.id = v_uid;

  RETURN QUERY
  SELECT
    a.id,
    CASE WHEN a.eh_aniversario THEN replace(a.titulo, '{{nome}}', COALESCE(v_nome, '')) ELSE a.titulo END,
    a.tipo_conteudo,
    CASE WHEN a.eh_aniversario THEN replace(COALESCE(a.texto_conteudo, ''), '{{nome}}', COALESCE(v_nome, '')) ELSE a.texto_conteudo END,
    a.midia_url,
    a.eh_aniversario
  FROM public.avisos_popup a
  WHERE a.ativo = true
    AND (a.empresa_id IS NULL OR a.empresa_id = v_empresa_id)
    AND a.data_inicio <= v_hoje
    AND (a.data_fim IS NULL OR a.data_fim >= v_hoje)
    AND (
      a.publico_tipo = 'todos'
      OR (a.publico_tipo = 'departamento' AND v_departamento_id IS NOT NULL AND a.departamento_id = v_departamento_id)
      OR (a.publico_tipo = 'usuarios' AND EXISTS (
            SELECT 1 FROM public.avisos_popup_usuarios apu
            WHERE apu.aviso_id = a.id AND apu.usuario_id = v_uid
          ))
    )
    AND (
      CASE
        WHEN a.eh_aniversario THEN
          v_nascimento IS NOT NULL
          AND extract(month FROM v_nascimento) = extract(month FROM v_hoje)
          AND extract(day FROM v_nascimento) = extract(day FROM v_hoje)
        WHEN a.recorrencia = 'diario' THEN true
        WHEN a.recorrencia = 'semanal' THEN mod((v_hoje - a.data_inicio)::int, 7) = 0
        WHEN a.recorrencia = 'quinzenal' THEN mod((v_hoje - a.data_inicio)::int, 14) = 0
        WHEN a.recorrencia = 'mensal' THEN extract(day FROM a.data_inicio) = extract(day FROM v_hoje)
        WHEN a.recorrencia = 'anual' THEN
          extract(month FROM a.data_inicio) = extract(month FROM v_hoje)
          AND extract(day FROM a.data_inicio) = extract(day FROM v_hoje)
        ELSE false
      END
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.avisos_popup_visualizacoes v
      WHERE v.aviso_id = a.id AND v.usuario_id = v_uid AND v.data_visualizacao = v_hoje
    )
  ORDER BY a.criado_em DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.obter_avisos_popup_pendentes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_avisos_popup_pendentes() TO authenticated;

-- ------------------------------------------------------------
-- 5) listar_usuarios_visiveis_admin(): inclui data_nascimento para a
--    tela de Usuários poder exibir/editar o campo novo. O retorno muda
--    de forma (nova coluna), então a função precisa ser recriada do zero.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.listar_usuarios_visiveis_admin();

CREATE OR REPLACE FUNCTION public.listar_usuarios_visiveis_admin()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  empresa_id uuid,
  departamento_id uuid,
  cargo text,
  ativo boolean,
  trocar_senha_primeiro_login boolean,
  dias_para_trocar_senha integer,
  data_nascimento date,
  papel public.tipo_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id,
    p.nome,
    p.email,
    p.empresa_id,
    p.departamento_id,
    p.cargo,
    COALESCE(p.ativo, true) AS ativo,
    COALESCE(p.trocar_senha_primeiro_login, false) AS trocar_senha_primeiro_login,
    p.dias_para_trocar_senha,
    p.data_nascimento,
    COALESCE(ur.role, 'usuario'::public.tipo_role) AS papel
  FROM public.perfis p
  LEFT JOIN public.usuario_roles ur ON ur.usuario_id = p.id
  WHERE
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (
      public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
      AND p.empresa_id IS NOT NULL
      AND p.empresa_id = public.get_empresa_id_do_usuario(auth.uid())
      AND COALESCE(ur.role, 'usuario'::public.tipo_role) <> 'master'::public.tipo_role
    )
  ORDER BY p.nome ASC NULLS LAST, p.email ASC;
$$;

REVOKE ALL ON FUNCTION public.listar_usuarios_visiveis_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_usuarios_visiveis_admin() TO authenticated;

-- ------------------------------------------------------------
-- 6) Bucket de storage para banner/foto dos avisos
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('avisos', 'avisos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin/master enviam midia de avisos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avisos'
    AND EXISTS (SELECT 1 FROM public.usuario_roles WHERE usuario_id = auth.uid() AND role IN ('master','admin'))
  );

CREATE POLICY "Admin/master atualizam midia de avisos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avisos'
    AND EXISTS (SELECT 1 FROM public.usuario_roles WHERE usuario_id = auth.uid() AND role IN ('master','admin'))
  );

CREATE POLICY "Admin/master removem midia de avisos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avisos'
    AND EXISTS (SELECT 1 FROM public.usuario_roles WHERE usuario_id = auth.uid() AND role IN ('master','admin'))
  );

-- Leitura restrita a autenticados (mesmo padrão de segurança já adotado para o bucket avatars)
CREATE POLICY "Autenticados veem midia de avisos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avisos');
