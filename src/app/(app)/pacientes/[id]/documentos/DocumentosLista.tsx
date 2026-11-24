import Link from "next/link";
import { Download, FileImage, FileText, Trash2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIPOS_DOCUMENTO, formatarTamanho, type Documento } from "@/lib/documentos/tipos";
import { AnexarDocumento } from "./AnexarDocumento";
import { EditarDocumento } from "./EditarDocumento";
import { excluirArquivoDocumento } from "./actions";

const COLUNAS =
  "id, paciente_id, evolucao_id, nome, tipo, data_documento, finalidade, destinatario, mime, tamanho, enviado_em, arquivo_excluido_em, deleted_at";

/**
 * Documentos do paciente (ou só os de uma evolução) e o espaço da conta.
 * Sem a migration 0041 aplicada, volta vazio (a tela abre sem a seção).
 */
export async function carregarDocumentos(
  supabase: SupabaseClient,
  pacienteId: string,
  evolucaoId?: string,
): Promise<{ docs: Documento[]; espaco: { usado: number; cota: number } | null; disponivel: boolean }> {
  let q = supabase
    .from("documentos")
    .select(COLUNAS)
    .eq("paciente_id", pacienteId)
    .not("enviado_em", "is", null)
    // Excluído some da tela (a linha fica no banco, invisível).
    .is("arquivo_excluido_em", null)
    .order("data_documento", { ascending: false })
    .order("created_at", { ascending: false });
  if (evolucaoId) q = q.eq("evolucao_id", evolucaoId);
  const [{ data, error }, { data: esp }] = await Promise.all([q, supabase.rpc("documentos_espaco")]);
  const linha = (esp as { usado: number; cota: number }[] | null)?.[0];
  return {
    docs: (data ?? []) as Documento[],
    espaco: linha ? { usado: Number(linha.usado), cota: Number(linha.cota) } : null,
    disponivel: !error,
  };
}

type Props = {
  pacienteId: string;
  docs: Documento[];
  espaco: { usado: number; cota: number } | null;
  /** Página para onde voltar depois de arquivar. */
  voltar: string;
  evolucaoId?: string;
  /** Datas das evoluções (id → AAAA-MM-DD), para o link "Sessão de DD/MM" na ficha. */
  sessoes?: Map<string, string>;
  podeEscrever: boolean;
};

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export function DocumentosLista({ pacienteId, docs, espaco, voltar, evolucaoId, sessoes, podeEscrever }: Props) {
  const ativos = docs;
  const perto = espaco && espaco.usado >= espaco.cota * 0.8;

  return (
    <div className="flex flex-col gap-3">
      {ativos.length === 0 ? (
        <p className="text-sm text-slate-500">
          {evolucaoId ? "Nenhum documento anexado a esta sessão." : "Nenhum documento anexado."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {ativos.map((d) => (
            <Item key={d.id} d={d} pacienteId={pacienteId} voltar={voltar} sessao={!evolucaoId && d.evolucao_id ? sessoes?.get(d.evolucao_id) : undefined} podeEscrever={podeEscrever} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {podeEscrever ? <AnexarDocumento pacienteId={pacienteId} evolucaoId={evolucaoId} /> : <span />}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {espaco && (
            <span className={perto ? "font-medium text-amber-700" : ""}>
              Espaço da conta: {formatarTamanho(espaco.usado)} de {formatarTamanho(espaco.cota)}
              {perto && " — perto do limite"}
            </span>
          )}
          {!evolucaoId && docs.length > 0 && (
            <a href={`/api/pacientes/${pacienteId}/documentos`} className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-800">
              <Download className="size-3.5" aria-hidden />
              Baixar todos (ZIP)
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Item({
  d,
  pacienteId,
  voltar,
  sessao,
  podeEscrever,
}: {
  d: Documento;
  pacienteId: string;
  voltar: string;
  sessao?: string;
  podeEscrever: boolean;
}) {
  const Icone = d.mime.startsWith("image/") ? FileImage : FileText;
  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <a
          href={`/api/documentos/${d.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-2 font-medium text-teal-800 hover:opacity-80"
        >
          <Icone className="size-4 shrink-0" aria-hidden />
          <span className="break-words">{d.nome}</span>
        </a>
        <span className="text-xs text-slate-500">
          {TIPOS_DOCUMENTO[d.tipo]} · {dm(d.data_documento)} · {formatarTamanho(d.tamanho)}
          {sessao && (
            <>
              {" · "}
              <Link href={`/pacientes/${pacienteId}/evolucoes/${d.evolucao_id}`} className="text-teal-700 hover:text-teal-800">
                Sessão de {dm(sessao).slice(0, 5)}
              </Link>
            </>
          )}
        </span>
      </div>
      {(d.finalidade || d.destinatario) && (
        <p className="text-xs text-slate-600">
          {d.finalidade && <>Finalidade: {d.finalidade}</>}
          {d.finalidade && d.destinatario && " · "}
          {d.destinatario && <>Destinatário: {d.destinatario}</>}
        </p>
      )}
      {podeEscrever && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-slate-500">Editar ou excluir</summary>
          <div className="mt-2 flex flex-col gap-3 rounded-lg border border-slate-200 p-3">
            <EditarDocumento doc={d} />
            <ExcluirArquivo d={d} voltar={voltar} />
          </div>
        </details>
      )}
    </li>
  );
}

/** Exclui o documento da tela e o arquivo do Storage (libera espaço). */
function ExcluirArquivo({ d, voltar }: { d: Documento; voltar: string }) {
  return (
    <form action={excluirArquivoDocumento.bind(null, d.id, voltar)} className="flex flex-col gap-2 border-t border-slate-100 pt-3">
      <p className="text-xs text-slate-600">
        Excluir tira o documento do Gradatim e libera {formatarTamanho(d.tamanho)} de espaço.{" "}
        <strong>Baixe o arquivo antes</strong>: a Resolução CFP 01/2009 pede guardar o registro por 5 anos, e a
        guarda deste arquivo passa a ser sua.
      </p>
      <a href={`/api/documentos/${d.id}`} target="_blank" rel="noopener noreferrer" className="w-fit text-xs font-medium text-teal-700 hover:text-teal-800">
        <Download className="mr-1 inline size-3.5" aria-hidden />
        Baixar o arquivo
      </a>
      <label className="flex items-start gap-2 text-xs text-slate-700">
        <input type="checkbox" name="confirmo" required className="mt-0.5" />
        Já baixei o arquivo e entendo que ele será excluído do Gradatim.
      </label>
      <button className="btn btn-outline btn-sm w-fit border-red-200 text-red-700 hover:bg-red-50">
        <Trash2 className="size-4" aria-hidden />
        Excluir arquivo
      </button>
    </form>
  );
}
