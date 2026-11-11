"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  SITUACAO_CONTA_LABEL,
  SITUACAO_CONTA_TOM,
  SITUACOES_CONTA,
  usouRecentemente,
  type SituacaoConta,
  type UsuarioAdmin,
} from "@/lib/admin/usuarios";

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function dataBR(iso: string | null): string {
  return iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
}

// Busca por nome/e-mail e filtro de situação no navegador: a lista já veio
// inteira do servidor.
export function ListaUsuarios({
  usuarios,
  situacaoInicial,
}: {
  usuarios: UsuarioAdmin[];
  situacaoInicial: SituacaoConta | "todas";
}) {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<SituacaoConta | "todas">(situacaoInicial);
  const agora = useMemo(() => new Date(), []);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return usuarios.filter(
      (u) =>
        (situacao === "todas" || u.situacao === situacao) &&
        (!termo || normalizar(`${u.nome ?? ""} ${u.email ?? ""}`).includes(termo)),
    );
  }, [usuarios, busca, situacao]);

  const contagem = (s: SituacaoConta) => usuarios.filter((u) => u.situacao === s).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar por nome ou e-mail</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            autoComplete="off"
            className="input pl-9"
          />
        </label>
        <label className="sm:w-64">
          <span className="sr-only">Filtrar por situação</span>
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value as SituacaoConta | "todas")}
            className="input"
          >
            <option value="todas">Todas ({usuarios.length})</option>
            {SITUACOES_CONTA.map((s) => (
              <option key={s} value={s}>
                {SITUACAO_CONTA_LABEL[s]} ({contagem(s)})
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-slate-500" role="status">
          Nenhuma conta encontrada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">Conta</th>
                <th className="px-4 py-2">Situação</th>
                <th className="px-4 py-2">Cadastro</th>
                <th className="px-4 py-2">Fim do teste</th>
                <th className="px-4 py-2">Pagando</th>
                <th className="px-4 py-2">Usou (30 dias)</th>
                <th className="px-4 py-2 text-right">Pacientes</th>
                <th className="px-4 py-2 text-right">Consultas</th>
                <th className="px-4 py-2 text-right">Evoluções</th>
                <th className="px-4 py-2">Cupom</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtrados.map((u) => {
                const usou = usouRecentemente(u.ultima_atividade, agora);
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Link href={`/admin/usuarios/${u.id}`} className="flex flex-col hover:underline">
                        <span className="font-medium text-slate-900" data-sensivel>
                          {u.nome ?? "—"}
                        </span>
                        <span className="text-xs text-slate-500" data-sensivel>
                          {u.email ?? "—"}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${SITUACAO_CONTA_TOM[u.situacao]}`}
                      >
                        {SITUACAO_CONTA_LABEL[u.situacao]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{dataBR(u.cadastro)}</td>
                    <td className="px-4 py-2 text-slate-600">{dataBR(u.trial_fim)}</td>
                    <td className="px-4 py-2">{u.situacao === "pagando" ? "Sim" : "Não"}</td>
                    <td className="px-4 py-2">
                      {usou ? "Sim" : "Não"}
                      {u.ultima_atividade && (
                        <span className="block text-xs text-slate-500">última {dataBR(u.ultima_atividade)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{u.pacientes}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{u.consultas}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{u.evolucoes}</td>
                    <td className="px-4 py-2 text-slate-600">{u.cupom ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {usuarios.length >= 1000 && (
        <p className="text-xs text-slate-500">Mostrando as 1.000 contas mais recentes.</p>
      )}
    </div>
  );
}
