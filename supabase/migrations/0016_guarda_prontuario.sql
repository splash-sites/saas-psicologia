-- Guarda mínima de 5 anos do prontuário (Resolução CFP 01/2009).
--
-- Até aqui, apagar o usuário em auth.users (ex.: Authentication → Users →
-- Delete no painel do Supabase) apagava em cascata a psicóloga e, com ela,
-- anamneses e evoluções. Agora isso falha com erro de FK: o prontuário só sai
-- do banco por um processo explícito (encerramento de conta + expurgo depois
-- do prazo, ainda não implementado).
--
-- Agenda, financeiro, lembretes e assinatura continuam em cascata a partir da
-- psicóloga — só o que é prontuário (anamneses, evoluções) fica travado.

alter table public.psicologas
  drop constraint psicologas_id_fkey,
  add constraint psicologas_id_fkey
    foreign key (id) references auth.users(id) on delete restrict;

alter table public.evolucoes
  drop constraint evolucoes_psicologa_id_fkey,
  add constraint evolucoes_psicologa_id_fkey
    foreign key (psicologa_id) references public.psicologas(id) on delete restrict;

alter table public.anamneses
  drop constraint anamneses_psicologa_id_fkey,
  add constraint anamneses_psicologa_id_fkey
    foreign key (psicologa_id) references public.psicologas(id) on delete restrict;

alter table public.anamneses
  drop constraint anamneses_paciente_id_fkey,
  add constraint anamneses_paciente_id_fkey
    foreign key (paciente_id) references public.pacientes(id) on delete restrict;
