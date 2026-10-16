import { z } from "zod";

// Link da videochamada de uma consulta online. O gerado pelo Google
// (consultas.meet_link, só com a integração ligada) tem prioridade; sem ele,
// vale o link fixo da psicóloga (psicologas.link_atendimento_online).
export function linkDaConsulta(
  c: { modalidade: string; meet_link: string | null },
  linkFixo: string | null | undefined,
): string | null {
  if (c.modalidade !== "online") return null;
  return c.meet_link ?? linkFixo ?? null;
}

// Mesma regra do CHECK psicologas_link_online_valido (migration 0018).
export const linkAtendimentoSchema = z.object({
  link_atendimento_online: z
    .string()
    .trim()
    .max(500, "Máximo de 500 caracteres")
    .transform((v) => (v === "" ? null : v))
    .pipe(
      z
        .string()
        .regex(/^https:\/\/\S+$/, "Use o link completo, começando com https://")
        .nullable(),
    ),
});
