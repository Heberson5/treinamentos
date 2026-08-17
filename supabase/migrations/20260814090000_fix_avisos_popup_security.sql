-- ============================================================
-- Correções de segurança da feature de Avisos & Pop-ups
-- (achados da auditoria de segurança: XSS via URI scheme perigoso
-- e isolamento de storage entre empresas)
-- ============================================================

-- 1) Bloqueia esquemas perigosos (javascript:, data:, vbscript:, etc.)
--    em midia_url no próprio banco, como defesa em profundidade além
--    da validação já feita no frontend.
ALTER TABLE public.avisos_popup
  ADD CONSTRAINT avisos_popup_midia_url_esquema_seguro
  CHECK (midia_url IS NULL OR midia_url ~* '^https?://');

-- 2) Storage do bucket 'avisos': as policies antigas autorizavam
--    INSERT/UPDATE/DELETE para qualquer admin/master sem checar a
--    empresa dona do arquivo, permitindo que um admin de uma empresa
--    apagasse/sobrescrevesse mídia de outra. Novo padrão: os arquivos
--    passam a ser salvos em "banners/{empresa_id|global}/...", e admin
--    só pode gravar dentro da própria pasta; master grava em qualquer uma.
DROP POLICY IF EXISTS "Admin/master enviam midia de avisos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/master atualizam midia de avisos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/master removem midia de avisos" ON storage.objects;

CREATE POLICY "Master envia midia de avisos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avisos'
    AND public.verificar_role(auth.uid(), 'master'::public.tipo_role)
  );

CREATE POLICY "Admin envia midia de avisos da propria empresa"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avisos'
    AND public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
    AND (storage.foldername(name))[2] = public.get_empresa_id_do_usuario(auth.uid())::text
  );

CREATE POLICY "Master atualiza midia de avisos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avisos'
    AND public.verificar_role(auth.uid(), 'master'::public.tipo_role)
  );

CREATE POLICY "Admin atualiza midia de avisos da propria empresa"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avisos'
    AND public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
    AND (storage.foldername(name))[2] = public.get_empresa_id_do_usuario(auth.uid())::text
  );

CREATE POLICY "Master remove midia de avisos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avisos'
    AND public.verificar_role(auth.uid(), 'master'::public.tipo_role)
  );

CREATE POLICY "Admin remove midia de avisos da propria empresa"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avisos'
    AND public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
    AND (storage.foldername(name))[2] = public.get_empresa_id_do_usuario(auth.uid())::text
  );
