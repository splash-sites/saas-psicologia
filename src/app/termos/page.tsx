import { permanentRedirect } from "next/navigation";
import { URL_TERMOS } from "@/lib/legal";

// O texto fica só na landing (URL da tela de consentimento do Google).
export default function Pagina() {
  permanentRedirect(URL_TERMOS);
}
