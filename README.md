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

### Testes de isolamento RLS

Os testes em `tests/rls/` validam que uma psicóloga nunca acessa dados de outra conta. Exigem uma instância local do Supabase (precisa de Docker):

```bash
npx supabase start          # sobe o stack local (primeira vez baixa imagens)
npx supabase db reset       # aplica as migrations de supabase/migrations/
```

Depois, exporte as variáveis apontando para o local e rode a suíte. A anon key sai de `npx supabase status`:

```bash
# bash
export SUPABASE_TEST_URL="http://127.0.0.1:54321"
export SUPABASE_TEST_ANON_KEY="$(npx supabase status -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).ANON_KEY))')"
export SUPABASE_TEST_SERVICE_ROLE_KEY="$(npx supabase status -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).SERVICE_ROLE_KEY))')"
npm test
```

```powershell
# PowerShell
$env:SUPABASE_TEST_URL = "http://127.0.0.1:54321"
$env:SUPABASE_TEST_ANON_KEY = (npx supabase status -o json | ConvertFrom-Json).ANON_KEY
$env:SUPABASE_TEST_SERVICE_ROLE_KEY = (npx supabase status -o json | ConvertFrom-Json).SERVICE_ROLE_KEY
npm test
```

Sem essas variáveis, os testes de RLS são pulados automaticamente (o resto da suíte roda normal). `SUPABASE_TEST_SERVICE_ROLE_KEY` só é usada pelo teste da trava de escrita por assinatura (liga/desliga `app_config.assinatura_enforcement_ativo` para testar os dois estados); sem ela, só esse teste específico pula.

## Teste visual de responsividade

```bash
npx supabase start   # precisa do Docker
npm run visual
```

Sobe o app em outra porta (3100) apontando para o Supabase **local**, cria um usuário e dados fictícios, abre 12 telas no Chrome em celular (390px), tablet (768px) e desktop (1366px), salva prints em `.visual/` e falha se alguma tela tiver rolagem horizontal. Recusa qualquer Supabase que não seja o local. Feche o `npm run dev` antes de rodar.

## Assinatura (Asaas)

Sem `ASAAS_API_KEY`, a integração roda em **modo simulado** — nenhuma chamada real, e `/assinatura` ganha um botão "Simular pagamento confirmado" pra testar o fluxo sem conta no Asaas.

Pra usar o sandbox de verdade:

1. Cria conta no [Asaas Sandbox](https://sandbox.asaas.com), pega a API key em Configurações → Integrações.
2. Preenche `ASAAS_API_KEY` no `.env.local` (`ASAAS_MODE` fica `sandbox` automaticamente).
3. Cadastra um webhook em Configurações → Webhooks apontando pra `https://<seu-domínio>/api/asaas/webhook`, evento "Pagamento", e define um token — cola o mesmo valor em `ASAAS_WEBHOOK_TOKEN`.
4. **Webhook local:** o Asaas precisa de uma URL pública HTTPS, então em dev usa um túnel (`ngrok http 3000` ou similar) e cadastra a URL dele no passo 3. Sem isso, use o botão "Já paguei, verificar agora" em `/assinatura`, que consulta o Asaas direto (sem depender do webhook).

A trava de escrita (somente leitura quando a assinatura vence) só entra em vigor com `assinatura_enforcement_ativo = true` em `app_config` — começa **desligada** de propósito. Pra ligar em produção, depois de validar a integração:

```sql
update public.app_config set assinatura_enforcement_ativo = true;
```
