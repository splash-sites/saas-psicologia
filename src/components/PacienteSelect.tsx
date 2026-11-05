"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";

type Opcao = { id: string; nome: string };

/** A partir de quantos pacientes aparece o campo de filtrar. */
export const LIMIAR_FILTRO_PACIENTES = 10;

// Sem acento e minúsculo: "joao" acha "João".
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * <select> de paciente com um campo para filtrar por nome quando a lista é
 * longa. Continua sendo um <select name="paciente_id"> de verdade (envio do
 * formulário, teclado e leitor de tela iguais), só com menos opções.
 *
 * O paciente já escolhido nunca some da lista por causa do filtro: o
 * navegador trocaria o valor do <select> sem avisar.
 */
export function PacienteSelect({
  pacientes,
  value,
  defaultValue = "",
  onChange,
  name = "paciente_id",
  required = true,
  rotulo = "Paciente *",
}: {
  pacientes: Opcao[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  name?: string;
  required?: boolean;
  rotulo?: string;
}) {
  const id = useId();
  const [filtro, setFiltro] = useState("");
  const [interno, setInterno] = useState(defaultValue);
  const atual = value ?? interno;

  function escolher(novo: string) {
    if (value === undefined) setInterno(novo);
    onChange?.(novo);
  }

  const termo = normalizar(filtro.trim());
  const visiveis = useMemo(
    () => (termo ? pacientes.filter((p) => p.id === atual || normalizar(p.nome).includes(termo)) : pacientes),
    [pacientes, termo, atual],
  );
  const encontrados = visiveis.filter((p) => p.id !== atual || normalizar(p.nome).includes(termo));

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id}>{rotulo}</label>
      {pacientes.length > LIMIAR_FILTRO_PACIENTES && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            onKeyDown={(e) => {
              // Enter aqui não envia o formulário; com um nome só, já escolhe.
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (termo && encontrados.length === 1) escolher(encontrados[0].id);
            }}
            placeholder="Digite para filtrar pelo nome"
            aria-label="Filtrar pacientes pelo nome"
            aria-controls={id}
            autoComplete="off"
            className="input pl-9"
          />
        </div>
      )}
      <select
        id={id}
        name={name}
        required={required}
        value={atual}
        onChange={(e) => escolher(e.target.value)}
        className="input"
      >
        <option value="">
          {termo && encontrados.length === 0 ? "Nenhum paciente com esse nome" : "Selecione..."}
        </option>
        {visiveis.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
      {termo && encontrados.length > 0 && (
        <span className="text-xs text-slate-500" role="status">
          {encontrados.length === 1
            ? "1 paciente encontrado (Enter escolhe)"
            : `${encontrados.length} pacientes encontrados`}
        </span>
      )}
    </div>
  );
}
