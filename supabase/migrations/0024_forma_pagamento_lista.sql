-- Forma de pagamento em lista fixa (decisão do usuário, 2026-11-06). Antes era
-- texto livre: "Pix", "pix" e "PIX " viravam três formas e não dava para somar
-- por forma. Códigos = FORMAS_PAGAMENTO em src/lib/financeiro/types.ts.
--
-- Converte o que já existe pelo texto (sem acento, minúsculo). O que não for
-- reconhecido vira 'outro', e o texto original vai para o fim das observações
-- ("Forma de pagamento: ..."), para não perder a informação.

create or replace function public.forma_pagamento_codigo(t text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when t is null or btrim(t) = '' then null
    when s in ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro',
               'transferencia', 'boleto', 'outro') then s
    when s like '%pix%' then 'pix'
    when s like '%dinheiro%' or s like '%especie%' then 'dinheiro'
    when s like '%credito%' then 'cartao_credito'
    when s like '%debito%' then 'cartao_debito'
    when s like '%transf%' or s ~ '\m(ted|doc)\M' then 'transferencia'
    when s like '%boleto%' then 'boleto'
    else 'outro'
  end
  from (
    select lower(translate(btrim(t), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
                                     'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) as s
  ) x;
$$;

-- Guarda o texto original nas observações quando ele não é exatamente uma
-- forma conhecida e caiu em 'outro' (respeita o limite de 2000 caracteres).
update public.pagamentos
set observacoes = left(
      concat_ws(E'\n', observacoes, 'Forma de pagamento: ' || btrim(forma_pagamento)),
      2000
    )
where forma_pagamento is not null
  and public.forma_pagamento_codigo(forma_pagamento) = 'outro'
  and lower(btrim(forma_pagamento)) <> 'outro';

update public.pagamentos
set forma_pagamento = public.forma_pagamento_codigo(forma_pagamento)
where forma_pagamento is distinct from public.forma_pagamento_codigo(forma_pagamento);

alter table public.pagamentos
  drop constraint if exists pagamentos_forma_valida;

alter table public.pagamentos
  add constraint pagamentos_forma_valida check (
    forma_pagamento is null or forma_pagamento in (
      'pix', 'dinheiro', 'cartao_credito', 'cartao_debito',
      'transferencia', 'boleto', 'outro'
    )
  );
