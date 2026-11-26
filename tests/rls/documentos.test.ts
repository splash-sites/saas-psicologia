import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Entrega G (0041): tabela documentos + bucket privado "documentos".

async function conta(prefixo: string) {
  const s = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await signUpPsicologa(`${prefixo}-${s}@teste.local`);
  const c = userClient(u.accessToken);
  const { data: p } = await c.from("pacientes").insert({ psicologa_id: u.id, nome: "Paciente" }).select("id").single();
  return { u, c, pacienteId: p!.id as string };
}

/** Cria a linha pendente (como o servidor faz) e devolve id e caminho. */
async function pendente(c: SupabaseClient, psicologaId: string, pacienteId: string, extra: Record<string, unknown> = {}) {
  const id = randomUUID();
  const caminho = `${psicologaId}/${id}.pdf`;
  const r = await c.from("documentos").insert({
    id, psicologa_id: psicologaId, paciente_id: pacienteId, nome: "Atestado", tipo: "atestado",
    arquivo_path: caminho, mime: "application/pdf", tamanho: 9, ...extra,
  });
  return { id, caminho, error: r.error };
}

// Bytes com contentType explícito (Blob de texto no Node vira text/plain).
const PDF = Buffer.from("%PDF-1.4\n");

describe.skipIf(!hasLocalSupabase)("Documentos (0041)", () => {
  it("fluxo: linha pendente, envio do arquivo, confirmação, link assinado; nada de apagar", async () => {
    const { u, c, pacienteId } = await conta("doc1");
    const { id, caminho, error } = await pendente(c, u.id, pacienteId);
    expect(error).toBeNull();

    const up = await c.storage.from("documentos").upload(caminho, PDF, { contentType: "application/pdf" });
    expect(up.error).toBeNull();
    // Reenviar por cima não pode (sem update no Storage).
    const de_novo = await c.storage.from("documentos").upload(caminho, PDF, { contentType: "application/pdf", upsert: true });
    expect(de_novo.error).not.toBeNull();

    const conf = await c.from("documentos").update({ enviado_em: new Date().toISOString() }).eq("id", id).select("enviado_em").single();
    expect(conf.data?.enviado_em).toBeTruthy();
    // Depois de confirmado, mais nenhum arquivo para essa linha.
    const outro = await c.storage.from("documentos").upload(`${u.id}/${randomUUID()}.pdf`, PDF, { contentType: "application/pdf" });
    expect(outro.error).not.toBeNull();

    const link = await c.storage.from("documentos").createSignedUrl(caminho, 60);
    expect(link.data?.signedUrl).toContain("token=");

    // Campos que não mudam e nada de apagar (linha nem arquivo).
    expect((await c.from("documentos").update({ arquivo_path: `${u.id}/x.pdf` }).eq("id", id)).error?.code).toBe("23514");
    expect((await c.from("documentos").delete().eq("id", id).select("id")).data ?? []).toHaveLength(0);
    const rm = await c.storage.from("documentos").remove([caminho]);
    expect(rm.data ?? []).toHaveLength(0);
    expect((await c.storage.from("documentos").download(caminho)).error).toBeNull();

    // Arquivar = deleted_at.
    expect((await c.from("documentos").update({ deleted_at: new Date().toISOString() }).eq("id", id)).error).toBeNull();

    // "Excluir arquivo": marca na linha, aí o Storage deixa apagar; a linha fica e o espaço volta.
    const espaco = async () => Number(((await c.rpc("documentos_espaco")).data as { usado: number }[])[0].usado);
    expect(await espaco()).toBeGreaterThan(0);
    await c.from("documentos").update({ arquivo_excluido_em: new Date().toISOString() }).eq("id", id);
    const apagado = await c.storage.from("documentos").remove([caminho]);
    expect(apagado.data ?? []).toHaveLength(1);
    expect((await c.storage.from("documentos").download(caminho)).error).not.toBeNull();
    expect(await espaco()).toBe(0);
    // Não tem volta, e a linha continua.
    await c.from("documentos").update({ arquivo_excluido_em: null }).eq("id", id);
    const linha = await c.from("documentos").select("nome, arquivo_excluido_em").eq("id", id).single();
    expect(linha.data?.nome).toBe("Atestado");
    expect(linha.data?.arquivo_excluido_em).toBeTruthy();

    // Registro de acesso do tipo documento.
    const acesso = await c.from("acessos_prontuario").insert({ tipo: "documento", paciente_id: pacienteId, documento_id: id });
    expect(acesso.error).toBeNull();
  });

  it("Storage só aceita arquivo com linha pendente, na pasta da própria conta e nos formatos da lista", async () => {
    const { u, c, pacienteId } = await conta("doc2");
    const semLinha = await c.storage.from("documentos").upload(`${u.id}/${randomUUID()}.pdf`, PDF, { contentType: "application/pdf" });
    expect(semLinha.error).not.toBeNull();
    const { caminho } = await pendente(c, u.id, pacienteId);
    const html = await c.storage.from("documentos").upload(caminho, Buffer.from("<script>"), { contentType: "text/html" });
    expect(html.error).not.toBeNull();
  });

  it("HTML declarado como PDF: o bucket aceita, o servidor confere os bytes e apaga (auditoria 2026-11-26)", async () => {
    const { u, c, pacienteId } = await conta("doc-falso");
    const { id, caminho } = await pendente(c, u.id, pacienteId);
    const falso = Buffer.from("<!doctype html><script>alert(1)</script>");
    expect((await c.storage.from("documentos").upload(caminho, falso, { contentType: "application/pdf" })).error).toBeNull();

    // Como confirmarEnvioDocumento lê o começo: link assinado + Range.
    const { data: link } = await c.storage.from("documentos").createSignedUrl(caminho, 60);
    const r = await fetch(link!.signedUrl, { headers: { Range: "bytes=0-1023" } });
    expect(r.ok).toBe(true);
    const inicio = new Uint8Array(await r.arrayBuffer());
    const { conteudoConfere } = await import("@/lib/documentos/conteudo");
    expect(conteudoConfere("application/pdf", inicio)).toBe(false);

    // Limpeza da action: enviado + excluído na mesma escrita, depois apaga o arquivo.
    const agora = new Date().toISOString();
    expect((await c.from("documentos").update({ enviado_em: agora, arquivo_excluido_em: agora }).eq("id", id)).error).toBeNull();
    const rm = await c.storage.from("documentos").remove([caminho]);
    expect(rm.data ?? []).toHaveLength(1);
    expect((await c.storage.from("documentos").download(caminho)).error).not.toBeNull();
  });

  it("isolamento: outra conta não lê, não baixa, não lista, não anexa e não altera", async () => {
    const a = await conta("doc3a");
    const b = await conta("doc3b");
    const { id, caminho } = await pendente(a.c, a.u.id, a.pacienteId);
    await a.c.storage.from("documentos").upload(caminho, PDF, { contentType: "application/pdf" });
    await a.c.from("documentos").update({ enviado_em: new Date().toISOString() }).eq("id", id);

    expect((await b.c.from("documentos").select("id").eq("id", id)).data).toHaveLength(0);
    expect((await b.c.storage.from("documentos").download(caminho)).error).not.toBeNull();
    expect((await b.c.storage.from("documentos").createSignedUrl(caminho, 60)).error).not.toBeNull();
    expect((await b.c.storage.from("documentos").list(a.u.id)).data ?? []).toHaveLength(0);
    expect((await b.c.from("documentos").update({ nome: "x" }).eq("id", id).select("id")).data ?? []).toHaveLength(0);
    // B não marca nem apaga o arquivo de A (nem depois de A marcar a exclusão).
    expect((await b.c.from("documentos").update({ arquivo_excluido_em: new Date().toISOString() }).eq("id", id).select("id")).data ?? []).toHaveLength(0);
    await a.c.from("documentos").update({ arquivo_excluido_em: new Date().toISOString() }).eq("id", id);
    expect((await b.c.storage.from("documentos").remove([caminho])).data ?? []).toHaveLength(0);
    expect((await a.c.storage.from("documentos").download(caminho)).error).toBeNull();

    // B não cria documento no paciente de A, nem com o caminho na pasta de A.
    expect((await pendente(b.c, b.u.id, a.pacienteId)).error).not.toBeNull();
    const naPastaDeA = await b.c.from("documentos").insert({
      psicologa_id: b.u.id, paciente_id: b.pacienteId, nome: "x", arquivo_path: `${a.u.id}/${randomUUID()}.pdf`,
      mime: "application/pdf", tamanho: 9,
    });
    expect(naPastaDeA.error).not.toBeNull();
    // Nem enviar arquivo para a pasta de A.
    expect((await b.c.storage.from("documentos").upload(`${a.u.id}/${randomUUID()}.pdf`, PDF, { contentType: "application/pdf" })).error).not.toBeNull();
  });

  it("evolução de outro paciente é recusada; cota de 100 MB por conta", async () => {
    const { u, c, pacienteId } = await conta("doc4");
    const { data: p2 } = await c.from("pacientes").insert({ psicologa_id: u.id, nome: "Outro" }).select("id").single();
    const { data: evo } = await c.from("evolucoes").insert({ psicologa_id: u.id, paciente_id: p2!.id, data_sessao: "2026-11-20", demanda: "x" }).select("id").single();
    expect((await pendente(c, u.id, pacienteId, { evolucao_id: evo!.id })).error?.code).toBe("23514");
    expect((await pendente(c, u.id, p2!.id, { evolucao_id: evo!.id })).error).toBeNull();

    // 10 de 10 MB (pendentes da última hora contam) = 100 MB; o 11º passa da cota.
    for (let i = 0; i < 9; i++) expect((await pendente(c, u.id, pacienteId, { tamanho: 10 * 1024 * 1024 })).error).toBeNull();
    const cheio = await pendente(c, u.id, pacienteId, { tamanho: 10 * 1024 * 1024 });
    expect(cheio.error?.message).toContain("documentos_cota_excedida");
    const { data: esp } = await c.rpc("documentos_espaco");
    expect(Number((esp as { cota: number }[])[0].cota)).toBe(100 * 1024 * 1024);
  });

  it("limite de 'Baixar documentos': 5 por minuto", async () => {
    const { c, pacienteId } = await conta("doc5");
    const r: boolean[] = [];
    for (let i = 0; i < 6; i++) r.push((await c.rpc("registrar_exportacao", { p_tipo: "documentos", p_paciente_id: pacienteId })).data as boolean);
    expect(r).toEqual([true, true, true, true, true, false]);
  });
});
