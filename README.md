# SaaS de Gestão para Psicólogas

SaaS multi-tenant para gestão de consultório individual (agenda, prontuário, financeiro). Ver [CLAUDE.md](./CLAUDE.md) para a especificação completa do produto.

## Stack

- Next.js (App Router, TypeScript) + Tailwind
- Supabase (Postgres, Auth com Google OAuth, RLS para isolamento multi-tenant)
- Vitest para testes

## Setup local

1. Copie `.env.example` para `.env.local` e preencha com as credenciais do seu projeto Supabase (URL e anon key em Project Settings → API).
2. Configure o provedor Google OAuth em Supabase Auth → Providers, com o Client ID/Secret do Google Cloud Console (escopo `https://www.googleapis.com/auth/calendar` já solicitado no login para reuso na integração de Agenda/Meet).
3. Aplique as migrations em `supabase/migrations/` no seu projeto Supabase (via SQL Editor do dashboard, ou `npx supabase db push` usando o Supabase CLI).
4. Instale as dependências e rode o projeto:

```bash
npm install
npm run dev
```

## Testes

```bash
npm run test       # roda uma vez
npm run test:watch # modo watch
```

Os testes de isolamento RLS (`tests/rls/`) exigem uma instância local do Supabase (`npx supabase start` + `npx supabase db reset`) e as variáveis `SUPABASE_TEST_URL`/`SUPABASE_TEST_ANON_KEY`. Sem elas, são pulados automaticamente.
