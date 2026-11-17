import { exigirAdmin } from "@/lib/admin/acesso";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { NovoCupomForm } from "./NovoCupomForm";

export const metadata = { title: "Novo cupom" };

export default async function NovoCupom() {
  await exigirAdmin();
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Novo cupom"
        voltar={{ href: "/admin/cupons", rotulo: "Cupons" }}
        descricao="Depois de criado, o código e o benefício não mudam (quem já usou recebeu esse benefício). Validade e limite podem ser editados."
      />
      <NovoCupomForm />
    </div>
  );
}
