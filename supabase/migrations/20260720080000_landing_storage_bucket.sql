-- Bucket público para imagens da landing page (ex: carrossel de prints do sistema)
INSERT INTO storage.buckets (id, name, public) VALUES ('landing', 'landing', true)
ON CONFLICT (id) DO NOTHING;

-- Apenas Master pode enviar/atualizar/remover imagens da landing page
CREATE POLICY "Master pode enviar imagens da landing page"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'landing'
    AND EXISTS (SELECT 1 FROM public.usuario_roles WHERE usuario_id = auth.uid() AND role = 'master')
  );

CREATE POLICY "Master pode atualizar imagens da landing page"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'landing'
    AND EXISTS (SELECT 1 FROM public.usuario_roles WHERE usuario_id = auth.uid() AND role = 'master')
  );

CREATE POLICY "Master pode remover imagens da landing page"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'landing'
    AND EXISTS (SELECT 1 FROM public.usuario_roles WHERE usuario_id = auth.uid() AND role = 'master')
  );

-- Leitura pública (necessária para exibir as imagens na página de divulgação)
CREATE POLICY "Público pode ver imagens da landing page"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'landing');
