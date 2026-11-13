import { URL_PRIVACIDADE, URL_TERMOS } from "@/lib/legal";
import { marcarTermosVistos } from "./actions";

// Faixa de "atualizamos os Termos e a Privacidade" (src/lib/termos.ts): some
// ao clicar em "Entendi" (gravado no banco, por conta) ou depois de 30 dias.
export function AvisoTermos() {
  return (
    <div role="status" className="alert alert-info flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Atualizamos os{" "}
        <a href={URL_TERMOS} target="_blank" rel="noopener noreferrer" className="font-medium underline">
          Termos de Uso
        </a>{" "}
        e a{" "}
        <a href={URL_PRIVACIDADE} target="_blank" rel="noopener noreferrer" className="font-medium underline">
          Política de Privacidade
        </a>
        : agora eles explicam com mais detalhe quais dados o Gradatim guarda, o que vai para o Google
        Agenda, o modo somente leitura e os cupons.
      </p>
      <form action={marcarTermosVistos} className="shrink-0">
        <button type="submit" className="btn btn-outline">
          Entendi
        </button>
      </form>
    </div>
  );
}
