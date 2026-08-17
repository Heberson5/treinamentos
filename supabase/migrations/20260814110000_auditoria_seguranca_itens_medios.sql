-- ============================================================
-- Itens médios/baixos da auditoria de segurança geral
-- ============================================================

-- M3) cargos/categorias: só Master pode criar/editar/excluir registros
--     "globais" (empresa_id IS NULL, visíveis a todas as empresas).
--     Antes, qualquer admin de qualquer empresa também podia.
DROP POLICY IF EXISTS "Admin/master criam cargos" ON public.cargos;
CREATE POLICY "Admin/master criam cargos" ON public.cargos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Admin/master atualizam cargos" ON public.cargos;
CREATE POLICY "Admin/master atualizam cargos" ON public.cargos
  FOR UPDATE TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Admin/master deletam cargos" ON public.cargos;
CREATE POLICY "Admin/master deletam cargos" ON public.cargos
  FOR DELETE TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Admin/master criam categorias" ON public.categorias;
CREATE POLICY "Admin/master criam categorias" ON public.categorias
  FOR INSERT TO authenticated
  WITH CHECK (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Admin/master atualizam categorias" ON public.categorias;
CREATE POLICY "Admin/master atualizam categorias" ON public.categorias
  FOR UPDATE TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Admin/master deletam categorias" ON public.categorias;
CREATE POLICY "Admin/master deletam categorias" ON public.categorias
  FOR DELETE TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

-- M4) Limite de tamanho/tipo de arquivo nos buckets de imagem, como
--     defesa em profundidade além da validação no frontend (bloqueia
--     SVG, que pode conter <script> embutido, e arquivos grandes).
UPDATE storage.buckets SET file_size_limit = 3145728, allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif'] WHERE id = 'avatars';
UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif'] WHERE id = 'avisos';
