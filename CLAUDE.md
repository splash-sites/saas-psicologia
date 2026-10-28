# CLAUDE.md — SaaS de Gestão para Psicólogas (nome do produto ainda não definido)

Este arquivo é a fonte de verdade do produto para o Claude Code. Leia por completo antes de escrever qualquer código. Sempre que uma decisão aqui parecer ambígua ou incompleta, pergunte antes de assumir.

## Visão geral

SaaS multi-tenant (várias psicólogas, cada uma com sua conta isolada) para gestão de consultório individual. Cada psicóloga controla seus próprios pacientes, agenda, prontuário/evolução e financeiro em um único painel. Não há painel para o paciente nesta fase — o sistema é de uso exclusivo da psicóloga.

Público: psicólogas autônomas (atendimento individual, não clínicas com múltiplos profissionais).

Modalidade de atendimento: híbrida — online (com integração de videochamada) e presencial.

## Modelo de negócio

- A psicóloga paga uma assinatura mensal única para usar a plataforma (cobrança recorrente via Asaas).
- O paciente NÃO paga pela plataforma. Pagamentos do paciente para a psicóloga são registrados manualmente dentro do sistema (sem gateway de pagamento nessa ponta, por enquanto).
- Preço único, tudo incluso — nenhuma funcionalidade do MVP deve ser vendida como "add-on" à parte. Isso é decisão deliberada de posicionamento (ver seção "Contexto competitivo").

## Contexto competitivo (por que este produto existe)

Pesquisa feita em concorrentes diretos (Clínica Experts, PsicoManager, Agendart) mostrou que o mercado já convergiu para cinco pilares padrão: agenda + prontuário/evolução + financeiro + teleconsulta + comunicação automática com paciente via WhatsApp. Todos vendem "IA" de alguma forma (principalmente transcrição de sessão → evolução automática).

Diferencial deste produto: ser simples e direto ("sem frufru"), com preço único e sem funcionalidades essenciais escondidas atrás de add-ons pagos (prática comum nos concorrentes, ex: Agendart cobra WhatsApp automático e auto-agendamento como adicional separado do plano base).

## Requisitos legais e de compliance (não são opcionais)

- **Resolução CFP nº 01/2009** (alterada pela nº 05/2010): torna obrigatório o registro documental dos atendimentos psicológicos. A evolução de cada sessão deve conter, no mínimo: avaliação da demanda/objetivos do trabalho, registro sintético dos procedimentos aplicados, resultados obtidos, e encaminhamentos/decisões tomadas. Não pode ser um campo de texto livre totalmente sem estrutura.
- **Guarda obrigatória de no mínimo 5 anos.** Nenhum registro de evolução pode ser deletado permanentemente antes disso — implementar sempre soft delete (campo `deleted_at`, nunca `DELETE` físico) para registros de prontuário/evolução.
- **LGPD — dados de saúde são categoria sensível.** Exigir criptografia em repouso para dados clínicos, controle de acesso rígido (RLS ou equivalente garantindo que uma psicóloga nunca acesse dados de outra conta), e nunca logar conteúdo de evolução em texto plano.
- Existe uma distinção formal entre "prontuário psicológico" (paciente tem direito de acesso) e "registro documental" mais técnico (acesso restrito à psicóloga). Não é relevante para o MVP (sem portal do paciente), mas ao desenhar o schema do banco, deixe espaço para um campo de "notas técnicas privadas" separado da "evolução" no futuro.

## Escopo do MVP

### 1. Conta e assinatura
1. Cadastro e login da psicóloga (multi-tenant desde o início — nunca assumir single-tenant no schema).
2. Assinatura única mensal, sem add-ons.
3. Cobrança recorrente via Asaas (integração API + webhook de confirmação de pagamento).

### 2. Pacientes
4. Cadastro de dados pessoais e contato.
5. Ficha de anamnese/avaliação inicial (demanda, objetivos do trabalho) — preenchida pela psicóloga.
6. Status do paciente: ativo, inativo, alta.
7. Botão de contato direto que abre WhatsApp Web com o número do paciente (link `wa.me`, mensagem manual avulsa — não é o lembrete do item 13).

### 3. Agenda
8. Calendário de consultas.
9. Tipo de consulta por agendamento: online ou presencial.
10. Recorrência (semanal, quinzenal etc.).
11. Bloqueio de horários/indisponibilidade.
12. Sincronização automática com Google Agenda — via de mão única (sistema → Google Agenda pessoal da psicóloga). Não importar eventos do Google de volta.
13. Lembrete de consulta **sem custo operacional** (decisão de produto: não usar WhatsApp Business API / Meta / Z-API, que cobram por mensagem ou violam os termos do WhatsApp). Dois mecanismos:
    - **Lista "Lembretes"** (`/lembretes`): consultas do dia seguinte (antecedência padrão de 24h, configurável pela psicóloga) com botão que abre o WhatsApp Web com a mensagem já preenchida (`wa.me`), enviada do número da própria psicóloga com 1 clique. Registra o envio; remarcar a consulta invalida o registro. É semi-manual — não é automático.
    - **Convite do Google Agenda** ao paciente por e-mail (automático): o paciente entra como convidado do evento e recebe convite, remarcação e cancelamento. Só para paciente que aceita lembretes, tem e-mail e com o convite ligado; o convidado não pode convidar terceiros nem ver outros convidados.
    - Mensagem apenas informativa, sem nenhum dado clínico; não pede confirmação/resposta (não processar respostas recebidas). O paciente tem um consentimento "aceita lembretes". O texto da mensagem é configurável.

### 4. Consultas e evolução (prontuário)
14. Registro de evolução por sessão, com campos estruturados mínimos (ver seção de compliance acima): demanda/objetivo, procedimentos/o que foi trabalhado, encaminhamentos/decisões.
15. Timeline cronológica de evoluções por paciente.
16. Soft delete obrigatório — nunca apagar fisicamente um registro de evolução.

### 5. Atendimento online
17. Geração automática de link do Google Meet ao marcar uma consulta como online (usar Google Calendar API com `conferenceDataVersion=1`, que já cria o evento no Google Agenda e o link do Meet numa única chamada — reaproveitar a mesma integração OAuth do item 12).
18. Link disponível na agenda para copiar/enviar ao paciente.

### 6. Financeiro
19. Lançamento manual de pagamento por paciente/sessão.
20. Status por paciente: pago, pendente, atrasado.
21. Painel de ganhos do mês.
22. Histórico financeiro mensal (visão de evolução ao longo do tempo).

## Fora do escopo do MVP (backlog de Fase 2, não implementar sem validação prévia com o usuário)

- Emissão de recibo/nota fiscal (NF-e/NFS-e).
- Envio 100% automático de lembretes pelo WhatsApp (WhatsApp Business API / Meta Cloud API): tem custo por mensagem, exige conta Meta Business verificada, número dedicado e templates aprovados. Só considerar quando o produto gerar receita. O código pode ganhar uma camada de provedor sem reescrever a tela de lembretes.
- Gateway de pagamento para o paciente pagar diretamente pela plataforma.
- Auto-agendamento pelo paciente (paciente marcando consulta sozinho).
- App ou portal de acesso para o paciente.
- Transcrição de sessão por IA → evolução automática. Avaliado e propositalmente adiado: exige pipeline próprio de gravação de áudio + speech-to-text + LLM (a transcrição nativa do Google Meet não cobre bem o caso de uso — API não permite ativação automática, exige plano pago do Google Workspace, dados ficam fora do sistema no Drive pessoal da psicóloga, e ainda seria necessário reformatar o texto no formato clínico exigido). Também levanta questão de consentimento explícito do paciente para gravação, que precisa ser resolvida antes de qualquer implementação.
- Multi-usuário por conta / suporte a clínicas com várias psicólogas (produto é para psicóloga autônoma individual).

## Stack técnico (recomendado — Opção 1, ver alternativa abaixo)

- **Frontend + Backend:** Next.js (App Router, TypeScript). Um único projeto full-stack.
- **Banco + Auth + Storage:** Supabase (Postgres). Usar Row Level Security (RLS) desde a primeira migration para isolamento multi-tenant — cada linha de dado sensível (pacientes, evoluções, financeiro) deve ter uma policy que restringe o acesso à própria psicóloga dona do registro. Não implementar isolamento apenas na camada de aplicação.
- **Auth:** Supabase Auth, com login Google OAuth (reaproveitado depois para as permissões de Calendar/Meet).
- **Hospedagem:** Vercel (app) + Supabase Cloud (banco). Ambos com free tier para começar.
- **Integrações externas:**
  - Asaas API — assinatura recorrente da psicóloga.
  - Google Calendar API — sincronização de agenda + geração de link do Meet + convite ao paciente (lembrete por e-mail).
  - WhatsApp: sem API. Lembrete via link `wa.me` pré-preenchido, enviado manualmente pela psicóloga (ver item 13). A WhatsApp Business API oficial (Meta Cloud API) fica no backlog da Fase 2, para quando houver receita que cubra o custo por mensagem.

**Alternativa (Opção 2), caso prefira mais controle e menos dependência de um único provedor:** Next.js + Prisma (ORM) + Postgres via Neon + Auth.js para autenticação. Isolamento multi-tenant precisa ser garantido manualmente no código (filtro por `psicologa_id` em toda query), já que não há RLS automático como no Supabase.

A escolha final do stack deve ser confirmada com o usuário antes de gerar qualquer scaffold de projeto.

## Diretrizes gerais para o desenvolvimento

- Priorizar simplicidade sobre abstração prematura — este é um produto que se posiciona justamente como "sem frufru". Evitar over-engineering, camadas desnecessárias, ou generalização para casos de uso que não existem ainda (ex: não construir suporte a múltiplos psicólogos por conta "só por garantia").
- Todo dado clínico (evolução, anamnese) é sensível — nunca logar em texto plano, nunca expor em URLs, sempre validar que o isolamento multi-tenant está sendo respeitado em cada nova query.
- Perguntar antes de assumir decisões de produto não documentadas aqui.

## Testes e qualidade

- Cada módulo implementado deve vir com testes automatizados (unitários e/ou de integração) cobrindo os fluxos principais e, especialmente, o isolamento multi-tenant (ex: um teste que garanta que a psicóloga A nunca consegue ler/editar dados da psicóloga B).
- Rodar a suíte de testes e o linter antes de considerar qualquer módulo da lista "pronto" — não avançar para o próximo item com testes quebrados ou pendentes.
- Toda nova tabela ou policy de RLS no Supabase precisa de um teste específico validando que a policy bloqueia acesso cruzado entre contas.
- Sugestão de ferramentas: Vitest (ou Jest) para testes unitários/integração; Playwright para alguns fluxos críticos de ponta a ponta (login, criar paciente, registrar evolução, lançar pagamento) — não precisa cobertura extensa de E2E no MVP, só os caminhos mais sensíveis.

## Segurança (complementa a seção de compliance/LGPD acima)

- Nunca commitar segredos ou chaves de API (Asaas, Google) no repositório — usar variáveis de ambiente, com `.env` no `.gitignore` desde o primeiro commit.
- Validar e sanitizar toda entrada de usuário no backend, mesmo que já validada no frontend.
- Nunca expor a `service_role key` do Supabase no frontend — só usar em código server-side.
- Webhooks (Asaas, e qualquer outro que venha a existir) devem validar assinatura/origem da requisição antes de processar qualquer evento.
- Aplicar rate limiting em endpoints públicos e sensíveis (login, webhooks) para mitigar abuso.
- Manter dependências atualizadas e rodar auditoria de vulnerabilidades (`npm audit` ou equivalente) periodicamente, principalmente antes de deploys.
- Qualquer decisão de segurança que envolva trade-off (ex: simplicidade vs. proteção extra) deve ser sinalizada ao usuário, não resolvida silenciosamente.

## Ordem sugerida de desenvolvimento

1. Setup do projeto, autenticação da psicóloga, estrutura multi-tenant básica.
2. Assinatura/cobrança via Asaas.
3. Módulo de pacientes (cadastro, anamnese, status).
4. Módulo de agenda (CRUD de consultas, recorrência, bloqueios).
5. Integração Google Calendar + geração de link do Meet.
6. Módulo de evolução/prontuário (com soft delete e estrutura mínima exigida).
7. Módulo financeiro (lançamentos, status de pagamento, painel de ganhos).
8. Lembretes de consulta sem custo (lista `wa.me` + convite do Google Agenda).

Desenvolver e validar cada módulo antes de avançar para o próximo — não pedir para o Claude Code implementar o sistema inteiro em uma única tacada.

## Status e decisões já tomadas

Módulos 1, 3, 4, 5, 6, 7 e 8 implementados e testados. **Módulo 2 (assinatura/cobrança via Asaas) retomado em 2026-09-28**, sem CNPJ ainda (ver seção de nota fiscal abaixo).

- **Stack:** Opção 1 (Next.js + Supabase). Migrations em `supabase/migrations/`; testes de RLS rodam contra Supabase local (Docker) — ver README.
- **Login (2026-10-06):** Google OAuth continua a opção principal (dá o token de Calendar/Meet de graça no mesmo consentimento). Adicionado e-mail+senha como alternativa (`EmailLoginForm.tsx`, `supabase.auth.signUp`/`signInWithPassword` direto no client) pra quem não tem/não quer usar conta Google — decisão do usuário. Quem cria conta assim não tem o refresh token do Google (aceitável: a integração de Agenda/Meet já é desenhada pra ser opcional); pode conectar depois em Configurações. `handle_new_user()` não depende de nada específico do Google (usa `email` como fallback de nome), então a trigger de criação de conta/assinatura trial funciona igual pros dois jeitos de login.
- **Dado clínico em repouso:** criptografia do Postgres (provedor) + RLS. Sem cifra na aplicação por coluna, de propósito: perder a chave significaria perder prontuário, o que conflita com a guarda obrigatória de 5 anos. Único segredo cifrado na aplicação: o refresh token do Google (AES-256-GCM, `GOOGLE_TOKEN_ENC_KEY`).
- **Soft delete:** evolução, paciente, consulta e lançamento financeiro nunca são apagados fisicamente (sem policy de DELETE); "arquivar" seta `deleted_at`.
- **Financeiro:** status gravado é só `pendente`/`pago`; "atrasado" é derivado (pendente com vencimento passado). O lançamento pergunta "já recebi / ainda vou receber" para preencher tudo uma vez só.
- **Fuso:** horários são interpretados em Brasília com offset fixo `-03:00` (sem horário de verão desde 2019). Trocar por fuso real se o produto atender outros fusos.
- **Google Calendar:** sincronização de mão única; falha no Google nunca derruba o agendamento local. O refresh token só é guardado se a permissão da Agenda foi concedida. `observacoes` da consulta **não** vão para o evento (o paciente convidado as veria).
- **Migrations no cloud** são aplicadas manualmente no SQL Editor do Supabase (CLI não linkada).
- **Confirmação de presença é manual** (`consultas.confirmada_em`): a psicóloga marca "paciente confirmou" no painel da consulta. O lembrete continua só informativo e o sistema não lê respostas. Remarcar limpa a confirmação.
- **Status `falta`**: paciente não compareceu. Ocupa o horário e não gera pendência de evolução.
- **Agenda:** grade semanal de horários (tablet/desktop) e visão Dia (celular); painel lateral da consulta via `?consulta=<id>`. Arrastar para remarcar ficou para depois.
- **Modo privado (Alt+O):** borra tudo marcado com `data-sensivel` (nomes de pacientes, valores), para compartilhar a tela. Preferência só no navegador (localStorage).
- **Assinatura via Asaas, sem CNPJ:** a empresa ainda não tem CNPJ (decisão do usuário, 2026-09-28) — cobrança recebida via Asaas como **pessoa física**; **nota fiscal fica de fora até o CNPJ existir** (MEI ou ME/Simples Nacional — decisão de contador, cidade é Torres/RS). Preço base R$ 49,90/mês, **14 dias de teste grátis a partir do cadastro** (trigger cria a assinatura junto com a psicóloga), **sem carência** — vencer já restringe —, mas a restrição é **somente leitura**, nunca bloqueio total (a psicóloga precisa poder consultar/exportar o próprio prontuário mesmo inadimplente, por causa da guarda de 5 anos).
- **Planos (2026-09-29):** três ciclos de cobrança, escolhidos na configuração da assinatura (`src/lib/assinatura/types.ts`, `PLANOS`) — Mensal R$49,90 (cycle Asaas `MONTHLY`), Trimestral R$134,73 = 10% off (cycle `QUARTERLY`), Semestral R$254,49 = 15% off (cycle `SEMIANNUALLY`). Cobrado de uma vez por ciclo, não por mês. Coluna `assinaturas.plano` (migration `0011_assinatura_planos.sql`); `simularPagamentoConfirmado` e o webhook usam `PLANOS[plano].meses` pra estimar o próximo vencimento certo (1/3/6 meses).
- **A trava de escrita é aplicada no RLS** (`assinatura_permite_escrita()`, nas policies de insert/update de pacientes/anamneses/consultas/bloqueios/evolucoes/pagamentos), não só na aplicação — consistente com o resto do projeto. Ela só entra em vigor se `app_config.assinatura_enforcement_ativo = true` (**começa desligada**, de propósito: sem isso, qualquer ambiente sem o Asaas configurado trancaria todo mundo sozinho 14 dias depois do primeiro cadastro). Ligar em produção só depois de validar a integração de ponta a ponta.
- **Webhook do Asaas** (`/api/asaas/webhook`): valida o `asaas-access-token` (comparação resistente a timing attack), nunca confia só no corpo — reconsulta o pagamento na API antes de liberar acesso —, é idempotente (`assinatura_eventos.chave_idempotencia`) e tem um rate limit simples baseado no próprio log (funciona entre instâncias serverless).
- **Modo simulado do Asaas** (`ASAAS_MODE=mock`, automático sem `ASAAS_API_KEY`): mesmo padrão do Google — o resto do app funciona sem a integração real. Tem um botão "Simular pagamento confirmado" em `/assinatura`, só existe nesse modo (o servidor confere de novo, nunca confia em o botão não aparecer).

### Login com Google pelo próprio domínio (2026-10-16 a 2026-10-17)

- **Problema:** com `signInWithOAuth` o Google volta pelo `spdp….supabase.co`, e é esse domínio que aparece na tela de consentimento — a verificação do escopo da Agenda exige domínio nosso. A saída documentada pelo Supabase é o custom domain (plano Pro, ~US$ 20–35/mês); decidimos **não pagar** e tirar o Supabase do caminho do OAuth (POC validada em 2026-10-17 contra o Supabase e o Google de produção).
- **Dois passos (decisão do usuário, 2026-10-17 — antes era um passo):** o login com Google pede só `openid email profile`; a Agenda vem depois por autorização incremental (recomendação das diretrizes do Google): cartão "Conecte sua Google Agenda" no painel enquanto não houver token com o escopo, e o botão em Configurações. Botão de login segue as diretrizes de marca ("Continuar com o Google", #FFFFFF/#747775/#1F1F1F, Google Sans 500, G sempre visível).
- **Fluxo:** Google Identity Services, "code model" em popup (`src/lib/google/useGoogleCodeClient.ts`). O navegador recebe um código e manda para `POST /api/google/login` (pública), que troca pelo token no servidor (`redirect_uri=postmessage`, `src/lib/google/oauth.ts`), abre a sessão com `supabase.auth.signInWithIdToken` (mesma conta de antes — o Supabase reconhece pelo usuário do Google) e guarda o refresh token se a Agenda veio junto (`src/lib/google/tokens.ts`). `POST /api/google/conectar` (exige sessão) faz o mesmo só para a Agenda — quem entrou por e-mail/senha; sem `linkIdentity`. Anti login CSRF: cookie `g_oauth_state` (double-submit, `Path=/api/google`) + `Origin` igual ao do servidor. CSP libera só `accounts.google.com/gsi`. `/auth/callback` fica para a confirmação de e-mail.
- **Escopo da Agenda: `calendar.events.owned`** (desde 2026-10-26; antes `calendar.events`): a primeira análise do Google pediu menor privilégio — o app só escreve na agenda principal, de que a psicóloga é dona, e o `.owned` cobre criar/alterar/apagar com Meet e convidados (testado em 2026-10-26). `ESCOPOS_CALENDAR` aceita também `calendar.events` e `calendar` de tokens antigos.
- **Google Cloud:** o escopo da Agenda (`calendar.events.owned`) precisa estar declarado em Acesso a dados — com o app "Em produção", o Google omite da tela um escopo sensível não declarado (foi o que fez a Agenda "não conectar" no primeiro teste). Origens JS: `https://app.gradatim.com.br` e `http://localhost:3000`; o redirect URI do Supabase sai.
- **Chave liga/desliga mantida:** `GOOGLE_AGENDA_ATIVA` (`src/lib/google/flag.ts`, de `NEXT_PUBLIC_GOOGLE_AGENDA_ATIVA=1`; só Production na Vercel — preview em `*.vercel.app` não é origem autorizada). Desligada: login só e-mail/perfil, sync `desativada`, Configurações sem a seção do Google.
- **Link fixo de atendimento online** (migration `0018`, `psicologas.link_atendimento_online`, só https): reserva para quem não conectou a Agenda. `linkDaConsulta()` (`src/lib/agenda/linkOnline.ts`) usa o `meet_link` do Google e cai no fixo. Com a Agenda conectada, Configurações esconde o campo. Botões: "Entrar na chamada".
- **Justificativa do escopo para a verificação:** o app cria/atualiza/cancela na agenda principal da psicóloga os eventos das consultas marcadas no Gradatim, com Meet nas online e o paciente como convidado; via de mão única, nunca lê outros eventos; `calendar.events.owned` é o menor escopo para events.insert/patch/delete na agenda principal (`calendar.app.created` exigiria uma agenda separada, mudando o produto).

### Revisão de segurança e pré-produção (2026-10-07 a 2026-10-13, PR #1 — mergeado na `main` em 2026-10-09)

- **Validação no banco, não só no Zod** (migrations `0013`/`0014`): o client logado escreve direto no PostgREST, então o Zod das server actions não é a única porta. Triggers padronizam (trim, texto vazio → NULL, e-mail minúsculo, telefone e CPF **só dígitos** — máscara só na exibição) e CHECK constraints limitam tamanho/formato/faixa. O Zod espelha as mesmas regras para mostrar erro amigável (CPF com dígito verificador, telefone com DDD).
- **Referências sempre da mesma conta** (`0012`): policies de escrita checam `paciente_da_psicologa()`/`consulta_da_psicologa()` — a FK não passa pelo RLS.
- **RLS com `(select auth.uid())`** (`0015`): avaliado uma vez por consulta, não por linha.
- **Login validado localmente com `getClaims()`** (proxy + `usuarioAtual()` em `src/lib/auth/usuario.ts`, com `cache` por requisição), não `getUser()`. O teste de carga mostrou que `getUser()` esgotava as conexões do GoTrue e deslogava pessoas. **Trade-off aceito pelo usuário:** sessão encerrada em outro lugar vale até o token expirar (até 1 h). Depende da chave JWT do projeto ser assimétrica — **em produção é ECC (P-256)**. `getUser()` só fica em Configurações (precisa das identidades vinculadas).
- **CSP com nonce por requisição** (proxy) + headers de segurança (`next.config.ts`). `style-src` mantém `'unsafe-inline'` (a agenda usa `style={...}`).
- **Formulários com `useActionState` enviam via `enviarSemLimpar()`** (`src/lib/form/`), não `<form action>`: o React 19 limpava os campos quando a action voltava com erro (perdia texto de evolução).
- **Exportação:** prontuário em PDF por download (`/api/prontuario/[id]`, pdf-lib) e conta inteira em ZIP de CSVs (`/api/exportar`). **Notas privadas entram em todos os formatos** (decisão do usuário). Funcionam com a assinatura em somente leitura.
- **Testes além do Vitest:** `npm run api-check` (todas as páginas, rotas e server actions + isolamento entre contas; precisa do `next dev -p 3100` com o Supabase local), `npm run e2e` (Playwright no build de produção, porta 3200, Chrome instalado), `npm run visual`.
- **Migrations 0012–0015 aplicadas no Supabase de produção em 2026-10-09** (via SQL Editor; diagnóstico da 0014 = 0 linhas; dados intactos).
- **Ambiente de testes finais:** tudo em produção (Vercel + Supabase), mas o **Asaas fica no sandbox** até os testes de assinatura terminarem (webhook real apontando pro domínio de produção, sem ngrok). Não abrir para clientes reais nesse período.

## Checklist antes de produção (não fazer em dev/teste — só antes de ir ao ar)

- [ ] **Rotacionar `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_OAUTH_CLIENT_SECRET`, `ASAAS_API_KEY` e `GOOGLE_TOKEN_ENC_KEY`.** Em 2026-09-29, um comando de debug (`cat` num `.env.local`) imprimiu essas 4 chaves em texto puro nesta conversa. **Em andamento desde 2026-10-09**, feito pelo usuário nos painéis, uma etapa por vez (nunca colar chave no chat):
  1. [x] **Supabase → chaves novas** (*2026-10-13: manutenção assumida pelo usuário — o colega que iniciou a rotação continua na equipe, só não mantém este sistema por enquanto (acessos dele ficam). Secret keys separadas por ambiente: `vercel_produção` (Vercel) e `local_dev` (`.env.local`). Login + PDF em produção ok*). Na Vercel (Production + Preview): `NEXT_PUBLIC_SUPABASE_ANON_KEY` = publishable `default` (`sb_publishable_…`), `SUPABASE_SERVICE_ROLE_KEY` = secret `vercel_produção` (`sb_secret_…`). Redeploy (a publishable entra no build) e testar login + PDF. **Já provado localmente que o código funciona com esse formato sem mudança.**
  2. [x] (*2026-10-13: legadas desativadas; login em produção e `.env.local` validados depois disso.*) Depois do login ok: Supabase → API Keys → aba Legacy → **desativar as chaves legadas** (reversível). Testar de novo. Atualizar `.env.local` de outras máquinas.
  3. [x] (*2026-10-15: revogada; JWKS publica só a ES256; chaves novas e app ok depois disso*) Por último: Supabase → JWT Keys → **revogar a "Previous key — Legacy HS256"** (irreversível; só depois do passo 2).
  4. [x] (*2026-10-15: secret novo (termina em `TJmt`) no Supabase, Vercel e `.env.local`; o vazado (`rD-f`, de 2026-09-10) desativado; login com Google + Meet testados em produção depois de desativar. Falta só excluir o `rD-f` daqui a alguns dias. Lição: a primeira tentativa, de 2026-10-13, não tinha trocado nada — conferir sempre pelos últimos caracteres*) **Google OAuth:** Google Cloud → Credenciais → cliente OAuth → adicionar secret; trocar em **dois lugares** (Vercel `GOOGLE_OAUTH_CLIENT_SECRET` e Supabase → Auth → Providers → Google); redeploy; testar login com Google; desativar o secret antigo.
  5. [ ] (*2026-10-13: decisão do usuário — não rotacionar a chave do sandbox (não movimenta dinheiro); ir direto para o Asaas de produção. Basta tirar a chave do sandbox da Vercel na virada*) **Asaas sandbox:** gerar chave nova (invalida a antiga); Vercel: `ASAAS_MODE=sandbox`, `ASAAS_API_KEY` nova, `ASAAS_WEBHOOK_TOKEN` novo; cadastrar o webhook do sandbox em `https://<domínio de produção>/api/asaas/webhook` com o mesmo token.
  6. [x] (*2026-10-15: chave nova gerada direto no `.env.local` (sem exibir) e copiada para a Vercel; `google_oauth_tokens` limpa; token novo, criado pelo próprio login com Google, decifra com a chave nova; Meet ok. O login com Google já reconecta a Agenda sozinho — não precisa passar por Configurações*) **`GOOGLE_TOKEN_ENC_KEY`:** trocar direto (decisão do usuário) — gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Quem tinha o Google Agenda conectado reconecta em `/configuracoes`.
  7. [ ] Redeploy e teste completo de assinatura no sandbox com o webhook de verdade.
- [ ] Ligar a trava de assinatura (`update app_config set assinatura_enforcement_ativo = true`) só depois de validar o fluxo do Asaas de ponta a ponta.
- [x] **Asaas em produção (2026-10-28):** conta PF aprovada (ramo "Desenvolvimento e suporte tecnológico"); chave de API `gradatim` sem expiração e **sem permissão de saque**; webhook `https://app.gradatim.com.br/api/asaas/webhook` com token novo, eventos `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`/`PAYMENT_OVERDUE`/`PAYMENT_CREATED`/`PAYMENT_UPDATED`; **clientes criados com `notificationDisabled: true`** (sem taxa de mensageria de R$ 0,99 por cobrança — decisão do usuário): quem avisa é o app — `PAYMENT_CREATED`/`UPDATED` guardam link e vencimento da cobrança em aberto e o painel mostra uma faixa nos 5 dias antes do vencimento (`diasParaAvisoCobranca`), com "Pagar agora"; sem e-mail; Vercel Production `ASAAS_MODE=production` (Config), `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` (Secret); ids do sandbox limpos (1 conta, a do usuário). Pagamento real validado: plano mensal temporariamente a R$ 5 (mínimo do Asaas), pago por Pix, webhook `PAYMENT_RECEIVED` respondeu 200. Preço voltou para R$ 49,90 no código. Pix só aparece na fatura com chave Pix cadastrada na conta Asaas (chave aleatória, criada no dia). A "Validação de saque via webhook" do Asaas fica desligada (o app não tem esse endpoint). **Pendente:** editar no Asaas a assinatura de teste do usuário de R$ 5 para R$ 49,90; **Estorno/chargeback (2026-10-28):** eventos `PAYMENT_REFUNDED`/`PARTIALLY_REFUNDED`/`REFUND_IN_PROGRESS`/`CHARGEBACK_REQUESTED`/`CHARGEBACK_DISPUTE`/`AWAITING_CHARGEBACK_REVERSAL`; status relido na API; se a cobrança é do período atual, estorno ou chargeback deixam a conta somente leitura na hora (ativa → atrasada; cancelada perde o resto do período) — decisão do usuário, vale também para estorno feito por nós; disputa ganha volta para ativa; estorno parcial não bloqueia. Sem fatura em aberto, `/assinatura` manda escrever para `contato@splashsistemas.com.br`. **O webhook não confere o valor pago, de propósito:** só quem tem o painel/chave do Asaas cria cobrança com valor menor, e conferir bloquearia descontos manuais.
- [x] **Domínio próprio — `gradatim.com.br` (nome do produto: Gradatim), comprado em 2026-10-14 no registro.br:** raiz = landing (projeto separado), `app.gradatim.com.br` = aplicação (Vercel). O custom domain `auth.` do Supabase **não é mais necessário** (login com Google pelo próprio domínio, ver seção acima). Falta só apontar o webhook do Asaas para `app.gradatim.com.br` na virada para produção.
- [ ] **Repositório `splash-sites/saas-psicologia` está PÚBLICO (constatado em 2026-10-27):** qualquer pessoa lê o código e o histórico (inclui o CLAUDE.md com ids do projeto, e-mails e decisões de segurança; nenhuma chave/senha). Tornar privado — mas o plano Hobby da Vercel não faz deploy de repo privado de organização, então só junto com a migração para o time Pro (item abaixo); antes disso os deploys parariam.
- [ ] **Vercel — unificar contas e plano Pro:** hoje o app e a landing (`saas-lp-sandy.vercel.app`, repo separado, Astro) estão em contas Vercel diferentes; funciona (o domínio raiz exige TXT `_vercel` de verificação), o ideal é que as contas sejam da empresa, não pessoais. O plano Hobby é só para uso não comercial — antes de cobrar clientes, mover os dois projetos para um único time **Pro** do usuário.
- [x] **DNS no registro.br (2026-10-14):** A raiz → `216.198.79.1` (landing); CNAME `www` → Vercel (redirect 308 para a raiz); TXT `_vercel` ×2 (verificação da landing em outra conta Vercel); CNAME `app` → `faac29b4213fc123.vercel-dns-017.com`; TXT raiz `google-site-verification=…` (Search Console, verificado — **não remover**). O registro.br não aceita `@` — nome em branco para a raiz.
- [ ] **SMTP próprio no Supabase Auth (Resend, plano grátis):** o SMTP padrão do Supabase tem limite baixíssimo e só entrega para membros do time — recuperação de senha do login por e-mail não chegaria a usuários reais. Criar conta no Resend, verificar `gradatim.com.br` (registros SPF/DKIM/MX de envio no registro.br), configurar em Authentication → SMTP Settings (remetente `nao-responda@gradatim.com.br`) e testar com e-mail de fora do time. Receber em `contato@gradatim.com.br` é à parte (Zoho grátis ou redirecionamento).
- [ ] **Verificação do Google (enviada em 2026-10-19):** app "Em produção", usuário Externo; **marca verificada e publicada** (tela mostra "Gradatim" e logo); **acesso a dados em análise** — em 2026-10-22 o Google pediu vídeo novo (menor privilégio, permissões expandidas na tela, uso completo do escopo, instruções de teste); escopo trocado para `calendar.events.owned` em 2026-10-26; **respondido em 2026-10-26** (justificativa nova no Acesso a dados + vídeo novo com legendas, permissões expandidas, convidado, remarcar, cancelar e desconectar: `https://youtu.be/GU8MD3z6nn4` + passos de teste no e-mail). Aguardando nova resposta do Google na mesma conversa — revisão de 4 a 6 semanas, primeiro e-mail em 3–5 dias (Gmail do usuário + `contato@splashsistemas.com.br`). Vídeo atual: `https://youtu.be/GU8MD3z6nn4` (não listado; o primeiro, `_qxgBcDktLs`, foi recusado). Até aprovar: tela de app não verificado ao conectar a Agenda e limite de 100 contas — **não divulgar para clientes reais**. O escopo `calendar.events.owned` precisa continuar declarado em Acesso a dados.
- [ ] Decisões de produto pendentes: confirmação de e-mail no cadastro; 2FA; política de exclusão de conta — **parte A feita em 2026-10-16**: migration `0016_guarda_prontuario.sql` troca `cascade` por `restrict` em `psicologas → auth.users` e nas FKs de `evolucoes`/`anamneses` (apagar o usuário no painel agora falha em vez de levar o prontuário; teste em `tests/rls/guarda-prontuario.test.ts`), e o item 8 dos Termos define **encerrar = cancelar a assinatura** (decisão do usuário, 2026-10-16): a conta fica em somente leitura e a psicóloga continua entrando para consultar/exportar o prontuário durante os 5 anos — sem bloqueio de login nem SQL manual. Exclusão definitiva só a pedido: apaga o que não tem guarda e o prontuário só depois do prazo. Depende de `assinatura_enforcement_ativo = true` (hoje desligada = acesso total). **Cancelada mantém escrita até o fim do período pago** (migration `0017`: `greatest(proximo_vencimento, trial_fim) >= hoje`; mesma regra em `permiteEscrita`/`acessoAteCancelada` em `src/lib/assinatura/types.ts`) — 0017 aplicada em produção em 2026-10-16. 0016 aplicada em produção em 2026-10-16. Parte B (botão "Encerrar conta", bloqueio de login mantendo os dados, expurgo após 5 anos) fica para depois — exige decisões de produto.
- [ ] Monitoramento de erros e uptime; backup + teste de restauração; região São Paulo; DPA da Supabase/Vercel e revisão jurídica de Termos/Privacidade.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
