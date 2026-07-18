-- Leads de agendamento de demonstração (landing page)
CREATE TABLE IF NOT EXISTS public.leads_demonstracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  empresa text,
  email text NOT NULL,
  telefone text,
  mensagem text,
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'contatado', 'convertido', 'descartado')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads_demonstracao ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante (mesmo anônimo) pode registrar um pedido de demonstração
CREATE POLICY "Qualquer um pode solicitar demonstração"
  ON public.leads_demonstracao
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Apenas Master pode visualizar/gerenciar os leads
CREATE POLICY "Master pode ver leads de demonstração"
  ON public.leads_demonstracao
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuario_roles
      WHERE usuario_id = auth.uid() AND role = 'master'
    )
  );

CREATE POLICY "Master pode atualizar leads de demonstração"
  ON public.leads_demonstracao
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuario_roles
      WHERE usuario_id = auth.uid() AND role = 'master'
    )
  );

-- Dias de degustação configuráveis por empresa (em vez do valor fixo de 7 dias)
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS dias_degustacao integer NOT NULL DEFAULT 7;

-- Modelo de e-mail (HTML) usado para o envio de credenciais e outras comunicações do sistema
ALTER TABLE public.configuracoes_sistema ADD COLUMN IF NOT EXISTS email_template_html text;

UPDATE public.configuracoes_sistema
SET email_template_html = $tpl$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Portal de Treinamentos</title>
<style>
:root{color-scheme:light dark;--bg:#eef3f8;--card:#fff;--text:#1f2937;--text2:#6b7280;--border:#e5e7eb}
@media(prefers-color-scheme:dark){:root{--bg:#0f172a;--card:#1e293b;--text:#f8fafc;--text2:#cbd5e1;--border:#334155}}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);font-family:Segoe UI,Arial,Helvetica,sans-serif;color:var(--text);padding:20px}
.wrapper{max-width:700px;margin:auto}
.card{background:var(--card);border:1px solid var(--border);border-radius:20px;overflow:hidden}
.header{background:#2563eb;background-image:linear-gradient(135deg,#2563eb,#1d4ed8);padding:36px 28px;text-align:center}
.logo{font-size:30px;font-weight:700;color:#fff!important}
.subtitle{margin-top:8px;color:#fff!important;font-size:15px}
.content{padding:32px;font-size:15px;line-height:1.8;color:var(--text)}
.separator{height:1px;background:var(--border)}
.social{text-align:center;padding:24px}
.social-title{margin-bottom:16px;color:var(--text2);font-size:14px}
.social a{display:inline-block;margin:5px}
.social img{width:36px;height:36px;border:0}
.footer{padding:24px;text-align:center;color:var(--text2);font-size:12px;line-height:1.8;border-top:1px solid var(--border)}
.footer strong{color:var(--text)}
@media(max-width:600px){
body{padding:10px}
.header{padding:28px 18px}
.logo{font-size:24px}
.subtitle{font-size:14px}
.content{padding:22px}
.footer{padding:20px}
}
</style>
</head>
<body>
<div class="wrapper">
<div class="card">
<div class="header">

<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:auto;">
<tr>
<td valign="middle" style="padding-right:8px;">
<img src="https://img.icons8.com/?size=100&id=45Xlab1qZY10&format=png&color=FFFFFF" width="40" height="40" style="display:block;border:0;margin-right:-4px;" alt="Portal de Treinamentos">
</td>
<td valign="middle">
<span style="font-size:30px;font-weight:700;color:#ffffff;font-family:Segoe UI,Arial,sans-serif;white-space:nowrap;">
{NOME_SISTEMA}
</span>
</td>
</tr>
</table>

<div style="margin-top:10px;font-size:15px;color:#ffffff;">
Comunicação automática do sistema
</div>

</div>
<div class="content">
{corpo}
</div>
<div class="separator"></div>
<div class="social">
<div class="social-title">Siga-nos nas redes sociais</div>
<a href="{LINK_WHATSAPP}"><img src="https://img.icons8.com/?size=100&id=QkXeKixybttw&format=png&color=000000" alt="WhatsApp"></a>
<a href="{LINK_INSTAGRAM}"><img src="https://img.icons8.com/?size=100&id=ZRiAFreol5mE&format=png&color=000000" alt="Instagram"></a>
<a href="{LINK_FACEBOOK}"><img src="https://img.icons8.com/?size=100&id=uLWV5A9vXIPu&format=png&color=000000" alt="Facebook"></a>
<a href="{LINK_YOUTUBE}"><img src="https://img.icons8.com/?size=100&id=omVNNE6wkyP7&format=png&color=000000" alt="YouTube"></a>
<a href="{LINK_LINKEDIN}"><img src="https://img.icons8.com/?size=100&id=xuvGCOXi8Wyg&format=png&color=000000" alt="LinkedIn"></a>
<a href="{LINK_SITE}"><img src="https://img.icons8.com/?size=100&id=c84A8yTomT5p&format=png&color=000000" alt="Site"></a>
</div>
<div class="footer">
<strong>{NOME_SISTEMA}</strong><br><br>
Esta é uma mensagem automática enviada pelo sistema.<br>
Por favor, não responda este e-mail.<br><br>
© {ANO} | {NOME_EMPRESA}<br>
Todos os direitos reservados.
</div>
</div>
</div>
</body>
</html>$tpl$
WHERE email_template_html IS NULL;
