import { redirect } from "next/navigation";
import Link from "next/link";
import { usuarioAtual } from "@/lib/auth/usuario";
import { buscarStatusAssinatura } from "@/lib/assinatura/guard";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ImportadorPsicoManager } from "./ImportadorPsicoManager";
import { createClient } from "@/lib/supabase/server";
import { escopoTemCalendar, integracaoGoogleConfigurada } from "@/lib/google/calendar";

export const metadata = { title: "Importar dados" };

export default async function ImportarPage() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const [status, { data: token }] = await Promise.all([
    buscarStatusAssinatura(user.id),
    supabase.from("google_oauth_tokens").select("escopo").eq("psicologa_id", user.id).maybeSingle(),
  ]);
  // Sem a Agenda conectada, as sessões futuras importadas não ganham Meet.
  const googleConectado =
    integracaoGoogleConfigurada() && Boolean(token) && (token?.escopo == null || escopoTemCalendar(token.escopo));

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Importar dados de outro sistema"
        voltar={{ href: "/configuracoes", rotulo: "Configurações" }}
        descricao="Traga pacientes, sessões, evoluções e pagamentos do PsicoManager para o Gradatim."
      />
      {status.somenteLeitura ? (
        <p className="alert alert-error">
          Sua conta está em somente leitura (assinatura pendente). Para importar,{" "}
          <Link href="/assinatura" className="font-medium underline">
            regularize a assinatura
          </Link>
          .
        </p>
      ) : (
        <ImportadorPsicoManager googleConectado={googleConectado} />
      )}
    </div>
  );
}
