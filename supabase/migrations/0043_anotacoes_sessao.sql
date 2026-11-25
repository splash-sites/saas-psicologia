-- Anotações para a sessão (decisão do usuário em 2026-11-25).
--
-- Texto livre da psicóloga ligado a uma consulta: ideias para a próxima
-- sessão, o que retomar, etc. Escrito antes (ou depois) da sessão e mostrado
-- no painel da consulta, no topo do formulário de evolução, na linha do tempo
-- e no PDF do prontuário. É dado clínico: mesmo limite dos textos do
-- prontuário (20.000), nunca vai para o Google Agenda (o evento só leva título,
-- horário, Meet e convidado) e abrir o painel com anotação grava em
-- acessos_prontuario (tipo 'anotacao').
--
-- Diferente de consultas.observacoes (logística, 2.000 caracteres).
-- A trava de assinatura já vale: a policy de update de consultas usa
-- assinatura_permite_escrita().

alter table public.consultas
  add column if not exists anotacoes_sessao text;

alter table public.consultas drop constraint if exists consultas_anotacoes_sessao_valida;
alter table public.consultas
  add constraint consultas_anotacoes_sessao_valida
    check (anotacoes_sessao is null or char_length(anotacoes_sessao) <= 20000);

-- A agenda mostra um ícone no card sem ler o texto clínico da semana inteira.
alter table public.consultas
  add column if not exists tem_anotacoes boolean
    generated always as (anotacoes_sessao is not null) stored;

create or replace function public.normalizar_consulta()
returns trigger
language plpgsql
as $$
begin
  new.observacoes := public.texto_limpo(new.observacoes);
  new.anotacoes_sessao := public.texto_limpo(new.anotacoes_sessao);
  return new;
end;
$$;

-- Registro de acesso: abrir as anotações de uma sessão --------------------------
alter table public.acessos_prontuario drop constraint if exists acessos_prontuario_tipo_check;
alter table public.acessos_prontuario
  add constraint acessos_prontuario_tipo_check
    check (tipo in ('ficha', 'evolucoes', 'evolucao', 'documento', 'anotacao'));
