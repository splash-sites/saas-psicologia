"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { hojeBR } from "@/lib/agenda/datas";
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABEL } from "@/lib/financeiro/types";
import { desfazerBaixaEmLote, registrarPagamentoConsulta } from "../financeiro/actions";

/**
 * Linha "Pagamento" do painel da consulta (2026-11-26, decisão do usuário):
 * o resumo vem do servidor; o botão ("Registrar pagamento adiantado" na
 * sessão futura, "Dar baixa" na cobrança em aberto) abre "Pago em" e a forma
 * ali mesmo. Depois aparece "Pagamento registrado · Desfazer". Fica montado
 * entre as atualizações da página (key = consulta), então o aviso não some
 * quando o resumo passa para "Pago em…".
 */
export function PagamentoDaConsulta({
  consultaId,
  resumo,
  acao,
}: {
  consultaId: string;
  resumo: React.ReactNode;
  /** Rótulo do botão; null = sem ação (pago, cancelada, sem valor…). */
  acao: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hojeBR());
  const [forma, setForma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ desfazer: { id: string; forma: string | null }[]; data: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    setErro(null);
    iniciar(async () => {
      const r = await registrarPagamentoConsulta(consultaId, data, forma);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setAberto(false);
      setAviso({ desfazer: r.desfazer, data: r.data });
    });
  }

  function desfazer() {
    if (!aviso) return;
    const a = aviso;
    iniciar(async () => {
      await desfazerBaixaEmLote(a.desfazer, a.data);
      setAviso(null);
    });
  }

  return (
    <span className="flex flex-col gap-2">
      <span>{resumo}</span>

      {aviso && (
        <span role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#BFE6D6] bg-[#ECF8F3] px-2.5 py-1.5 text-xs font-semibold text-[#0B5A54]">
          <span className="flex items-center gap-1.5">
            <Check className="size-3.5" aria-hidden />
            Pagamento registrado.
          </span>
          <button
            type="button"
            onClick={desfazer}
            disabled={pendente}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[#BFE6D6] bg-white px-2 text-xs font-semibold hover:bg-[#F2FAF8]"
          >
            <RotateCcw className="size-3" aria-hidden />
            Desfazer
          </button>
        </span>
      )}

      {acao && !aviso && !aberto && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="w-fit rounded-lg border border-[#B9E0D8] bg-[#DCF0EC] px-3 py-1.5 text-[13px] font-semibold text-[#0B3F3A] hover:bg-[#CDEAE4]"
        >
          {acao}
        </button>
      )}

      {acao && aberto && (
        <span className="flex flex-col gap-2 font-normal">
          <span className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Pago em
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} required className="input" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Forma
              <select value={forma} onChange={(e) => setForma(e.target.value)} className="input">
                <option value="">Não informada</option>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f} value={f}>
                    {FORMA_PAGAMENTO_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>
          </span>
          <span className="flex gap-2">
            <button type="button" onClick={() => setAberto(false)} className="btn btn-outline btn-sm">
              Cancelar
            </button>
            <button type="button" onClick={confirmar} disabled={pendente || !data} className="btn btn-primary btn-sm">
              {pendente ? "Salvando…" : "Confirmar"}
            </button>
          </span>
          {erro && (
            <span className="text-xs text-red-700" role="alert">
              {erro}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
