// Validação de CPF/CNPJ (dígitos verificadores) — exigido pelo Asaas para
// criar o cliente de cobrança. Sem lib externa, só os algoritmos padrão.

function digitosCpf(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais: inválido
  const calc = (fatorInicial: number) => {
    let soma = 0;
    for (let i = 0; i < fatorInicial - 1; i++) {
      soma += Number(cpf[i]) * (fatorInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(10) === Number(cpf[9]) && calc(11) === Number(cpf[10]);
}

function digitosCnpj(cnpj: string): boolean {
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (pesos: number[]) => {
    const soma = pesos.reduce((s, peso, i) => s + peso * Number(cnpj[i]), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return calc(pesos1) === Number(cnpj[12]) && calc(pesos2) === Number(cnpj[13]);
}

export type ResultadoCpfCnpj =
  | { valido: true; tipo: "cpf" | "cnpj"; digitos: string }
  | { valido: false; tipo: null; digitos: string };

export function validarCpfCnpj(valor: string): ResultadoCpfCnpj {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length === 11 && digitosCpf(digitos)) {
    return { valido: true, tipo: "cpf", digitos };
  }
  if (digitos.length === 14 && digitosCnpj(digitos)) {
    return { valido: true, tipo: "cnpj", digitos };
  }
  return { valido: false, tipo: null, digitos };
}
