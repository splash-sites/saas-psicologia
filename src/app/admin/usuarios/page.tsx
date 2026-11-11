import { exigirAdmin } from "@/lib/admin/acesso";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITUACOES_CONTA, type SituacaoConta, type UsuarioAdmin } from "@/lib/admin/usuarios";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ListaUsuarios } from "./ListaUsuarios";

export const metadata = { title: "Usuários" };

export default async function UsuariosAdmin({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>;
}) {
  await exigirAdmin();
  const { situacao } = await searchParams;
  const inicial = (SITUACOES_CONTA as readonly string[]).includes(situacao ?? "")
    ? (situacao as SituacaoConta)
    : "todas";

  const { data, error } = await createAdminClient().rpc("admin_usuarios");
  const usuarios = (data ?? []) as UsuarioAdmin[];

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Usuários"
        descricao="Dados de conta, assinatura e uso em números. Nada de pacientes nem prontuário."
      />
      {error ? (
        <p className="alert alert-error">
          Não foi possível carregar os usuários. Confira se a migration 0028 foi aplicada.
        </p>
      ) : (
        <ListaUsuarios usuarios={usuarios} situacaoInicial={inicial} />
      )}
    </div>
  );
}
