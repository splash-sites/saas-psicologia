-- Teste grátis passa de 14 para 7 dias (decisão do usuário, 2026-11-05).
--
-- Só muda o padrão de trial_fim, usado quando a conta é criada (a trigger
-- handle_new_user insere a assinatura sem informar a data). Quem já está no
-- teste mantém os 14 dias prometidos no cadastro: nenhuma linha é alterada.

alter table public.assinaturas
  alter column trial_fim set default (current_date + 7);
