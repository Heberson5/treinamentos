// Backend fictício usado só para gerar os prints da Ajuda.
// Intercepta as chamadas ao Supabase no navegador do Playwright e responde
// com dados de demonstração — nenhum dado real de cliente é usado.
const fs = require("fs");
const path = require("path");

const now = new Date();
const iso = (diasAtras) => new Date(now.getTime() - diasAtras * 86400000).toISOString();
const dia = (diasAFrente) => new Date(now.getTime() + diasAFrente * 86400000).toISOString().slice(0, 10);

const IDS = {
  master: "0d1f5a3e-1111-4c1a-9a51-000000000001",
  admin: "0d1f5a3e-2222-4c1a-9a51-000000000002",
  instrutor: "0d1f5a3e-3333-4c1a-9a51-000000000003",
  usuario: "0d1f5a3e-4444-4c1a-9a51-000000000004",
  u5: "0d1f5a3e-5555-4c1a-9a51-000000000005",
  u6: "0d1f5a3e-6666-4c1a-9a51-000000000006",
  u7: "0d1f5a3e-7777-4c1a-9a51-000000000007",
  u8: "0d1f5a3e-8888-4c1a-9a51-000000000008",
};
const E1 = "7a2c0b10-0001-4e0e-8f00-00000000e001";
const E2 = "7a2c0b10-0002-4e0e-8f00-00000000e002";
const E3 = "7a2c0b10-0003-4e0e-8f00-00000000e003";

const prazos = [5, null, 28, null, 12, null, -2, 45, null, 9];
const treinamentos = JSON.parse(fs.readFileSync(path.join(__dirname, "dados", "treinamentos.json"))).map((t, i) => ({
  ...t,
  publicado: true,
  empresa_id: i < 10 ? E1 : null,
  // Treinamento curto, sem prova: usado nos prints de "Concluir" (tempo mínimo de 5 min)
  duracao_minutos: i === 4 ? 10 : t.duracao_minutos,
  instrutor_id: i < 10 ? "0d1f5a3e-3333-4c1a-9a51-000000000003" : null,
  data_limite: i < 10 && prazos[i] != null ? dia(prazos[i]) : null,
  criado_em: iso(30 - i),
  atualizado_em: iso(i % 9),
}));
const questoes = JSON.parse(fs.readFileSync(path.join(__dirname, "dados", "questoes.json")));

const empresas = [
  { id: E1, nome: "Horizonte Alimentos Ltda", nome_fantasia: "Horizonte Alimentos", cnpj: "11.111.111/0001-11", ativo: true, bloqueada: false, is_demo: false, email: "contato@horizonte.exemplo", telefone: "(11) 4000-0001", criado_em: iso(120), plano_id: "p2", plano: "p2", tema_cor: null },
  { id: E2, nome: "Vale Verde Logística S.A.", nome_fantasia: "Vale Verde Logística", cnpj: "22.222.222/0001-22", ativo: true, bloqueada: false, is_demo: false, email: "contato@valeverde.exemplo", telefone: "(11) 4000-0002", criado_em: iso(300), plano_id: "p3", plano: "p3", tema_cor: null },
  { id: E3, nome: "Clínica Bem Viver", nome_fantasia: "Bem Viver", cnpj: "33.333.333/0001-33", ativo: true, bloqueada: false, is_demo: true, demo_expires_at: new Date(now.getTime() + 6 * 86400000).toISOString(), email: "contato@bemviver.exemplo", telefone: "(11) 4000-0003", criado_em: iso(10), plano_id: "p1", plano: "p1", tema_cor: null },
];
const departamentos = [
  { id: "d0000000-0000-4000-8000-000000000001", nome: "Administrativo", empresa_id: E1, ativo: true, descricao: "Rotinas administrativas", criado_em: iso(100) },
  { id: "d0000000-0000-4000-8000-000000000002", nome: "Financeiro", empresa_id: E1, ativo: true, descricao: "Contas e tributos", criado_em: iso(100) },
  { id: "d0000000-0000-4000-8000-000000000003", nome: "Atendimento", empresa_id: E1, ativo: true, descricao: "Relacionamento com clientes", criado_em: iso(90) },
  { id: "d0000000-0000-4000-8000-000000000004", nome: "Recursos Humanos", empresa_id: E1, ativo: true, descricao: "Pessoas e cultura", criado_em: iso(90) },
  { id: "d0000000-0000-4000-8000-000000000005", nome: "Operações", empresa_id: E2, ativo: true, descricao: "Armazém e frota", criado_em: iso(80) },
];
const [D1, D2, D3, D4, D5] = departamentos.map((d) => d.id);
const cargos = [
  { id: "c0000000-0000-4000-8000-000000000001", nome: "Coordenador", empresa_id: E1, ativo: true, descricao: "Coordena a equipe" },
  { id: "c0000000-0000-4000-8000-000000000002", nome: "Analista", empresa_id: E1, ativo: true, descricao: "Analisa e executa" },
  { id: "c0000000-0000-4000-8000-000000000003", nome: "Atendente", empresa_id: E1, ativo: true, descricao: "Atende clientes" },
  { id: "c0000000-0000-4000-8000-000000000004", nome: "Supervisor", empresa_id: E2, ativo: true, descricao: "Supervisiona a operação" },
];
const pessoas = [
  [IDS.master, "Ana Ribeiro", "ana.ribeiro@plataforma.exemplo", null, null, "Gestora da plataforma", "master"],
  [IDS.admin, "Juliana Martins", "juliana.martins@horizonte.exemplo", E1, D2, "Coordenador", "admin"],
  [IDS.instrutor, "Fernanda Rocha", "fernanda.rocha@horizonte.exemplo", E1, D4, "Analista", "instrutor"],
  [IDS.usuario, "Carlos Eduardo Lima", "carlos.lima@horizonte.exemplo", E1, D3, "Atendente", "usuario"],
  [IDS.u5, "Rafael Souza", "rafael.souza@horizonte.exemplo", E1, D2, "Analista", "usuario"],
  [IDS.u6, "Patrícia Almeida", "patricia.almeida@valeverde.exemplo", E2, D5, "Supervisor", "admin"],
  [IDS.u7, "Lucas Ferreira", "lucas.ferreira@horizonte.exemplo", E1, D3, "Atendente", "usuario"],
  [IDS.u8, "Mariana Costa", "mariana.costa@bemviver.exemplo", E3, null, "Analista", "usuario"],
];
const perfis = pessoas.map(([id, nome, email, empresa_id, departamento_id, cargo], i) => ({
  id, nome, email, empresa_id, departamento_id, cargo, ativo: i !== 7, avatar_url: null,
  telefone: null, data_nascimento: null, trocar_senha_primeiro_login: i === 6, dias_para_trocar_senha: null,
  criado_em: iso(200 - i * 10), atualizado_em: iso(2), numero: i + 1, sessao_atual_id: null,
}));
const usuario_roles = pessoas.map(([id, , , , , , role]) => ({ id: "r-" + id, usuario_id: id, role }));

const progresso_treinamentos = [];
const pesos = [100, 100, 65, 40, 100, 20, 0, 85, 100, 55];
perfis.forEach((p, pi) => {
  treinamentos.slice(0, 10).forEach((t, ti) => {
    if ((pi + ti) % 3 === 0) return;
    const pr = pesos[(pi + ti) % pesos.length];
    progresso_treinamentos.push({
      id: `pg-${pi}-${ti}`, usuario_id: p.id, treinamento_id: t.id, percentual_concluido: pr,
      concluido: pr === 100, data_inicio: iso(20 - ti), data_conclusao: pr === 100 ? iso(5 - (ti % 5)) : null,
      tempo_assistido_minutos: 25 + ti * 4, nota_avaliacao: pr === 100 ? 3 + ((pi + ti) % 3) : null,
      atualizado_em: iso(ti % 7), criado_em: iso(20 - ti),
    });
  });
});

const atividades = perfis.slice(1, 7).flatMap((p, i) => [
  { id: `a${i}1`, usuario_id: p.id, tipo: "treinamento_iniciado", descricao: `Iniciou o treinamento "${treinamentos[i + 2].titulo}"`, criado_em: iso(i * 0.2), metadata: {} },
  { id: `a${i}2`, usuario_id: p.id, tipo: "treinamento_concluido", descricao: `Concluiu o treinamento "${treinamentos[i].titulo}"`, criado_em: iso(i * 0.3 + 0.1), metadata: {} },
]);

const tentativas_avaliacao = [
  { id: "t1", usuario_id: IDS.usuario, treinamento_id: treinamentos[1].id, nota: 8.5, aprovado: true, criado_em: iso(3), respostas: {} },
  { id: "t2", usuario_id: IDS.u5, treinamento_id: treinamentos[1].id, nota: 5.5, aprovado: false, criado_em: iso(2), respostas: {} },
  { id: "t3", usuario_id: IDS.u5, treinamento_id: treinamentos[1].id, nota: 7.5, aprovado: true, criado_em: iso(1), respostas: {} },
  { id: "t4", usuario_id: IDS.u7, treinamento_id: treinamentos[4].id, nota: 6, aprovado: false, criado_em: iso(1), respostas: {} },
];

const planos = [
  { id: "p1", nome: "Básico", descricao: "Para começar", preco: 99, periodo: "/mês", limite_usuarios: 10, limite_treinamentos: 5, limite_armazenamento_gb: 2, ativo: true, popular: false, icone: "Users", cor: "bg-blue-500", ordem: 1,
    recursos: [{ id: "certificados", habilitado: true }, { id: "relatorios_basicos", habilitado: true }, { id: "integracao_ia", habilitado: false }] },
  { id: "p2", nome: "Profissional", descricao: "Para equipes em crescimento", preco: 249, periodo: "/mês", limite_usuarios: 50, limite_treinamentos: 30, limite_armazenamento_gb: 10, ativo: true, popular: true, icone: "Users", cor: "bg-purple-500", ordem: 2,
    recursos: [{ id: "certificados", habilitado: true }, { id: "relatorios_basicos", habilitado: true }, { id: "integracao_ia", habilitado: true }] },
  { id: "p3", nome: "Empresarial", descricao: "Sem limites", preco: 599, periodo: "/mês", limite_usuarios: 500, limite_treinamentos: 999, limite_armazenamento_gb: 100, ativo: true, popular: false, icone: "Users", cor: "bg-emerald-500", ordem: 3,
    recursos: [{ id: "certificados", habilitado: true }, { id: "relatorios_basicos", habilitado: true }, { id: "integracao_ia", habilitado: true }] },
];

const lembretes = Object.values(IDS).flatMap((uid, i) => [
  { id: `l${i}a`, usuario_id: uid, titulo: "Revisar o módulo de LGPD", descricao: "Antes do prazo da equipe", data: dia(2), hora: "14:00", concluido: false, criado_em: iso(1) },
  { id: `l${i}b`, usuario_id: uid, titulo: "Reunião de integração", descricao: "", data: dia(5), hora: "09:00", concluido: false, criado_em: iso(1) },
]);

const avisos_popup = [
  { id: "av1", empresa_id: E1, titulo: "Nova trilha: Reforma Tributária", tipo_conteudo: "texto", texto_conteudo: "Quatro módulos novos já estão no catálogo. Conclua o primeiro até sexta-feira.", midia_url: null, recorrencia: "diario", data_inicio: dia(-3), data_fim: dia(20), publico_tipo: "todos", departamento_id: null, eh_aniversario: false, ativo: true, criado_em: iso(3) },
  { id: "av2", empresa_id: E1, titulo: "Prazo da LGPD", tipo_conteudo: "texto", texto_conteudo: "A equipe financeira precisa concluir o treinamento de LGPD nesta semana.", midia_url: null, recorrencia: "semanal", data_inicio: dia(-1), data_fim: dia(5), publico_tipo: "departamento", departamento_id: D2, eh_aniversario: false, ativo: true, criado_em: iso(1) },
  { id: "av3", empresa_id: E1, titulo: "Feliz aniversário, {{nome}}!", tipo_conteudo: "texto", texto_conteudo: "Toda a equipe deseja a você um dia muito especial.", midia_url: null, recorrencia: "anual", data_inicio: dia(-30), data_fim: null, publico_tipo: "todos", departamento_id: null, eh_aniversario: true, ativo: false, criado_em: iso(30) },
];

const categorias = [...new Set(treinamentos.map((t) => t.categoria))].map((nome, i) => ({
  id: `ca000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, nome, ativo: true, empresa_id: null, cor: null, descricao: null, criado_em: iso(50),
}));

const plano_contratos = [
  { id: "pc1", empresa_id: E1, plano_id: "p2", ativo: true, nome_plano: "Profissional", limite_usuarios: 50, limite_treinamentos: 30, preco_contratado: 249, data_inicio: iso(100), data_fim: iso(-265), criado_em: iso(100) },
  { id: "pc2", empresa_id: E2, plano_id: "p3", ativo: true, nome_plano: "Empresarial", limite_usuarios: 500, limite_treinamentos: 999, preco_contratado: 599, data_inicio: iso(300), data_fim: iso(-65), criado_em: iso(300) },
];

const pagamentos = [
  { id: "pg1", empresa_id: E1, contrato_id: "pc1", valor: 249, status: "pago", metodo_pagamento: "pix", referencia: "Mensalidade " + new Date(now.getTime() - 60 * 86400000).toLocaleDateString("pt-BR", { month: "long" }), data_vencimento: dia(-60), data_pagamento: dia(-61), observacoes: null, criado_em: iso(62) },
  { id: "pg2", empresa_id: E2, contrato_id: "pc2", valor: 599, status: "pago", metodo_pagamento: "cartao", referencia: "Mensalidade Empresarial", data_vencimento: dia(-30), data_pagamento: dia(-31), observacoes: null, criado_em: iso(32) },
  { id: "pg3", empresa_id: E1, contrato_id: "pc1", valor: 249, status: "pago", metodo_pagamento: "pix", referencia: "Mensalidade Profissional", data_vencimento: dia(-30), data_pagamento: dia(-29), observacoes: null, criado_em: iso(32) },
  { id: "pg4", empresa_id: E1, contrato_id: "pc1", valor: 249, status: "pendente", metodo_pagamento: "boleto", referencia: "Mensalidade Profissional", data_vencimento: dia(5), data_pagamento: null, observacoes: null, criado_em: iso(2) },
  { id: "pg5", empresa_id: E2, contrato_id: "pc2", valor: 599, status: "atrasado", metodo_pagamento: "boleto", referencia: "Mensalidade Empresarial", data_vencimento: dia(-4), data_pagamento: null, observacoes: null, criado_em: iso(8) },
];

const tables = {
  perfis, usuario_roles, empresas, departamentos, cargos, treinamentos, progresso_treinamentos,
  questoes_treinamento: questoes, atividades, planos, lembretes, plano_contratos, categorias,
  tentativas_avaliacao, avisos_popup, pagamentos,
  avisos_popup_usuarios: [], tentativas_eventos: [], configuracoes_menu: [],
  landing_page_config: [{
    id: "lp1", hero_title: "Treinamentos que a sua equipe realmente conclui", hero_subtitle: "Crie, publique e acompanhe treinamentos com avaliações e certificados.",
    hero_badge: "Plataforma de treinamentos", hero_cta_primary: "Começar agora", hero_cta_secondary: "Ver planos", hero_background_color: "from-primary via-primary/80 to-primary/60",
    company_name: "Plataforma de Treinamentos", company_description: "Capacitação corporativa simples e acompanhada.",
    cta_title: "Pronto para começar?", cta_subtitle: "Teste gratuitamente por alguns dias.", logo_url: null,
    show_annual_toggle: true, featured_trainings_enabled: true, custom_css: null, termos_de_uso: null, sobre_nos: null,
    stats_section: null, features_section: null, carousel_images: [],
  }],
  configuracoes_ia_empresa: [], configuracoes_pagamento: [], permissoes_role: [], sms_gatilhos: [],
  sms_configuracoes: [], sms_envios: [], avaliacoes_treinamentos: [], uso_empresa: [], leads_demonstracao: [],
  configuracoes_sistema: [{
    id: "cfg1", nome_sistema: "Aprenda Mais", logo_sidebar_url: null, favicon_url: null, session_timeout_min: 30, logoff_on_close: false,
    tentativas_login_max: 5, bloqueio_horas: 1, backup_destino: "local", backup_config: {},
    email_contato: "suporte@aprendamais.exemplo", telefone_contato: "(11) 4000-1000",
  }],
  auditoria: [], notificacoes: [],
};

const rpcs = {
  listar_usuarios_visiveis_admin: () => perfis.map((p) => ({ ...p, papel: usuario_roles.find((r) => r.usuario_id === p.id).role })),
  obter_config_sistema_publica: () => [{ nome_sistema: "Aprenda Mais", logo_sidebar_url: null, favicon_url: null, session_timeout_min: 30, logoff_on_close: false }],
  obter_avisos_popup_pendentes: () => [],
  pode_tentar_login: () => ({ permitido: true, restantes: 5 }),
  get_empresa_id_do_usuario: () => null,
  // Como no servidor real, o gabarito não vai junto das questões
  obter_questoes_avaliacao: (b) =>
    questoes.filter((q) => q.treinamento_id === (b && b.p_treinamento_id)).map(({ resposta_correta, ...q }) => q),
};

function b64url(o) { return Buffer.from(JSON.stringify(o)).toString("base64url"); }
const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 30;
function makeSession(uid) {
  const p = perfis.find((x) => x.id === uid);
  const jwt = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: uid, role: "authenticated", email: p.email, exp, aud: "authenticated" })}.assinatura-ficticia`;
  const user = {
    id: uid, aud: "authenticated", role: "authenticated", email: p.email,
    email_confirmed_at: iso(200), app_metadata: { provider: "email" }, user_metadata: { nome: p.nome },
    created_at: iso(200), updated_at: iso(1),
  };
  return { access_token: jwt, refresh_token: "ficticio", expires_in: 3600 * 24 * 30, expires_at: exp, token_type: "bearer", user };
}

const desconhecidos = new Set();

function applyFilters(rows, params) {
  let out = rows;
  for (const [k, v] of params.entries()) {
    if (["select", "order", "limit", "offset", "or", "and", "columns", "on_conflict"].includes(k)) continue;
    if (v.startsWith("eq.")) out = out.filter((r) => String(r[k]) === decodeURIComponent(v.slice(3)));
    else if (v.startsWith("neq.")) out = out.filter((r) => String(r[k]) !== v.slice(4));
    else if (v === "is.null") out = out.filter((r) => r[k] == null);
    else if (v.startsWith("in.(")) {
      const vals = v.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, ""));
      out = out.filter((r) => vals.includes(String(r[k])));
    }
  }
  const limit = params.get("limit");
  if (limit) out = out.slice(0, Number(limit));
  return out;
}

const SUPABASE_HOST = "fakesupa.local";

async function instalarBackendFicticio(page, { logado = true, como = "master", avisos = false, prova = "aprovado" } = {}) {
  const session = makeSession(IDS[como]);
  if (logado) {
    await page.addInitScript((s) => {
      localStorage.setItem("sb-fakesupa-auth-token", JSON.stringify(s));
      // Sem o convite de instalação (PWA) atrapalhando os prints
      localStorage.setItem("pwa-install-dismissed-at", String(Date.now()));
    }, session);
  }
  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return route.continue();
    if (url.hostname !== SUPABASE_HOST) {
      if (req.resourceType() === "image") {
        const seed = [...url.pathname].reduce((a, c) => a + c.charCodeAt(0), 0);
        const h1 = seed % 360, h2 = (seed * 7) % 360;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1},55%,55%)"/><stop offset="1" stop-color="hsl(${h2},60%,35%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
        return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg });
      }
      // Vídeos incorporados (YouTube etc.) viram um quadro neutro
      if (req.resourceType() === "document") {
        return route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: `<html><head><meta charset="utf-8"></head><body style="margin:0;height:100vh;display:grid;place-items:center;background:#0f172a;font-family:sans-serif;color:#cbd5e1"><div style="text-align:center"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z" fill="#e2e8f0"/></svg><div style="margin-top:8px;font-size:14px">Vídeo</div></div></body></html>`,
        });
      }
      return route.abort();
    }
    const json = (body, status = 200, extra = {}) =>
      route.fulfill({
        status, contentType: "application/json",
        headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-expose-headers": "content-range", ...extra },
        body: JSON.stringify(body),
      });
    if (req.method() === "OPTIONS") return json({});
    const p = url.pathname;
    if (p.startsWith("/auth/v1/user")) return json(session.user);
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1")) return json({});
    if (p.startsWith("/storage/v1")) return json([]);
    if (p.startsWith("/functions/v1")) return json({});
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    if (p.startsWith("/rest/v1/rpc/")) {
      const fn = p.split("/").pop();
      if (!rpcs[fn] && !["corrigir_avaliacao", "obter_avisos_popup_pendentes"].includes(fn)) desconhecidos.add("rpc:" + fn);
      if (fn === "corrigir_avaliacao") {
        let enviado = null;
        try { enviado = req.postDataJSON(); } catch { /* sem corpo */ }
        const ids = Object.keys((enviado && enviado.p_respostas) || {});
        const aprovado = prova === "aprovado";
        const detalhes = Object.fromEntries(ids.map((id, i) => [id, aprovado ? i < 8 : i < 5]));
        return json({ nota: aprovado ? 8 : 5, aprovado, detalhes, numero_tentativa: 1 });
      }
      if (fn === "obter_avisos_popup_pendentes") {
        return json(
          avisos
            ? [{ id: "popup1", titulo: "Nova trilha: Reforma Tributária", tipo_conteudo: "texto", texto_conteudo: "Quatro módulos novos já estão no catálogo. Conclua o primeiro até sexta-feira.", midia_url: null, eh_aniversario: false }]
            : []
        );
      }
      let corpo = null;
      try { corpo = req.postDataJSON(); } catch { /* sem corpo */ }
      const r = rpcs[fn] ? rpcs[fn](corpo) : [];
      return json(single && Array.isArray(r) ? r[0] ?? null : r);
    }
    if (p.startsWith("/rest/v1/")) {
      const table = p.split("/")[3];
      if (req.method() !== "GET" && req.method() !== "HEAD") return json(single ? {} : [], 201);
      if (!tables[table]) desconhecidos.add("tabela:" + table);
      const rows = applyFilters(tables[table] || [], url.searchParams);
      const range = { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` };
      if (req.method() === "HEAD")
        return route.fulfill({ status: 200, headers: { ...range, "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" }, body: "" });
      if (single) return rows.length ? json(rows[0], 200, range) : json({ code: "PGRST116", message: "no rows" }, 406);
      return json(rows, 200, range);
    }
    return json({});
  });
}

module.exports = { instalarBackendFicticio, desconhecidos, treinamentos, SUPABASE_HOST, IDS, E1 };
