-- Múltiplos ciclos de cobrança: mensal, trimestral (10% off) e semestral (15%
-- off). Preço e ciclo por plano ficam em código (src/lib/assinatura/types.ts)
-- pra evitar duas fontes de verdade; aqui só guardamos qual plano a psicóloga
-- escolheu, pra reexibir na tela e pra simularPagamentoConfirmado saber quantos
-- meses somar no próximo vencimento.

create type public.assinatura_plano as enum ('mensal', 'trimestral', 'semestral');

alter table public.assinaturas
  add column plano public.assinatura_plano not null default 'mensal';
