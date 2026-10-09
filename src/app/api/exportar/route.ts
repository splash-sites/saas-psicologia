import { NextResponse } from "next/server";
import { strToU8, zipSync } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { gerarCsv, type Coluna } from "@/lib/exportacao/csv";
import { dataBRCompleta, dataHoraBR } from "@/lib/exportacao/datas";

// Exportação de TODOS os dados da conta (portabilidade/LGPD e guarda de 5 anos
// do prontuário): um ZIP com um CSV por tabela. Usa o client da própria
// psicóloga, então o RLS garante que só sai o que é dela. Inclui registros
// arquivados (soft delete) e as notas privadas — decisão do produto: o arquivo
// é da própria psicóloga. Funciona também em modo somente leitura (inadimplente).

type Linha = Record<string, unknown>;

// O PostgREST devolve no máximo 1000 linhas por consulta (max_rows): pagina.
const PAGINA = 1000;

async function todas(
  supabase: SupabaseClient,
  tabela: string,
  ordem: string,
): Promise<Linha[]> {
  const linhas: Linha[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from(tabela)
      .select("*")
      .order(ordem)
      .order("id")
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(`falha ao ler ${tabela}`);
    linhas.push(...(data as Linha[]));
    if (data.length < PAGINA) return linhas;
  }
}

const txt = (campo: string) => (l: Linha) => (l[campo] as string | null) ?? null;
const data = (campo: string) => (l: Linha) => dataBRCompleta(l[campo] as string | null);
const dataHora = (campo: string) => (l: Linha) => dataHoraBR(l[campo] as string | null);

const LEIA_ME = `Exportação completa da sua conta.

Cada arquivo .csv abre direto no Excel ou no Google Planilhas (separador ";").
Os arquivos se ligam pela coluna "ID do paciente" / "ID da consulta".

- pacientes.csv     cadastro dos pacientes
- anamneses.csv     ficha de avaliação inicial
- consultas.csv     agenda (inclui canceladas)
- evolucoes.csv     prontuário: evoluções por sessão, com notas privadas
- pagamentos.csv    lançamentos financeiros
- bloqueios.csv     horários bloqueados

Registros arquivados também estão aqui (coluna "Arquivado em").
O prontuário deve ser guardado por no mínimo 5 anos (Resolução CFP 01/2009).
Guarde este arquivo em local seguro: ele contém dados de saúde (LGPD).
`;

export async function GET() {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  let tabelas: Record<string, Linha[]>;
  try {
    const [pacientes, anamneses, consultas, evolucoes, pagamentos, bloqueios] =
      await Promise.all([
        todas(supabase, "pacientes", "nome"),
        todas(supabase, "anamneses", "created_at"),
        todas(supabase, "consultas", "inicio"),
        todas(supabase, "evolucoes", "data_sessao"),
        todas(supabase, "pagamentos", "data_referencia"),
        todas(supabase, "bloqueios", "inicio"),
      ]);
    tabelas = { pacientes, anamneses, consultas, evolucoes, pagamentos, bloqueios };
  } catch {
    return NextResponse.json({ error: "não foi possível exportar agora" }, { status: 500 });
  }

  const nomes = new Map(tabelas.pacientes.map((p) => [p.id as string, p.nome as string]));
  const paciente = (l: Linha) => nomes.get(l.paciente_id as string) ?? null;

  const colunas: Record<string, Coluna<Linha>[]> = {
    pacientes: [
      { titulo: "ID do paciente", valor: txt("id") },
      { titulo: "Nome", valor: txt("nome") },
      { titulo: "E-mail", valor: txt("email") },
      { titulo: "Telefone", valor: txt("telefone") },
      { titulo: "Data de nascimento", valor: data("data_nascimento") },
      { titulo: "CPF", valor: txt("cpf") },
      { titulo: "Endereço", valor: txt("endereco") },
      { titulo: "Status", valor: txt("status") },
      { titulo: "Aceita lembretes", valor: (l) => l.aceita_lembretes as boolean },
      { titulo: "Observações", valor: txt("observacoes") },
      { titulo: "Cadastrado em", valor: dataHora("created_at") },
      { titulo: "Arquivado em", valor: dataHora("deleted_at") },
    ],
    anamneses: [
      { titulo: "ID do paciente", valor: txt("paciente_id") },
      { titulo: "Paciente", valor: paciente },
      { titulo: "Demanda / queixa inicial", valor: txt("demanda") },
      { titulo: "Objetivos do trabalho", valor: txt("objetivos") },
      { titulo: "Histórico relevante", valor: txt("historico") },
      { titulo: "Atualizada em", valor: dataHora("updated_at") },
    ],
    consultas: [
      { titulo: "ID da consulta", valor: txt("id") },
      { titulo: "ID do paciente", valor: txt("paciente_id") },
      { titulo: "Paciente", valor: paciente },
      { titulo: "Início", valor: dataHora("inicio") },
      { titulo: "Fim", valor: dataHora("fim") },
      { titulo: "Modalidade", valor: txt("modalidade") },
      { titulo: "Status", valor: txt("status") },
      { titulo: "Recorrência", valor: txt("recorrencia") },
      { titulo: "Paciente confirmou em", valor: dataHora("confirmada_em") },
      { titulo: "Link do Meet", valor: txt("meet_link") },
      { titulo: "Observações", valor: txt("observacoes") },
      { titulo: "Arquivada em", valor: dataHora("deleted_at") },
    ],
    evolucoes: [
      { titulo: "ID do paciente", valor: txt("paciente_id") },
      { titulo: "Paciente", valor: paciente },
      { titulo: "Data da sessão", valor: data("data_sessao") },
      { titulo: "ID da consulta", valor: txt("consulta_id") },
      { titulo: "Avaliação da demanda / objetivos", valor: txt("demanda") },
      { titulo: "Procedimentos aplicados", valor: txt("procedimentos") },
      { titulo: "Resultados obtidos", valor: txt("resultados") },
      { titulo: "Encaminhamentos / decisões", valor: txt("encaminhamentos") },
      { titulo: "Notas privadas", valor: txt("notas_privadas") },
      { titulo: "Registrada em", valor: dataHora("created_at") },
      { titulo: "Última edição", valor: dataHora("updated_at") },
      { titulo: "Arquivada em", valor: dataHora("deleted_at") },
      { titulo: "Motivo do arquivamento", valor: txt("deleted_motivo") },
    ],
    pagamentos: [
      { titulo: "ID do paciente", valor: txt("paciente_id") },
      { titulo: "Paciente", valor: paciente },
      { titulo: "ID da consulta", valor: txt("consulta_id") },
      { titulo: "Valor (R$)", valor: (l) => Number(l.valor) },
      { titulo: "Status", valor: txt("status") },
      { titulo: "Referência", valor: data("data_referencia") },
      { titulo: "Vencimento", valor: data("vencimento") },
      { titulo: "Pago em", valor: data("data_pagamento") },
      { titulo: "Forma de pagamento", valor: txt("forma_pagamento") },
      { titulo: "Observações", valor: txt("observacoes") },
      { titulo: "Arquivado em", valor: dataHora("deleted_at") },
    ],
    bloqueios: [
      { titulo: "Início", valor: dataHora("inicio") },
      { titulo: "Fim", valor: dataHora("fim") },
      { titulo: "Motivo", valor: txt("motivo") },
    ],
  };

  const arquivos: Record<string, Uint8Array> = { "LEIA-ME.txt": strToU8(LEIA_ME) };
  for (const [nome, cols] of Object.entries(colunas)) {
    arquivos[`${nome}.csv`] = strToU8(gerarCsv(cols, tabelas[nome]));
  }
  const zip = zipSync(arquivos, { level: 6 });

  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new Response(new Blob([zip as BlobPart], { type: "application/zip" }), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="prontuarios-${hoje}.zip"`,
      // Dado de saúde: nunca em cache de navegador/CDN.
      "Cache-Control": "no-store",
    },
  });
}
