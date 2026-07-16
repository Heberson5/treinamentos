# Sauberlich System — Plataforma de Treinamentos

Plataforma corporativa de treinamentos: catálogo de cursos, avaliações, certificados, relatórios e gestão multi-empresa (master / admin / instrutor / usuário).

## Stack

- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [React](https://react.dev/)
- [shadcn-ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) (banco de dados, autenticação, storage e edge functions)

## Rodando localmente

Pré-requisito: Node.js 18+ (ou [Bun](https://bun.sh/)).

```sh
# 1. Clone o repositório
git clone https://github.com/Heberson5/treinamentos.git
cd treinamentos

# 2. Instale as dependências
npm install

# 3. Copie o arquivo de variáveis de ambiente e preencha os valores
cp .env.example .env

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

## Variáveis de ambiente

Veja [.env.example](.env.example) para a lista de variáveis necessárias (URL e chave pública do projeto Supabase).

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção em `dist/` |
| `npm run preview` | Serve o build de produção localmente |
| `npm run lint` | Roda o ESLint |
| `npm run test` | Roda os testes automatizados |

## Estrutura do projeto

```
src/
├── components/   # Componentes reutilizáveis (auth, training, layout, ui, ...)
├── contexts/     # Contextos React (auth, empresa, treinamentos, ...)
├── hooks/        # Hooks customizados
├── integrations/ # Cliente e tipos do Supabase
├── lib/          # Utilitários (sanitização, exportação, PWA, ...)
├── pages/        # Páginas da aplicação, incluindo /admin
└── services/     # Integrações com serviços externos
supabase/
├── functions/    # Edge functions
└── migrations/   # Migrations SQL do banco
```

## Deploy

O projeto é uma SPA estática (build via Vite) que pode ser publicada em qualquer hosting de arquivos estáticos (Vercel, Netlify, Cloudflare Pages, etc.), com o backend hospedado no Supabase.
