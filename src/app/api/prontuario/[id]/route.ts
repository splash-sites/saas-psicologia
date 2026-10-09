import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import type { Anamnese, Paciente } from "@/lib/pacientes/types";
import type { Evolucao } from "@/lib/prontuario/types";
import { gerarProntuarioPdf } from "@/lib/exportacao/prontuarioPdf";

// Download do prontuário de um paciente em PDF. Client da própria psicóloga:
// o RLS garante que paciente de outra conta dá 404. Funciona com a assinatura
// em modo somente leitura (só lê). Inclui paciente arquivado (guarda de 5 anos).

function nomeArquivo(nome: string): string {
  const slug = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return `prontuario-${slug || "paciente"}-${hoje}.pdf`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  const supabase = await createClient();
  const [{ data: paciente }, { data: psicologa }, { data: anamnese }, { data: evolucoes, error }] =
    await Promise.all([
      supabase.from("pacientes").select("*").eq("id", id).maybeSingle(),
      supabase.from("psicologas").select("nome, crp").eq("id", user.id).maybeSingle(),
      supabase.from("anamneses").select("*").eq("paciente_id", id).maybeSingle(),
      supabase
        .from("evolucoes")
        .select("*")
        .eq("paciente_id", id)
        .is("deleted_at", null)
        .order("data_sessao")
        .order("created_at"),
    ]);

  if (!paciente) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  if (error) return NextResponse.json({ error: "não foi possível gerar agora" }, { status: 500 });

  const pdf = await gerarProntuarioPdf({
    psicologa: { nome: psicologa?.nome ?? null, crp: psicologa?.crp ?? null },
    paciente: paciente as Paciente,
    anamnese: anamnese as Anamnese | null,
    evolucoes: (evolucoes ?? []) as Evolucao[],
  });

  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo((paciente as Paciente).nome)}"`,
      // Dado de saúde: nunca em cache de navegador/CDN.
      "Cache-Control": "no-store",
    },
  });
}
