// Tradução das mensagens de erro do Supabase Auth (só vêm em inglês) para um
// texto que a psicóloga entenda. Função pura — fácil de testar sem precisar
// de um Supabase de verdade.

const MAPA: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/user already registered/i, "Já existe uma conta com esse e-mail. Tente entrar."],
  [/password should be at least/i, "A senha precisa ter pelo menos 6 caracteres."],
  [/email not confirmed/i, "Confirme seu e-mail antes de entrar — veja a caixa de entrada."],
  [/rate limit/i, "Muitas tentativas seguidas. Aguarde um pouco e tente de novo."],
  [/unable to validate email address/i, "E-mail inválido."],
];

export function traduzErroAuth(mensagem: string | undefined | null): string {
  if (!mensagem) return "Não foi possível completar. Tente novamente.";
  const achou = MAPA.find(([padrao]) => padrao.test(mensagem));
  return achou ? achou[1] : "Não foi possível completar. Tente novamente.";
}
