import { z } from "zod";

export const preferenciasLembreteSchema = z.object({
  antecedencia_horas: z.coerce
    .number()
    .int("Use um número inteiro de horas")
    .min(1, "Mínimo de 1 hora")
    .max(168, "Máximo de 168 horas (7 dias)"),
  // Vazio = usa o texto padrão.
  mensagem_template: z
    .string()
    .trim()
    .max(1000, "Máximo de 1000 caracteres")
    .transform((v) => (v === "" ? null : v)),
  // Checkbox de formulário: marcado envia "on", desmarcado não envia nada.
  convite_google: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
});

export type PreferenciasLembreteInput = z.output<typeof preferenciasLembreteSchema>;
