// Limites de tamanho e faixa dos campos, num lugar só. Usados pelo Zod (servidor)
// e pelos campos dos formulários (maxLength/min/max no navegador, para a pessoa
// ver o limite antes de enviar e não perder texto).
//
// O banco tem as mesmas regras em CHECK (migrations 0007, 0013, 0018): mudar um
// número aqui exige migration nova com o mesmo valor. tests/rls/limites.test.ts
// confere que o banco recusa limite + 1.

export const LIMITES = {
  paciente: {
    nome: 200,
    email: 254,
    endereco: 300,
    observacoes: 5000,
  },
  /** Anamnese e os 4 campos da evolução + notas privadas. */
  textoClinico: 20000,
  evolucao: { motivoArquivamentoMin: 3, motivoArquivamento: 500 },
  consulta: { observacoes: 2000, duracaoMin: 15, duracaoMax: 480, ocorrenciasMax: 52 },
  bloqueio: { motivo: 200 },
  pagamento: { valorMax: 100000, observacoes: 2000 },
  lembrete: { antecedenciaMin: 1, antecedenciaMax: 168, mensagem: 1000 },
} as const;
