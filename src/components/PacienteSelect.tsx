"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { EVENTO_CAMPO_VALIDO } from "@/lib/form/validacao";

type Opcao = { id: string; nome: string };

// Sem acento e minúsculo: "joao" acha "João".
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Campo de paciente com busca (combobox): clicar mostra a lista inteira,
 * digitar filtra na hora; setas + Enter escolhem, Esc fecha. O valor vai no
 * formulário por um <input type="hidden" name="paciente_id">.
 *
 * Obrigatório: sem paciente escolhido, o campo visível fica inválido
 * (setCustomValidity) e o navegador barra o envio com a mensagem — texto
 * digitado que não virou escolha não conta.
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
  const idCampo = useId();
  const idLista = useId();
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [interno, setInterno] = useState(defaultValue);
  const atual = value ?? interno;
  const nomeAtual = pacientes.find((p) => p.id === atual)?.nome ?? "";

  const [aberto, setAberto] = useState(false);
  // null = não está digitando: o campo mostra o nome do escolhido.
  const [texto, setTexto] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(0);

  const termo = normalizar((texto ?? "").trim());
  const opcoes = useMemo(
    () => (termo ? pacientes.filter((p) => normalizar(p.nome).includes(termo)) : pacientes),
    [pacientes, termo],
  );

  function escolher(id: string) {
    if (value === undefined) setInterno(id);
    onChange?.(id);
    setTexto(null);
    setAberto(false);
  }

  function abrir() {
    setAberto(true);
    const i = opcoes.findIndex((p) => p.id === atual);
    setAtivo(i >= 0 ? i : 0);
  }

  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.setCustomValidity(required && !atual ? "Escolha um paciente da lista." : "");
    // Escolher pela lista não dispara digitação: avisa o formulário que o
    // campo ficou válido, para o erro embaixo dele sumir.
    if (atual) el.dispatchEvent(new Event(EVENTO_CAMPO_VALIDO, { bubbles: true }));
  }, [required, atual]);

  useEffect(() => {
    if (!aberto) return;
    lista.current?.querySelector<HTMLElement>(`[data-indice="${ativo}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [aberto, ativo]);

  const idOpcao = (i: number) => `${idLista}-${i}`;

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={idCampo}>{rotulo}</label>
      <div className="relative">
        <input
          ref={campo}
          id={idCampo}
          type="text"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={aberto && opcoes.length ? idOpcao(ativo) : undefined}
          value={texto ?? nomeAtual}
          placeholder="Digite ou clique para escolher"
          autoComplete="off"
          className="input pr-10"
          data-sensivel
          data-campo={name}
          onClick={() => (aberto ? null : abrir())}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setTexto(e.target.value);
            setAtivo(0);
            setAberto(true);
            // Mexeu no texto: a escolha anterior deixa de valer.
            if (atual) {
              if (value === undefined) setInterno("");
              onChange?.("");
            }
          }}
          onBlur={() => {
            setAberto(false);
            setTexto(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!aberto) return abrir();
              const passo = e.key === "ArrowDown" ? 1 : -1;
              setAtivo((i) => Math.min(Math.max(i + passo, 0), Math.max(opcoes.length - 1, 0)));
            } else if (e.key === "Enter" && aberto) {
              // Enter na lista escolhe; não envia o formulário.
              e.preventDefault();
              if (opcoes[ativo]) escolher(opcoes[ativo].id);
            } else if (e.key === "Escape" && aberto) {
              e.preventDefault();
              setAberto(false);
              setTexto(null);
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={aberto ? "Fechar lista de pacientes" : "Abrir lista de pacientes"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500"
          onMouseDown={(e) => {
            // Mantém o foco no campo (o blur fecharia a lista antes do clique).
            e.preventDefault();
            campo.current?.focus();
            if (aberto) setAberto(false);
            else abrir();
          }}
        >
          <ChevronDown className="size-4" aria-hidden />
        </button>

        {aberto && (
          <ul
            ref={lista}
            id={idLista}
            role="listbox"
            aria-label="Pacientes"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {opcoes.length === 0 ? (
              <li className="px-3 py-2 text-slate-500">Nenhum paciente com esse nome</li>
            ) : (
              opcoes.map((p, i) => (
                <li
                  key={p.id}
                  id={idOpcao(i)}
                  data-indice={i}
                  role="option"
                  aria-selected={p.id === atual}
                  className={`cursor-pointer px-3 py-2 ${i === ativo ? "bg-teal-50 text-teal-900" : ""} ${
                    p.id === atual ? "font-medium" : ""
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => escolher(p.id)}
                >
                  <span data-sensivel>{p.nome}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <input type="hidden" name={name} value={atual} />
    </div>
  );
}
