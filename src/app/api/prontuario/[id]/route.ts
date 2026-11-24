import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import type { Anamnese, Paciente } from "@/lib/pacientes/types";
import type { Evolucao } from "@/lib/prontuario/types";
import { gerarProntuarioPdf, type DocumentoPdf } from "@/lib/exportacao/prontuarioPdf";
import { TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/documentos/tipos";
import {
  MSG_DOWNLOAD_FALHOU,
  MSG_DOWNLOAD_NAO_ENCONTRADO,
  MSG_DOWNLOAD_SEM_LOGIN,
  registrarExportacao,
  respostaErroDownload,
  respostaLimiteExportacao,
} from "@/lib/exportacao/limite";

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
  if (!user) return respostaErroDownload(401, MSG_DOWNLOAD_SEM_LOGIN);

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return respostaErroDownload(404, MSG_DOWNLOAD_NAO_ENCONTRADO);
  }

  const supabase = await createClient();
  if (!(await registrarExportacao(supabase, "prontuario", id))) return respostaLimiteExportacao();

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

  if (!paciente) return respostaErroDownload(404, MSG_DOWNLOAD_NAO_ENCONTRADO);
  if (error) return respostaErroDownload(500, MSG_DOWNLOAD_FALHOU);

  // Documentos (0041): só a lista. Sem a migration, a consulta falha e a lista fica vazia.
  const { data: docsRaw } = await supabase
    .from("documentos")
    .select("nome, tipo, data_documento, finalidade, destinatario, evolucao_id, deleted_at, arquivo_excluido_em")
    .eq("paciente_id", id)
    .not("enviado_em", "is", null)
    .order("data_documento");
  const sessaoDe = new Map(((evolucoes ?? []) as Evolucao[]).map((e) => [e.id, e.data_sessao]));
  const documentos: DocumentoPdf[] = (docsRaw ?? []).map((x) => ({
    nome: x.nome as string,
    tipo: TIPOS_DOCUMENTO[x.tipo as TipoDocumento] ?? "Outro",
    data_documento: x.data_documento as string,
    finalidade: x.finalidade as string | null,
    destinatario: x.destinatario as string | null,
    sessao: x.evolucao_id ? (sessaoDe.get(x.evolucao_id as string) ?? null) : null,
    arquivado: Boolean(x.deleted_at),
    arquivoExcluidoEm: x.arquivo_excluido_em as string | null,
  }));

  const pdf = await gerarProntuarioPdf({
    psicologa: { nome: psicologa?.nome ?? null, crp: psicologa?.crp ?? null },
    paciente: paciente as Paciente,
    anamnese: anamnese as Anamnese | null,
    evolucoes: (evolucoes ?? []) as Evolucao[],
    documentos,
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
