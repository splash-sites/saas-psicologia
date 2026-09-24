// Mensagem do lembrete de consulta. Puro (sem dependência de servidor) para
// poder ser usado também no preview do formulário de configurações.
// Nada clínico entra aqui: só nome, data, hora, modalidade e link da chamada.

export const TEMPLATE_PADRAO =
  "Olá, {nome}! Lembrete da sua consulta em {data} às {hora} ({modalidade}). {link} Se precisar remarcar, é só me avisar.";

export const VARIAVEIS_TEMPLATE = [
  { nome: "{nome}", descricao: "primeiro nome do paciente" },
  { nome: "{data}", descricao: "data da consulta (dd/mm)" },
  { nome: "{hora}", descricao: "horário de início" },
  { nome: "{modalidade}", descricao: "online ou presencial" },
  { nome: "{link}", descricao: "link do Meet (só em consultas online)" },
] as const;

export type VariaveisLembrete = {
  nome: string;
  data: string;
  hora: string;
  modalidade: string;
  link?: string | null;
};

export function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? nomeCompleto;
}

/** Substitui as variáveis conhecidas e limpa espaços duplos (ex.: sem {link}). */
export function renderizarLembrete(
  template: string | null | undefined,
  vars: VariaveisLembrete,
): string {
  const base = template && template.trim() !== "" ? template : TEMPLATE_PADRAO;
  const mapa: Record<string, string> = {
    nome: primeiroNome(vars.nome),
    data: vars.data,
    hora: vars.hora,
    modalidade: vars.modalidade,
    link: vars.link ?? "",
  };
  return base
    .replace(/\{(\w+)\}/g, (inteiro, chave: string) =>
      chave in mapa ? mapa[chave] : inteiro,
    )
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
