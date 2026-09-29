-- Backfill: contas criadas antes da migration 0009 não passaram pelo trigger
-- que cria a linha em assinaturas junto com o cadastro, então ficaram sem
-- assinatura. Cria a assinatura em trial (14 dias a partir de agora) pra
-- quem já existe e ainda não tem uma. Idempotente: não duplica quem já tem.
insert into public.assinaturas (psicologa_id)
select p.id
from public.psicologas p
left join public.assinaturas a on a.psicologa_id = p.id
where a.psicologa_id is null;
