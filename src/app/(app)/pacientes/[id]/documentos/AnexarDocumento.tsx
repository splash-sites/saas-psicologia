"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Paperclip, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LIMITES } from "@/lib/limites";
import { hojeBR } from "@/lib/agenda/datas";
import { comprimirFoto, ehFoto } from "@/lib/documentos/comprimir";
import { ACEITA_ARQUIVO, DOCX, TIPOS_DOCUMENTO, formatarTamanho, type MimeDocumento } from "@/lib/documentos/tipos";
import { confirmarEnvioDocumento, iniciarEnvioDocumento } from "./actions";

type Props = {
  pacienteId: string;
  /** Anexado numa evolução: aparece nela e na ficha. */
  evolucaoId?: string;
};

const L = LIMITES.documento;

/** Tipo do arquivo pelo navegador ou, se ele não souber, pela extensão. */
function mimeDoArquivo(arquivo: File): MimeDocumento | null {
  const t = arquivo.type;
  if (t === "application/pdf" || /\.pdf$/i.test(arquivo.name)) return "application/pdf";
  if (t === DOCX || /\.docx$/i.test(arquivo.name)) return DOCX;
  return null;
}

export function AnexarDocumento({ pacienteId, evolucaoId }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [etapa, setEtapa] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function escolher(f: File | undefined) {
    setErro(null);
    setOk(false);
    if (!f) return;
    setArquivo(f);
    if (!nome) setNome(f.name.replace(/\.[^.]+$/, "").slice(0, L.nome));
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!arquivo) return setErro("Escolha um arquivo.");
    setErro(null);
    const fd = new FormData(e.currentTarget);
    try {
      let blob: Blob = arquivo;
      let mime: MimeDocumento | null;
      if (ehFoto(arquivo)) {
        setEtapa("Preparando a foto...");
        try {
          const r = await comprimirFoto(arquivo);
          blob = r.blob;
          mime = r.mime;
        } catch {
          return setErro("Este navegador não abriu a imagem. Use JPG ou PNG (no iPhone, a câmera já envia em JPG).");
        }
      } else {
        mime = mimeDoArquivo(arquivo);
        if (!mime) return setErro("Tipo de arquivo não aceito. Use PDF, Word (.docx), JPG ou PNG.");
      }
      if (blob.size > L.tamanhoMax) return setErro(`O arquivo tem ${formatarTamanho(blob.size)}; o máximo é 10 MB.`);

      setEtapa("Enviando...");
      const inicio = await iniciarEnvioDocumento(pacienteId, {
        nome: String(fd.get("nome") ?? ""),
        tipo: String(fd.get("tipo") ?? "outro") as keyof typeof TIPOS_DOCUMENTO,
        data_documento: String(fd.get("data_documento") ?? ""),
        finalidade: String(fd.get("finalidade") ?? ""),
        destinatario: String(fd.get("destinatario") ?? ""),
        evolucao_id: evolucaoId ?? null,
        mime,
        tamanho: blob.size,
      });
      if ("error" in inicio) return setErro(inicio.error);

      const { error } = await createClient()
        .storage.from("documentos")
        // Blob com o tipo certo: o do arquivo pode vir vazio (ex.: .docx no Windows).
        .upload(inicio.caminho, new Blob([blob], { type: mime }), { contentType: mime, upsert: false });
      if (error) return setErro("O envio do arquivo falhou. Confira a internet e tente de novo.");

      const fim = await confirmarEnvioDocumento(inicio.id);
      if ("error" in fim) return setErro(fim.error);

      formRef.current?.reset();
      setArquivo(null);
      setNome("");
      setOk(true);
      setAberto(false);
      router.refresh();
    } catch {
      setErro("Não foi possível anexar. Tente de novo.");
    } finally {
      setEtapa(null);
    }
  }

  if (!aberto) {
    return (
      <div className="flex flex-col gap-2">
        {ok && <p className="alert alert-success">Documento anexado.</p>}
        <button type="button" onClick={() => setAberto(true)} className="btn btn-outline btn-sm w-fit">
          <Paperclip className="size-4" aria-hidden />
          Anexar documento
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={enviar} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
      {erro && <p className="alert alert-error">{erro}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <label className="btn btn-outline btn-sm cursor-pointer">
          <Upload className="size-4" aria-hidden />
          Escolher arquivo
          <input type="file" accept={ACEITA_ARQUIVO} className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
        </label>
        <label className="btn btn-outline btn-sm cursor-pointer sm:hidden">
          <Camera className="size-4" aria-hidden />
          Tirar foto
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
        </label>
        <span className="text-sm text-slate-600">
          {arquivo ? `${arquivo.name} · ${formatarTamanho(arquivo.size)}` : "PDF, Word (.docx), JPG ou PNG, até 10 MB."}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Nome *
          <input name="nome" required maxLength={L.nome} value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Data *
          <input name="data_documento" type="date" required defaultValue={hojeBR()} className="input" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm sm:w-72">
        Tipo *
        <select name="tipo" defaultValue="outro" className="input">
          {Object.entries(TIPOS_DOCUMENTO).map(([v, rotulo]) => (
            <option key={v} value={v}>
              {rotulo}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Finalidade
          <input name="finalidade" maxLength={L.finalidade} placeholder="Ex.: apresentar na escola" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Destinatário
          <input name="destinatario" maxLength={L.destinatario} placeholder="Ex.: Escola Municipal X" className="input" />
        </label>
      </div>
      <p className="text-xs text-slate-500">
        Finalidade e destinatário são opcionais; para documentos que você produziu, a Resolução CFP 01/2009 pede guardar a cópia com data, finalidade e destinatário.
      </p>

      <div className="flex gap-2">
        <button type="submit" disabled={Boolean(etapa)} className="btn btn-primary btn-sm">
          {etapa ?? "Anexar"}
        </button>
        <button type="button" disabled={Boolean(etapa)} onClick={() => setAberto(false)} className="btn btn-outline btn-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
