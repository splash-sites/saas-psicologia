import { permanentRedirect } from "next/navigation";
import { URL_PRIVACIDADE } from "@/lib/legal";

// O texto fica só na landing (URL da tela de consentimento do Google).
export default function Pagina() {
  permanentRedirect(URL_PRIVACIDADE);
}
