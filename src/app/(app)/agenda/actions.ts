"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { mensagemErroEscrita } from "@/lib/assinatura/guard";
import { pacientePertenceAPsicologa } from "@/lib/pacientes/dono";
import {
  consultaSchema,
  consultaEdicaoSchema,
  bloqueioSchema,
} from "@/lib/agenda/schema";
import {
  brWallTimeToDate,
  gerarOcorrencias,
  horaBR,
  dataBR,
  segundaDaSemana,
} from "@/lib/agenda/datas";
import { LIMITES } from "@/lib/limites";
import { proximaSessaoDoPaciente, textoLevado } from "@/lib/prontuario/anotacoes";
import { sobrepoe } from "@/lib/agenda/overlap";
import {
  removerEventosDeBloqueios,
  sincronizarBloqueios,
  sincronizarConsulta,
  sincronizarConsultas,
} from "@/lib/agenda/sync";
import { horarioDoBloqueio, intervalosDoBloqueio } from "@/lib/agenda/bloqueios";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Bloqueio: consultas no período, para a psicóloga confirmar o cancelamento. */
  conflitos?: { id: string; quando: string; paciente: string }[];
  /** Bloqueio: outros bloqueios no período (podem se sobrepor; só avisa). */
  sobrepostos?: { id: string; quando: string; motivo: string }[];
};

async function requirePsicologa() {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Conflitos com consultas ativas ou bloqueios da psicóloga, para os slots dados.
async function slotsEmConflito(
  supabase: Awaited<ReturnType<typeof requirePsicologa>>["supabase"],
  slots: { inicio: Date; fim: Date }[],
  ignorarConsultaId?: string,
): Promise<{ inicio: Date; fim: Date }[]> {
  const min = new Date(
    Math.min(...slots.map((s) => s.inicio.getTime())),
  ).toISOString();
  const max = new Date(
    Math.max(...slots.map((s) => s.fim.getTime())),
  ).toISOString();

  const [{ data: consultas }, { data: bloqueios }] = await Promise.all([
    supabase
      .from("consultas")
      .select("id, inicio, fim")
      .neq("status", "cancelada")
      .is("deleted_at", null)
      .lt("inicio", max)
      .gt("fim", min),
    supabase
      .from("bloqueios")
      .select("inicio, fim")
      .lt("inicio", max)
      .gt("fim", min),
  ]);

  const ocupados = [
    ...(consultas ?? []).filter((c) => c.id !== ignorarConsultaId),
    ...(bloqueios ?? []),
  ];

  return slots.filter((s) =>
    ocupados.some((o) => sobrepoe(s.inicio, s.fim, o.inicio, o.fim)),
  );
}

function listaDatas(slots: { inicio: Date }[]): string {
  return slots
    .map((s) => `${dataBR(s.inicio.toISOString())} ${horaBR(s.inicio.toISOString())}`)
    .join(", ");
}

export async function criarConsulta(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requirePsicologa();

  const parsed = consultaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;

  if (!(await pacientePertenceAPsicologa(supabase, v.paciente_id))) {
    return { fieldErrors: { paciente_id: ["Paciente inválido"] } };
  }

  const primeiroInicio = brWallTimeToDate(v.data, v.hora);
  if (Number.isNaN(primeiroInicio.getTime())) {
    return { fieldErrors: { hora: ["Data/hora inválida"] } };
  }

  const slots = gerarOcorrencias(
    primeiroInicio,
    v.duracao_min,
    v.recorrencia,
    v.ocorrencias,
  );

  const conflitos = await slotsEmConflito(supabase, slots);
  if (conflitos.length > 0) {
    return {
      error: `Conflito de horário em: ${listaDatas(conflitos)}. Ajuste o horário ou remova o evento.`,
    };
  }

  const serieId = v.recorrencia === "nenhuma" ? null : randomUUID();
  const linhas = slots.map((s) => ({
    psicologa_id: user.id,
    paciente_id: v.paciente_id,
    inicio: s.inicio.toISOString(),
    fim: s.fim.toISOString(),
    modalidade: v.modalidade,
    recorrencia: v.recorrencia,
    serie_id: serieId,
    observacoes: v.observacoes ?? null,
    valor: v.valor ?? null,
  }));

  const { data: inseridas, error } = await supabase
    .from("consultas")
    .insert(linhas)
    .select("id");
  if (error) {
    if (error.code === "23P01") {
      return { error: "Conflito de horário com outra consulta. Recarregue e tente de novo." };
    }
    return { error: await mensagemErroEscrita(supabase, error, "Não foi possível agendar a consulta.") };
  }

  // Empurra para o Google Calendar (best-effort — não bloqueia o agendamento).
  await sincronizarConsultas(
    supabase,
    user.id,
    (inseridas ?? []).map((r) => r.id),
  );

  revalidatePath("/agenda");
  redirect("/agenda");
}

export async function atualizarConsulta(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requirePsicologa();

  const parsed = consultaEdicaoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;
  const inicio = brWallTimeToDate(v.data, v.hora);
  const fim = new Date(inicio.getTime() + v.duracao_min * 60000);

  if (v.status !== "cancelada") {
    const conflitos = await slotsEmConflito(supabase, [{ inicio, fim }], id);
    if (conflitos.length > 0) {
      return { error: "Conflito de horário com outra consulta ou evento." };
    }
  }

  // Remarcou? A confirmação do paciente era para o horário antigo.
  const { data: atual } = await supabase
    .from("consultas")
    .select("inicio")
    .eq("id", id)
    .maybeSingle();
  const remarcou =
    !atual || new Date(atual.inicio).getTime() !== inicio.getTime();

  // O RLS não dá erro em update de linha alheia/arquivada: só não afeta nada.
  const { data: alterados, error } = await supabase
    .from("consultas")
    .update({
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      modalidade: v.modalidade,
      status: v.status,
      observacoes: v.observacoes ?? null,
      valor: v.valor ?? null,
      cobrar: v.status === "falta" ? v.cobrar : true,
      ...(remarcou ? { confirmada_em: null } : {}),
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    if (error.code === "23P01") {
      return { error: "Conflito de horário com outra consulta." };
    }
    return { error: await mensagemErroEscrita(supabase, error, "Não foi possível atualizar a consulta.") };
  }
  if (!alterados?.length) return { error: "Consulta não encontrada." };

  await sincronizarConsulta(supabase, user.id, id);

  revalidatePath("/agenda");
  revalidatePath(`/agenda/${id}`);
  redirect(`/agenda/${id}`);
}

export async function cancelarConsulta(
  id: string,
  escopo: "esta" | "serie",
  _formData: FormData,
): Promise<void> {
  const { supabase, user } = await requirePsicologa();

  let query = supabase.from("consultas").update({ status: "cancelada" });

  if (escopo === "serie") {
    const { data: alvo } = await supabase
      .from("consultas")
      .select("serie_id")
      .eq("id", id)
      .maybeSingle();
    if (alvo?.serie_id) {
      // Cancela as ocorrências futuras (>= agora) da série; mantém histórico.
      query = query
        .eq("serie_id", alvo.serie_id)
        .gte("inicio", new Date().toISOString());
    } else {
      query = query.eq("id", id);
    }
  } else {
    query = query.eq("id", id);
  }

  const { data: canceladas } = await query.select("id");

  // Remove os eventos correspondentes no Google Calendar (best-effort).
  await sincronizarConsultas(
    supabase,
    user.id,
    (canceladas ?? []).map((r) => r.id),
  );

  revalidatePath("/agenda");
  redirect("/agenda");
}

// Para onde voltar depois de uma ação rápida (painel lateral da agenda ou
// painel inicial). Só caminhos internos conhecidos — nunca um redirect aberto.
function destinoSeguro(voltar: string): string {
  return /^\/(agenda|dashboard)(\/|\?|$)/.test(voltar) && !voltar.includes("//")
    ? voltar
    : "/agenda";
}

/**
 * Marca uma sessão como realizada, falta ou de volta para agendada. Na falta,
 * `cobrar` diz se a sessão é cobrada mesmo assim (o lançamento automático
 * segue a consulta: falta sem cobrança o arquiva, migration 0035).
 */
export async function definirStatusConsulta(
  id: string,
  status: "realizada" | "falta" | "agendada",
  voltar: string,
  cobrarOuForm: boolean | FormData,
  _formData?: FormData,
): Promise<void> {
  const { supabase } = await requirePsicologa();
  if (!["realizada", "falta", "agendada"].includes(status)) redirect("/agenda");
  // Falta sem a escolha explícita não é cobrada.
  const cobrar = status === "falta" ? cobrarOuForm === true : true;

  await supabase
    .from("consultas")
    .update({ status, cobrar })
    .eq("id", id)
    .neq("status", "cancelada")
    .is("deleted_at", null);

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath(`/agenda/${id}`);
  redirect(destinoSeguro(voltar));
}

/**
 * Lista de evoluções pendentes: a sessão já passada não aconteceu (falta ou
 * cancelada) e sai da lista. Só para sessão encerrada e ainda agendada/
 * realizada. Não mexe no Google Agenda: o evento já passou, e cancelar lá
 * mandaria ao paciente convidado um aviso de cancelamento de semanas atrás.
 */
export async function marcarSessaoNaoRealizada(
  id: string,
  status: "falta" | "cancelada",
  cobrarOuForm: boolean | FormData,
  _formData?: FormData,
): Promise<void> {
  const { supabase } = await requirePsicologa();
  if (status !== "falta" && status !== "cancelada") redirect("/evolucoes/pendentes");
  const cobrar = status === "falta" && cobrarOuForm === true;

  await supabase
    .from("consultas")
    .update({ status, cobrar })
    .eq("id", id)
    .in("status", ["agendada", "realizada"])
    .lte("fim", new Date().toISOString())
    .is("deleted_at", null);

  revalidatePath("/evolucoes/pendentes");
  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  redirect("/evolucoes/pendentes");
}

/** Confirmação manual: a psicóloga registra que o paciente confirmou. */
export async function definirConfirmacao(
  id: string,
  confirmada: boolean,
  voltar: string,
  _formData: FormData,
): Promise<void> {
  const { supabase } = await requirePsicologa();

  await supabase
    .from("consultas")
    .update({ confirmada_em: confirmada ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("status", "agendada")
    .is("deleted_at", null);

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath(`/agenda/${id}`);
  redirect(destinoSeguro(voltar));
}

/**
 * "Já combinei" do aviso de feriado (0039): grava na consulta do feriado a
 * data combinada. Remarcada para outro dia, o aviso volta a valer.
 */
export async function dispensarAvisoFeriado(
  proximaId: string,
  data: string,
  voltar: string,
  _formData: FormData,
): Promise<void> {
  const { supabase } = await requirePsicologa();
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    await supabase
      .from("consultas")
      .update({ aviso_feriado_dispensado_para: data })
      .eq("id", proximaId)
      .is("deleted_at", null);
  }
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  redirect(destinoSeguro(voltar));
}

export type AnotacoesState = { error?: string; salvoEm?: number };

/**
 * "Anotações para a sessão" (0043): texto clínico da psicóloga na consulta.
 * Editável sempre, inclusive depois da sessão (decisão do usuário). Nunca vai
 * para o Google. Texto vazio apaga.
 */
export async function salvarAnotacoesSessao(
  id: string,
  _prev: AnotacoesState,
  formData: FormData,
): Promise<AnotacoesState> {
  const { supabase } = await requirePsicologa();
  const texto = String(formData.get("anotacoes_sessao") ?? "").trim();
  if (texto.length > LIMITES.consulta.anotacoes) {
    return { error: `Máximo de ${LIMITES.consulta.anotacoes} caracteres.` };
  }

  const { data, error } = await supabase
    .from("consultas")
    .update({ anotacoes_sessao: texto || null })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível salvar as anotações.") };
  if (!data?.length) return { error: "Consulta não encontrada." };

  revalidatePath("/agenda");
  revalidatePath(`/agenda/${id}`);
  return { salvoEm: Date.now() };
}

/**
 * Sessão cancelada ou falta com anotação: copia o texto para a próxima
 * consulta marcada do paciente (o original fica) e abre a próxima na agenda.
 */
export async function levarAnotacaoParaProxima(
  id: string,
  _prev: AnotacoesState,
  _formData: FormData,
): Promise<AnotacoesState> {
  const { supabase } = await requirePsicologa();
  const { data: origem } = await supabase
    .from("consultas")
    .select("id, paciente_id, inicio, anotacoes_sessao")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!origem) return { error: "Consulta não encontrada." };
  if (!origem.anotacoes_sessao) return { error: "Esta sessão não tem anotações." };

  const proxima = await proximaSessaoDoPaciente(supabase, origem.paciente_id as string, origem.inicio as string);
  if (!proxima) return { error: "O paciente não tem uma próxima sessão marcada." };

  const { data: destino } = await supabase
    .from("consultas")
    .select("anotacoes_sessao")
    .eq("id", proxima.id)
    .maybeSingle();
  const texto = textoLevado(
    { inicio: origem.inicio as string, texto: origem.anotacoes_sessao as string },
    (destino?.anotacoes_sessao as string | null) ?? null,
  );
  if (texto === null) {
    return { error: "A próxima sessão ficaria com anotações longas demais. Copie só o que precisar." };
  }

  const { data: alterados, error } = await supabase
    .from("consultas")
    .update({ anotacoes_sessao: texto })
    .eq("id", proxima.id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível levar as anotações.") };
  if (!alterados?.length) return { error: "Próxima sessão não encontrada." };

  revalidatePath("/agenda");
  redirect(`/agenda?semana=${segundaDaSemana(new Date(proxima.inicio))}&consulta=${proxima.id}`);
}

export async function sincronizarConsultaAgora(
  id: string,
  _formData: FormData,
): Promise<void> {
  const { supabase, user } = await requirePsicologa();
  await sincronizarConsulta(supabase, user.id, id);
  revalidatePath("/agenda");
  revalidatePath(`/agenda/${id}`);
  redirect(`/agenda/${id}`);
}

/** Consulta que o bloqueio cancelaria (mostrada antes de confirmar). */
export type ConflitoBloqueio = { id: string; quando: string; paciente: string };

/**
 * Bloqueio (entrega D, 0036): horário, dia inteiro (um ou vários dias) ou
 * recorrente até uma data. Consultas ainda marcadas no período: primeiro
 * devolve a lista; só cancela quando a psicóloga confirma
 * ("Bloquear e cancelar essas consultas"). Vai para o Google Agenda dela.
 */
export async function criarBloqueio(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requirePsicologa();

  const parsed = bloqueioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;
  const slots = intervalosDoBloqueio(v);
  const min = new Date(Math.min(...slots.map((s) => s.inicio.getTime()))).toISOString();
  const max = new Date(Math.max(...slots.map((s) => s.fim.getTime()))).toISOString();
  const agoraISO = new Date().toISOString();

  const [{ data: outros }, { data: consultas }] = await Promise.all([
    supabase.from("bloqueios").select("id, inicio, fim, motivo, dia_inteiro").lt("inicio", max).gt("fim", min).order("inicio"),
    // Só as que ainda vão acontecer: sessão passada no período não impede.
    supabase
      .from("consultas")
      .select("id, inicio, fim, pacientes(nome)")
      .eq("status", "agendada")
      .is("deleted_at", null)
      .lt("inicio", max)
      .gt("fim", min)
      .gt("fim", agoraISO)
      .order("inicio"),
  ]);

  // Bloqueios podem se sobrepor (férias por cima do futevôlei de terça): só avisa.
  const sobrepostos = (outros ?? []).filter((o) => slots.some((x) => sobrepoe(x.inicio, x.fim, o.inicio, o.fim)));
  const afetadas = (consultas ?? []).filter((c) => slots.some((x) => sobrepoe(x.inicio, x.fim, c.inicio, c.fim)));
  if ((afetadas.length > 0 || sobrepostos.length > 0) && !v.cancelar_consultas) {
    return {
      conflitos: afetadas.map((c) => {
        const p = c.pacientes as { nome: string } | { nome: string }[] | null;
        const nome = (Array.isArray(p) ? p[0]?.nome : p?.nome) ?? "Paciente";
        return { id: c.id as string, quando: `${dataBR(c.inicio as string)} ${horaBR(c.inicio as string)}`, paciente: nome };
      }),
      sobrepostos: sobrepostos.map((o) => ({
        id: o.id as string,
        quando: `${dataBR(o.inicio as string)} · ${horarioDoBloqueio(o as { inicio: string; fim: string; dia_inteiro: boolean })}`,
        motivo: (o.motivo as string | null) ?? "Sem motivo",
      })),
    };
  }

  const serieId = v.recorrencia === "nenhuma" ? null : randomUUID();
  const { data: inseridos, error } = await supabase
    .from("bloqueios")
    .insert(
      slots.map((s) => ({
        psicologa_id: user.id,
        inicio: s.inicio.toISOString(),
        fim: s.fim.toISOString(),
        motivo: v.motivo,
        dia_inteiro: v.dia_inteiro,
        recorrencia: v.recorrencia,
        serie_id: serieId,
      })),
    )
    .select("id");

  if (error) {
    return { error: await mensagemErroEscrita(supabase, error, "Não foi possível criar o evento.") };
  }

  if (afetadas.length > 0) {
    const { data: canceladas } = await supabase
      .from("consultas")
      .update({ status: "cancelada" })
      .in("id", afetadas.map((c) => c.id as string))
      .eq("status", "agendada")
      .select("id");
    // O paciente convidado recebe o cancelamento pelo Google, como no "Cancelar".
    await sincronizarConsultas(supabase, user.id, (canceladas ?? []).map((r) => r.id));
  }
  await sincronizarBloqueios(supabase, user.id, (inseridos ?? []).map((r) => r.id));

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  redirect("/agenda/eventos");
}

/** Remove um bloqueio; numa série, só este ou este e os próximos. */
export async function excluirBloqueio(
  id: string,
  escopo: "este" | "proximos" | FormData,
  _formData?: FormData,
): Promise<void> {
  const { supabase, user } = await requirePsicologa();

  const { data: alvo } = await supabase.from("bloqueios").select("id, inicio, serie_id").eq("id", id).maybeSingle();
  if (alvo) {
    let query = supabase.from("bloqueios").delete();
    query = escopo === "proximos" && alvo.serie_id
      ? query.eq("serie_id", alvo.serie_id).gte("inicio", alvo.inicio)
      : query.eq("id", id);
    const { data: removidos } = await query.select("google_event_id");
    await removerEventosDeBloqueios(
      user.id,
      (removidos ?? []).map((r) => r.google_event_id as string | null).filter((g): g is string => Boolean(g)),
    );
  }
  revalidatePath("/agenda");
  redirect("/agenda/eventos");
}
