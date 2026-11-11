import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/acesso";

// Por enquanto o painel só tem cupons; a visão geral (indicadores) vem na
// entrega 3.
export default async function AdminInicio() {
  await exigirAdmin();
  redirect("/admin/cupons");
}
