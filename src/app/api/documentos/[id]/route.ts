import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { registrarAcesso } from "@/lib/prontuario/acesso";
import { nomeDoArquivo } from "@/lib/documentos/tipos";
import {
  MSG_DOWNLOAD_FALHOU,
  MSG_DOWNLOAD_NAO_ENCONTRADO,
  MSG_DOWNLOAD_SEM_LOGIN,
  respostaErroDownload,
} from "@/lib/exportacao/limite";

// Abre um documento (0041): confere pelo RLS que é da conta, registra o acesso
// e redireciona para um link assinado de 1 minuto (bucket privado; o link
// nunca fica salvo em lugar nenhum). Funciona em somente leitura e para
// documento arquivado (guarda de 5 anos). Word sempre baixa; PDF e foto abrem.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioAtual();
  if (!user) return respostaErroDownload(401, MSG_DOWNLOAD_SEM_LOGIN);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return respostaErroDownload(404, MSG_DOWNLOAD_NAO_ENCONTRADO);

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documentos")
    .select("id, paciente_id, nome, mime, arquivo_path, enviado_em")
    .eq("id", id)
    .maybeSingle();
  if (!doc || !doc.enviado_em) return respostaErroDownload(404, MSG_DOWNLOAD_NAO_ENCONTRADO);

  await registrarAcesso(supabase, "documento", doc.paciente_id as string, undefined, doc.id as string);

  const baixar = !(doc.mime === "application/pdf" || (doc.mime as string).startsWith("image/"));
  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(doc.arquivo_path as string, 60, baixar ? { download: nomeDoArquivo(doc.nome as string, doc.mime as string) } : undefined);
  if (error || !data?.signedUrl) return respostaErroDownload(500, MSG_DOWNLOAD_FALHOU);

  return new Response(null, {
    status: 302,
    headers: { Location: data.signedUrl, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
