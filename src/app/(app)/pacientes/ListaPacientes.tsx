"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, MessageCircle, Plus, Search, Video } from "lucide-react";
import type { Paciente, PacienteStatus } from "@/lib/pacientes/types";
import { whatsappLink } from "@/lib/pacientes/whatsapp";

export type ItemPaciente = Pick<Paciente, "id" | "nome" | "telefone" | "status"> & {
  /** Próxima consulta agendada (0042). */
  proxima: { dia: string; hora: string; online: boolean } | null;
  /** Última sessão já feita, relativa ("ontem", "há 7 dias"). */
  ultima: string | null;
  evolucaoPendente: boolean;
  pagamentoAberto: boolean;
};

type Filtro = "ativos" | "inativos" | "alta" | "todos" | "evolucao" | "pagamento";

const FILTROS: Record<Filtro, (p: ItemPaciente) => boolean> = {
  ativos: (p) => p.status === "ativo",
  inativos: (p) => p.status === "inativo",
  alta: (p) => p.status === "alta",
  todos: () => true,
  evolucao: (p) => p.evolucaoPendente,
  pagamento: (p) => p.pagamentoAberto,
};
const ABAS: [Filtro, string][] = [
  ["ativos", "Ativos"],
  ["inativos", "Inativos"],
  ["alta", "Alta"],
  ["todos", "Todos"],
];
const DESCRICAO: Record<Filtro, string> = {
  ativos: "os pacientes ativos",
  inativos: "os inativos",
  alta: "quem teve alta",
  todos: "todos os pacientes",
  evolucao: "quem tem evolução pendente",
  pagamento: "quem tem pagamento em aberto",
};

// Tons pastel do avatar; o mesmo paciente sempre cai no mesmo tom.
const CORES_AVATAR = [
  "bg-[#DCF0EC] text-[#0B3F3A]",
  "bg-[#FBF2DC] text-[#5C460F]",
  "bg-[#E7E4F6] text-[#3A2F73]",
  "bg-[#FCE6DA] text-[#7A2A0A]",
  "bg-[#E1ECF7] text-[#1E3A5F]",
  "bg-[#FCE7EF] text-[#8A1F4C]",
];
function corAvatar(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CORES_AVATAR[h % CORES_AVATAR.length];
}
function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

const STATUS_ETIQUETA: Partial<Record<PacienteStatus, { rotulo: string; classe: string }>> = {
  inativo: { rotulo: "Inativo", classe: "bg-[#E4E9E8] text-[#3D524D]" },
  alta: { rotulo: "Alta", classe: "bg-[#E1ECF7] text-[#1E3A5F]" },
};
const ETIQUETA_EVOLUCAO = "border-[#EBD49A] bg-[#FBF2DC] text-[#5C460F]";
const ETIQUETA_PAGAMENTO = "border-[#F1C2A8] bg-[#FCE6DA] text-[#7A2A0A]";

// Sem acento e minúsculo: "jose" acha "José".
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Lista de pacientes (redesenho de 2026-11-24, canvas "Main" e "Celular"):
// tabela no computador, linhas compactas no celular. Busca, abas e filtros de
// pendência no navegador: a lista já veio inteira do servidor, sem requisição a
// mais ao filtrar.
export function ListaPacientes({ pacientes }: { pacientes: ItemPaciente[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("ativos");
  const buscaRef = useRef<HTMLInputElement>(null);

  // "/" leva à busca (fora de campos de texto).
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || alvo.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      buscaRef.current?.focus();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    const digitos = busca.replace(/\D/g, "");
    return pacientes.filter((p) => {
      if (!FILTROS[filtro](p)) return false;
      if (!termo) return true;
      if (normalizar(p.nome).includes(termo)) return true;
      return digitos.length >= 3 && (p.telefone ?? "").includes(digitos);
    });
  }, [pacientes, busca, filtro]);

  const conta = (f: Filtro) => pacientes.filter(FILTROS[f]).length;
  const nAtivos = conta("ativos");
  const nInativos = conta("inativos");
  const nAlta = conta("alta");
  const chips: [Filtro, string, string, string][] = [
    ["evolucao", conta("evolucao") === 1 ? "evolução pendente" : "evoluções pendentes", ETIQUETA_EVOLUCAO, "bg-[#C98A0B]"],
    ["pagamento", conta("pagamento") === 1 ? "pagamento em aberto" : "pagamentos em aberto", ETIQUETA_PAGAMENTO, "bg-[#C2410C]"],
  ];

  const resumoStatus = [
    `${nAtivos} ${nAtivos === 1 ? "ativo" : "ativos"}`,
    nInativos > 0 && `${nInativos} ${nInativos === 1 ? "inativo" : "inativos"}`,
    nAlta > 0 && `${nAlta} de alta`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex w-full max-w-[1120px] flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-bold tracking-tight text-[#12302B] sm:text-[28px]">Pacientes</h1>
          <p className="text-[13px] text-[#4A5F5A] sm:text-[15px]">{resumoStatus}</p>
        </div>
        <Link href="/pacientes/novo" className="btn btn-primary hidden md:inline-flex">
          <Plus className="size-4" aria-hidden />
          Novo paciente
        </Link>
      </header>

      {/* Filtros de pendência: clicar filtra, clicar de novo volta aos ativos. */}
      <div className="flex gap-2 overflow-x-auto md:flex-wrap md:gap-2.5">
        {chips.map(([f, rotulo, classeAtivo, corNumero]) => {
          const on = filtro === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(on ? "ativos" : f)}
              aria-pressed={on}
              className={`inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold md:min-h-10 md:rounded-xl md:text-sm ${
                on ? classeAtivo : "border-[#DFEBE7] bg-white text-[#12302B]"
              }`}
            >
              <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs text-white ${corNumero}`}>
                {conta(f)}
              </span>
              {rotulo}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <label className="relative flex flex-1 items-center md:min-w-80">
          <span className="sr-only">Buscar paciente</span>
          <Search className="pointer-events-none absolute left-3.5 size-[18px] text-[#5B6E69]" aria-hidden />
          <input
            ref={buscaRef}
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            autoComplete="off"
            className="h-[46px] w-full rounded-xl border border-[#C9D6D2] bg-white pl-[42px] pr-12 text-base text-[#12302B] md:text-[15px]"
          />
          <kbd className="pointer-events-none absolute right-3 hidden rounded-md border border-[#C9D6D2] bg-[#F4F7F6] px-[7px] py-0.5 text-xs text-[#4A5F5A] md:inline">
            /
          </kbd>
        </label>
        <div role="group" aria-label="Status" className="grid grid-cols-4 gap-0.5 rounded-xl bg-[#E8EFEC] p-1 md:flex">
          {ABAS.map(([f, rotulo]) => {
            const on = filtro === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                aria-pressed={on}
                className={`min-h-[38px] whitespace-nowrap rounded-[9px] px-1 text-[13px] text-[#12302B] md:px-3.5 md:text-sm ${
                  on ? "bg-white font-semibold shadow-[0_1px_2px_rgba(18,48,43,0.12)]" : "font-medium"
                }`}
              >
                {rotulo} <span className="font-medium text-[#4A5F5A]">{conta(f)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Enquanto busca, a área da lista não encolhe abaixo de uma tela: no
          celular, com o teclado aberto, a página encurtando fazia o navegador
          rolar para cima e esconder o campo. */}
      <div className={busca ? "min-h-[100svh]" : undefined}>
        {filtrados.length === 0 ? (
          <p className="text-sm text-[#5B6E69]" role="status">
            Nenhum paciente encontrado.
          </p>
        ) : (
          <>
            <Tabela itens={filtrados} />
            <ListaCelular itens={filtrados} />
            <p className="mt-3 hidden text-[13px] text-[#4A5F5A] md:block">
              Mostrando {filtrados.length} {filtrados.length === 1 ? "paciente" : "pacientes"} ({DESCRICAO[filtro]}).
            </p>
          </>
        )}
      </div>

      <Link
        href="/pacientes/novo"
        aria-label="Novo paciente"
        className="fixed bottom-5 right-4 z-40 flex size-14 items-center justify-center rounded-[18px] bg-[#0F766E] text-white shadow-[0_4px_12px_rgba(18,48,43,0.25)] md:hidden"
      >
        <Plus className="size-6" aria-hidden />
      </Link>
    </div>
  );
}

const COLUNAS = "grid-cols-[minmax(250px,2.2fr)_minmax(160px,1.3fr)_minmax(130px,1fr)_minmax(180px,1.4fr)_104px]";

function Tabela({ itens }: { itens: ItemPaciente[] }) {
  return (
    <section aria-label="Lista de pacientes" className="hidden overflow-hidden rounded-2xl border border-[#DFEBE7] bg-white md:block">
      <div className="overflow-x-auto">
        <div className="min-w-[920px]">
          <div
            className={`grid ${COLUNAS} gap-4 border-b border-[#E6EEEB] bg-[#F7FAF9] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[#4A5F5A]`}
          >
            <span>Paciente</span>
            <span>Próxima sessão</span>
            <span>Última sessão</span>
            <span>Pendências</span>
            <span className="text-right">Ações</span>
          </div>
          {itens.map((p) => (
            <div key={p.id} className={`grid ${COLUNAS} items-center gap-4 border-t border-[#EEF3F1] px-5 py-3.5 first:border-t-0`}>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar p={p} tamanho="size-10" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Link
                      href={`/pacientes/${p.id}`}
                      className="truncate text-[15px] font-semibold text-[#12302B] hover:text-[#0F766E]"
                      data-sensivel
                    >
                      {p.nome}
                    </Link>
                    <EtiquetaStatus status={p.status} />
                  </span>
                  {!p.telefone && (
                    <Link href={`/pacientes/${p.id}/editar`} className="text-[13px] font-medium text-[#0F766E] hover:text-[#12302B]">
                      Adicionar telefone
                    </Link>
                  )}
                </div>
              </div>

              <div>
                {p.proxima ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-[#12302B]">{p.proxima.dia}</span>
                    <span className="flex items-center gap-[5px] text-[13px] text-[#4A5F5A]">
                      {p.proxima.hora} ·{p.proxima.online && <Video className="size-3.5" aria-hidden />}
                      {p.proxima.online ? "Online" : "Presencial"}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-[#4A5F5A]">Sem sessão marcada</span>
                    {p.status === "ativo" && (
                      <Link href="/agenda/nova" className="text-[13px] font-medium text-[#0F766E] hover:text-[#12302B]">
                        Agendar
                      </Link>
                    )}
                  </div>
                )}
              </div>

              <span className={`text-sm ${p.ultima ? "text-[#12302B]" : "text-[#5B6E69]"}`}>
                {p.ultima ?? "Ainda não teve sessão"}
              </span>

              <Pendencias p={p} mostrarEmDia />

              <div className="flex justify-end gap-1.5">
                <BotaoWhatsApp p={p} classe="border border-[#DFEBE7] bg-white" />
                <Link
                  href={`/pacientes/${p.id}`}
                  aria-label={`Abrir ficha de ${p.nome}`}
                  className="flex size-11 items-center justify-center rounded-xl border border-[#DFEBE7] bg-white hover:bg-[#F4F7F6]"
                >
                  <ChevronRight className="size-[18px] text-[#12302B]" aria-hidden />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ListaCelular({ itens }: { itens: ItemPaciente[] }) {
  return (
    <ul className="flex flex-col gap-2 pb-20 md:hidden">
      {itens.map((p) => (
        <li key={p.id} className="flex items-center gap-1 rounded-[14px] border border-[#DFEBE7] bg-white py-1 pl-0 pr-1">
          <Link href={`/pacientes/${p.id}`} className="flex min-w-0 flex-1 items-start gap-3 py-2.5 pl-3 pr-1 text-[#12302B]">
            <Avatar p={p} tamanho="size-[42px]" />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[15px] font-bold" data-sensivel>
                  {p.nome}
                </span>
                <EtiquetaStatus status={p.status} pequena />
              </span>
              <span className={`flex items-center gap-[5px] overflow-hidden whitespace-nowrap text-[13px] ${p.proxima ? "text-[#12302B]" : "text-[#4A5F5A]"}`}>
                {p.proxima?.online && <Video className="size-[13px] shrink-0" aria-hidden />}
                <span className="truncate">
                  {p.proxima
                    ? `${p.proxima.dia.split(",")[0] === "Hoje" || p.proxima.dia.startsWith("Amanhã") ? p.proxima.dia.split(",")[0] : p.proxima.dia}, ${p.proxima.hora} · ${p.proxima.online ? "Online" : "Presencial"}`
                    : p.ultima
                      ? `Última sessão ${p.ultima}`
                      : "Ainda não teve sessão"}
                </span>
              </span>
              {(p.evolucaoPendente || p.pagamentoAberto) && (
                <span className="mt-0.5">
                  <Pendencias p={p} pequena />
                </span>
              )}
            </span>
          </Link>
          <BotaoWhatsApp p={p} classe="bg-[#F2FAF8]" />
        </li>
      ))}
    </ul>
  );
}

function Avatar({ p, tamanho }: { p: ItemPaciente; tamanho: string }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full text-sm font-bold ${tamanho} ${corAvatar(p.id)}`}
      data-sensivel
    >
      {iniciais(p.nome)}
    </span>
  );
}

function EtiquetaStatus({ status, pequena }: { status: PacienteStatus; pequena?: boolean }) {
  const e = STATUS_ETIQUETA[status];
  if (!e) return null; // Ativo não mostra nada.
  return (
    <span className={`shrink-0 rounded-full font-semibold ${pequena ? "px-2 py-px text-[11px]" : "px-[9px] py-0.5 text-xs"} ${e.classe}`}>
      {e.rotulo}
    </span>
  );
}

function Pendencias({ p, mostrarEmDia, pequena }: { p: ItemPaciente; mostrarEmDia?: boolean; pequena?: boolean }) {
  const tam = pequena ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-[3px] text-xs";
  if (!p.evolucaoPendente && !p.pagamentoAberto) {
    return mostrarEmDia && p.status === "ativo" ? (
      <span className="inline-flex items-center gap-[5px] text-[13px] text-[#2C6660]">
        <Check className="size-3.5 text-[#0F766E]" aria-hidden />
        Em dia
      </span>
    ) : (
      <span />
    );
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {p.evolucaoPendente && (
        <span className={`whitespace-nowrap rounded-full border font-semibold ${tam} ${ETIQUETA_EVOLUCAO}`}>Evolução pendente</span>
      )}
      {p.pagamentoAberto && (
        <span className={`whitespace-nowrap rounded-full border font-semibold ${tam} ${ETIQUETA_PAGAMENTO}`}>Pagamento em aberto</span>
      )}
    </span>
  );
}

function BotaoWhatsApp({ p, classe }: { p: ItemPaciente; classe: string }) {
  const wa = whatsappLink(p.telefone);
  if (!wa) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${p.nome} não tem telefone cadastrado`}
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl opacity-40 ${classe}`}
      >
        <MessageCircle className="size-5 text-[#0F766E]" aria-hidden />
      </button>
    );
  }
  return (
    <a
      href={wa}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Abrir WhatsApp de ${p.nome}`}
      className={`flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-[#E6F4F1] ${classe}`}
    >
      <MessageCircle className="size-5 text-[#0F766E]" aria-hidden />
    </a>
  );
}
