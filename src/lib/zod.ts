import { z } from "zod";

// Zod com as mensagens padrão em português. É a rede de segurança: todo campo
// que a psicóloga vê tem mensagem própria nos schemas, mas um caso não
// previsto (ex.: requisição montada à mão) não pode aparecer em inglês.
// Importe o z daqui, não de "zod".
z.config(z.locales.ptBR());

export { z };
