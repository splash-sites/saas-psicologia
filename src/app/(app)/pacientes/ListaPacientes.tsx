"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  PACIENTE_STATUS,
  PACIENTE_STATUS_LABEL,
  type Paciente,
  type PacienteStatus,
} from "@/lib/pacientes/types";
import { formatarTelefoneBR } from "@/lib/pacientes/formatacao";
import { StatusBadge } from "./StatusBadge";

type Item = Pick<Paciente, "id" | "nome" | "telefone" | "status">;

// Sem acento e minúsculo: "jose" acha "José".
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Busca e filtro no navegador: a lista já veio inteira do servidor (psicóloga
// autônoma tem centenas de pacientes, não milhares), então filtrar aqui é
// instantâneo e não faz nenhuma requisição a mais.
export function ListaPacientes({ pacientes }: { pacientes: Item[] }) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<PacienteStatus | "todos">("todos");

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    const digitos = busca.replace(/\D/g, "");
    return pacientes.filter((p) => {
      if (status !== "todos" && p.status !== status) return false;
      if (!termo) return true;
      if (normalizar(p.nome).includes(termo)) return true;
      return digitos.length >= 3 && (p.telefone ?? "").includes(digitos);
    });
  }, [pacientes, busca, status]);

  const contagem = (s: PacienteStatus) => pacientes.filter((p) => p.status === s).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar paciente</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            autoComplete="off"
            className="input pl-9"
          />
        </label>
        <label className="sm:w-48">
          <span className="sr-only">Filtrar por status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PacienteStatus | "todos")}
            className="input"
          >
            <option value="todos">Todos ({pacientes.length})</option>
            {PACIENTE_STATUS.map((s) => (
              <option key={s} value={s}>
                {PACIENTE_STATUS_LABEL[s]} ({contagem(s)})
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-slate-500" role="status">
          Nenhum paciente encontrado.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {filtrados.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pacientes/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50"
              >
                <span className="flex items-center gap-3">
                  <span className="font-medium" data-sensivel>
                    {p.nome}
                  </span>
                  <StatusBadge status={p.status} />
                </span>
                <span className="text-sm text-slate-500" data-sensivel>
                  {p.telefone ? formatarTelefoneBR(p.telefone) : "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
