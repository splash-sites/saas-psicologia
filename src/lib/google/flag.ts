// Integração Google Agenda/Meet (itens 12, 13-convite e 17 do MVP).
//
// Desligada no lançamento (decisão do usuário, 2026-10-16): o escopo da Agenda
// exige a verificação do Google, que por sua vez pede o login num domínio
// próprio (custom domain do Supabase, ~US$ 20/mês). Sem ela, o login com
// Google pede só e-mail/perfil e a consulta online usa o link fixo da
// psicóloga (psicologas.link_atendimento_online).
//
// Todo o código da integração continua no projeto. Para religar:
// NEXT_PUBLIC_GOOGLE_AGENDA_ATIVA=1 na Vercel + redeploy (o valor entra no
// build, porque o botão de login roda no navegador) — ver CLAUDE.md.
export const GOOGLE_AGENDA_ATIVA = process.env.NEXT_PUBLIC_GOOGLE_AGENDA_ATIVA === "1";
