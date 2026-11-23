import { NextResponse } from "next/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { tokenValido } from "@/lib/asaas/webhook";

// Cron diário da Vercel (vercel.json): cria os lançamentos "a receber" das
// sessões que já aconteceram, em todas as contas (migration 0035). As telas
// também criam ao abrir; isto cobre quem não abriu o sistema.
// A Vercel manda "Authorization: Bearer <CRON_SECRET>"; sem o segredo
// configurado, a rota não roda para ninguém.
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  const recebido = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!segredo || !tokenValido(recebido, segredo)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  if (!adminDisponivel()) {
    return NextResponse.json({ erro: "sem service role" }, { status: 503 });
  }

  const { data, error } = await createAdminClient().rpc("gerar_lancamentos_sessoes");
  if (error) {
    // Sem detalhes do banco na resposta.
    return NextResponse.json({ erro: "falhou" }, { status: 500 });
  }
  return NextResponse.json({ criados: data ?? 0 });
}
