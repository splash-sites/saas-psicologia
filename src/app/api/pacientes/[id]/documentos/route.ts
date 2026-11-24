import { zipSync } from "fflate";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { nomeDoArquivo, TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/documentos/tipos";
import {
  MSG_DOWNLOAD_FALHOU,
  MSG_DOWNLOAD_NAO_ENCONTRADO,
  MSG_DOWNLOAD_SEM_LOGIN,
  registrarExportacao,
  respostaErroDownload,
  respostaLimiteExportacao,
} from "@/lib/exportacao/limite";

// "Baixar todos (ZIP)" da ficha (0041): os documentos de um paciente (menos os
// excluídos). O ZIP da conta leva só a lista: 100 MB a 1 GB por conta não cabem
// numa função. Funciona em somente leitura.

export const maxDuration = 60;

function slug(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "paciente"
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioAtual();
  if (!user) return respostaErroDownload(401, MSG_DOWNLOAD_SEM_LOGIN);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return respostaErroDownload(404, MSG_DOWNLOAD_NAO_ENCONTRADO);

  const supabase = await createClient();
  const { data: paciente } = await supabase.from("pacientes").select("id, nome").eq("id", id).maybeSingle();
  if (!paciente) return respostaErroDownload(404, MSG_DOWNLOAD_NAO_ENCONTRADO);
  if (!(await registrarExportacao(supabase, "documentos", id))) return respostaLimiteExportacao();

  const { data: docs, error } = await supabase
    .from("documentos")
    .select("id, nome, tipo, data_documento, mime, arquivo_path")
    .eq("paciente_id", id)
    .not("enviado_em", "is", null)
    .is("arquivo_excluido_em", null)
    .order("data_documento");
  if (error) return respostaErroDownload(500, MSG_DOWNLOAD_FALHOU);
  if (!docs?.length) return respostaErroDownload(404, "Este paciente não tem documentos.");

  const arquivos: Record<string, Uint8Array> = {};
  const usados = new Set<string>();
  for (const d of docs) {
    const { data: blob, error: e } = await supabase.storage.from("documentos").download(d.arquivo_path as string);
    if (e || !blob) return respostaErroDownload(500, MSG_DOWNLOAD_FALHOU);
    const base = `${d.data_documento} ${TIPOS_DOCUMENTO[d.tipo as TipoDocumento]} - ${d.nome}`;
    let nome = nomeDoArquivo(base, d.mime as string);
    for (let n = 2; usados.has(nome); n++) nome = nomeDoArquivo(`${base} (${n})`, d.mime as string);
    usados.add(nome);
    arquivos[nome] = new Uint8Array(await blob.arrayBuffer());
  }

  // Já comprimidos (PDF, JPEG, DOCX): sem compressão de novo, só junta.
  const zip = zipSync(arquivos, { level: 0 });
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new Response(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="documentos-${slug(paciente.nome as string)}-${hoje}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
