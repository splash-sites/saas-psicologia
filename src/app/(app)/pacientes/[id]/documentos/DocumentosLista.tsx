import Link from "next/link";
import { Archive, Download, FileImage, FileText, FileX, Trash2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIPOS_DOCUMENTO, formatarTamanho, type Documento } from "@/lib/documentos/tipos";
import { AnexarDocumento } from "./AnexarDocumento";
import { EditarDocumento } from "./EditarDocumento";
import { arquivarDocumento, excluirArquivoDocumento } from "./actions";

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
  const ativos = docs.filter((d) => !d.deleted_at);
  const arquivados = docs.filter((d) => d.deleted_at);
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

      {arquivados.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500">Arquivados ({arquivados.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 pl-4">
            {arquivados.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 text-slate-500">
                <span>
                  {d.arquivo_excluido_em ? (
                    d.nome
                  ) : (
                    <a href={`/api/documentos/${d.id}`} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
                      {d.nome}
                    </a>
                  )}{" "}
                  · {TIPOS_DOCUMENTO[d.tipo]} · {dm(d.data_documento)} · arquivado em {dm(d.deleted_at!.slice(0, 10))}
                  {d.arquivo_excluido_em && ` · arquivo excluído em ${dm(d.arquivo_excluido_em.slice(0, 10))}`}
                </span>
                {podeEscrever && !d.arquivo_excluido_em && (
                  <details>
                    <summary className="cursor-pointer text-xs">Excluir arquivo</summary>
                    <ExcluirArquivo d={d} voltar={voltar} />
                  </details>
                )}
              </li>
            ))}
          </ul>
        </details>
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
          {!evolucaoId && docs.some((d) => !d.arquivo_excluido_em) && (
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
  const Icone = d.arquivo_excluido_em ? FileX : d.mime.startsWith("image/") ? FileImage : FileText;
  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {d.arquivo_excluido_em ? (
          <span className="inline-flex min-w-0 items-center gap-2 font-medium text-slate-500">
            <Icone className="size-4 shrink-0" aria-hidden />
            <span className="break-words">{d.nome}</span>
          </span>
        ) : (
          <a
            href={`/api/documentos/${d.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-2 font-medium text-teal-800 hover:opacity-80"
          >
            <Icone className="size-4 shrink-0" aria-hidden />
            <span className="break-words">{d.nome}</span>
          </a>
        )}
        <span className="text-xs text-slate-500">
          {TIPOS_DOCUMENTO[d.tipo]} · {dm(d.data_documento)}
          {d.arquivo_excluido_em ? ` · arquivo excluído em ${dm(d.arquivo_excluido_em.slice(0, 10))}` : ` · ${formatarTamanho(d.tamanho)}`}
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
          <summary className="cursor-pointer text-xs text-slate-500">
            {d.arquivo_excluido_em ? "Editar ou arquivar" : "Editar, arquivar ou excluir arquivo"}
          </summary>
          <div className="mt-2 flex flex-col gap-3 rounded-lg border border-slate-200 p-3">
            <EditarDocumento doc={d} />
            <form action={arquivarDocumento.bind(null, d.id, voltar)} className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs text-slate-500">
                Arquivar tira o documento da lista. Ele continua guardado (guarda de 5 anos) e aparece em &ldquo;Arquivados&rdquo;.
              </p>
              <button className="btn btn-outline btn-sm">
                <Archive className="size-4" aria-hidden />
                Arquivar documento
              </button>
            </form>
            {!d.arquivo_excluido_em && <ExcluirArquivo d={d} voltar={voltar} />}
          </div>
        </details>
      )}
    </li>
  );
}

/** Apaga só o arquivo (libera espaço); os dados do documento ficam no prontuário. */
function ExcluirArquivo({ d, voltar }: { d: Documento; voltar: string }) {
  return (
    <form action={excluirArquivoDocumento.bind(null, d.id, voltar)} className="flex flex-col gap-2 border-t border-slate-100 pt-3">
      <p className="text-xs text-slate-600">
        Excluir apaga o arquivo do Gradatim e libera {formatarTamanho(d.tamanho)} de espaço. Nome, tipo, data,
        finalidade e destinatário continuam no prontuário. <strong>Baixe o arquivo antes</strong>: a Resolução CFP
        01/2009 pede guardar o registro por 5 anos, e a guarda deste arquivo passa a ser sua.
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
