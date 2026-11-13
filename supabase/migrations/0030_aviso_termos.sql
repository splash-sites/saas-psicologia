-- Aviso de atualização dos Termos e da Privacidade (2026-11-13, decisão do
-- usuário): o Painel mostra uma faixa até a psicóloga clicar em "Entendi" ou
-- por até 30 dias depois da atualização. Guarda qual versão (data) ela viu,
-- por conta: vale em qualquer aparelho e registra que foi avisada.
-- A própria psicóloga grava (policy psicologas_update_own, sem a trava de
-- assinatura: em somente leitura ela também precisa poder fechar o aviso).

alter table public.psicologas add column if not exists termos_versao_vista date;
