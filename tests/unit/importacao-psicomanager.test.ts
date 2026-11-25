import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  importarPlanilhas,
  lerPaciente,
  lerSessao,
  separarAnotacao,
  sobrepostasNaPlanilha,
  telefoneComDDD,
  tipoDaPlanilha,
  type Linha,
} from "@/lib/importacao/psicomanager";

// Planilha FALSA com as mesmas colunas do PsicoManager (nunca a real).
const paciente = (extra: Linha = {}): Linha => ({
  "Nome Completo": "Ana  Teste da Silva",
  CPF: "529.982.247-25",
  "E-mail": "Ana@Exemplo.com",
  "Data de Nascimento": "14/05/1990",
  Sexo: "Feminino",
  "Tel. Celular": "(51) 99999-8888",
  "Tel. Fixo": "-",
  Endereço: "Rua A, 10",
  Número: "-",
  Bairro: "-",
  Cidade: "Torres",
  Estado: "RS",
  CEP: "-",
  Complemento: "-",
  Naturalidade: "-",
  Profissão: "Professora",
  "Nome de Parente": "Nair mãe",
  "Nome do Responsável": "-",
  "Grupo Anamnese": "Adultos",
  Obs: "-",
  Convênio: "Particular",
  Carteirinha: "-",
  "Data de expiração da carteira": "-",
  "Nome do Profissional": "Psicóloga X",
  ...extra,
});

const sessao = (extra: Linha = {}): Linha => ({
  "Nome do Cliente": "Ana Teste da Silva",
  Data: "09/06/2021",
  Hora: "17:30",
  Presença: "Presente",
  "Status do Pagamento": "Pago",
  "Valor a Receber": "120,00",
  "valor pago": "240,00",
  "Forma de Pagamento": "Pix",
  "Data de Pagamento": "08/07/2021",
  Serviço: null,
  Anotações: " Resumo da Sessao: falou do trabalho",
  ...extra,
});

const AGORA = new Date("2026-11-25T15:00:00-03:00");

describe("pacientes", () => {
  it("normaliza o cadastro e manda para as observações o que não tem campo", () => {
    const p = lerPaciente(paciente(), "2026-11-25")!;
    expect(p).toMatchObject({
      chave: "ana teste da silva",
      nome: "Ana Teste da Silva",
      cpf: "52998224725",
      email: "ana@exemplo.com",
      data_nascimento: "1990-05-14",
      telefone: "51999998888",
      endereco: "Rua A, 10, Torres/RS",
    });
    expect(p.observacoes).toBe("Parente: Nair mãe\nSexo: Feminino\nProfissão: Professora");
  });

  it("CPF inválido, e-mail ruim e nascimento impossível ficam em branco, sem aviso", () => {
    const p = lerPaciente(paciente({ CPF: "111.111.111-11", "E-mail": "sem-arroba", "Data de Nascimento": "31/02/2000" }), "2026-11-25")!;
    expect(p.cpf).toBeNull();
    expect(p.email).toBeNull();
    expect(p.data_nascimento).toBeNull();
  });

  it("telefone sem DDD vai para as observações; com DDI 55 vira nacional", () => {
    expect(telefoneComDDD("99957-5571")).toEqual({ telefone: null, semDDD: "99957-5571" });
    expect(telefoneComDDD("+55 (51) 99999-8888")).toEqual({ telefone: "51999998888", semDDD: null });
    expect(telefoneComDDD("(51) 9738-8661")).toEqual({ telefone: "5197388661", semDDD: null });
    const p = lerPaciente(paciente({ "Tel. Celular": "99957-5571" }), "2026-11-25")!;
    expect(p.telefone).toBeNull();
    expect(p.observacoes).toContain("Telefone sem DDD: 99957-5571");
  });
});

describe("anotações", () => {
  it("tira o 'Resumo da Sessao:' do começo", () => {
    expect(separarAnotacao(" Resumo da Sessao: falou do trabalho")).toEqual({ demanda: "falou do trabalho", antes: null });
  });

  it("'Anotaçoes de Antes da Sessao' vai para as anotações para a sessão", () => {
    expect(separarAnotacao("Anotaçoes de Antes da Sessao: perguntar do sono Resumo da Sessao: dormiu melhor")).toEqual({
      demanda: "dormiu melhor",
      antes: "perguntar do sono",
    });
    expect(separarAnotacao("Anotaçoes de Antes da Sessao: só isto")).toEqual({ demanda: null, antes: "só isto" });
  });

  it("outros rótulos ficam, começando linha nova", () => {
    expect(separarAnotacao("Resumo da Sessao: texto Ficha de evoluçao: mais texto")).toEqual({
      demanda: "texto\nFicha de evoluçao: mais texto",
      antes: null,
    });
  });

  it("vazio ou '-': nada", () => {
    expect(separarAnotacao("-")).toEqual({ demanda: null, antes: null });
    expect(separarAnotacao("Resumo da Sessao:   ")).toEqual({ demanda: null, antes: null });
  });
});

describe("sessões", () => {
  it("passada paga: realizada, lançamento pago com o valor da sessão e a data de pagamento", () => {
    const s = lerSessao(sessao(), AGORA)!;
    expect(s).toMatchObject({
      origemId: "ana teste da silva|2021-06-09|17:30",
      status: "realizada",
      futura: false,
      demanda: "falou do trabalho",
      valorConsulta: null,
      pagamento: { status: "pago", valor: 120, data_pagamento: "2021-07-08", forma_pagamento: "pix" },
    });
    expect(s.inicio).toBe("2021-06-09T20:30:00.000Z");
    expect(new Date(s.fim).getTime() - new Date(s.inicio).getTime()).toBe(50 * 60_000);
  });

  it("presença: ausente = falta, cancelou = cancelada, vazio passado = realizada, vazio futuro = agendada", () => {
    expect(lerSessao(sessao({ Presença: "Ausente" }), AGORA)!.status).toBe("falta");
    expect(lerSessao(sessao({ Presença: "Paciente Cancelou" }), AGORA)!.status).toBe("cancelada");
    expect(lerSessao(sessao({ Presença: null }), AGORA)!.status).toBe("realizada");
    const futura = lerSessao(sessao({ Presença: null, Data: "02/12/2026", "Status do Pagamento": "Não pago" }), AGORA)!;
    expect(futura).toMatchObject({ status: "agendada", futura: true, valorConsulta: 120, pagamento: null });
  });

  it("não pago realizada = pendente (qualquer ano); falta não paga e isento ficam sem lançamento", () => {
    expect(lerSessao(sessao({ "Status do Pagamento": "Não pago", Data: "04/12/2020" }), AGORA)!.pagamento).toEqual({
      status: "pendente",
      valor: 120,
      data_pagamento: null,
      forma_pagamento: null,
    });
    expect(lerSessao(sessao({ "Status do Pagamento": "Não pago", Presença: "Ausente" }), AGORA)!.pagamento).toBeNull();
    expect(lerSessao(sessao({ "Status do Pagamento": "Isento" }), AGORA)!.pagamento).toBeNull();
    expect(lerSessao(sessao({ "Valor a Receber": "0,00" }), AGORA)!.pagamento).toBeNull();
  });

  it("falta paga entra como paga (ela cobrou a falta)", () => {
    expect(lerSessao(sessao({ Presença: "Ausente" }), AGORA)!.pagamento?.status).toBe("pago");
  });

  it("data ou hora ilegível: ignorada", () => {
    expect(lerSessao(sessao({ Data: "31/02/2021" }), AGORA)).toBeNull();
    expect(lerSessao(sessao({ Hora: "25:00" }), AGORA)).toBeNull();
  });
});

describe("planilhas inteiras", () => {
  it("liga sessões ao cadastro pelo nome (sem acento/maiúsculas), sem duplicar, com valor da última sessão", () => {
    const r = importarPlanilhas(
      [paciente(), paciente({ "Nome Completo": "Bruno Sem Sessão" })],
      [
        sessao(),
        sessao(), // repetida
        sessao({ "Nome do Cliente": "ANA TESTE DA SÍLVA", Data: "16/06/2021", "Valor a Receber": "150,00" }),
        sessao({ "Nome do Cliente": "Fulano Fora do Cadastro" }),
        sessao({ Data: "xx" }),
      ],
      AGORA,
    );
    expect(r.pacientes).toHaveLength(2);
    expect(r.sessoes).toHaveLength(2);
    expect(r.semCadastro).toEqual(["Fulano Fora do Cadastro"]);
    expect(r.ignoradas).toBe(1);
    expect(r.pacientes.find((p) => p.chave === "ana teste da silva")!.valor_sessao).toBe(150);
  });

  it("sessões sobrepostas na própria planilha: fica a primeira", () => {
    const r = importarPlanilhas(
      [paciente(), paciente({ "Nome Completo": "Bruno" })],
      [sessao(), sessao({ "Nome do Cliente": "Bruno", Hora: "17:45" }), sessao({ "Nome do Cliente": "Bruno", Hora: "17:45", Data: "10/06/2021" })],
      AGORA,
    );
    expect([...sobrepostasNaPlanilha(r.sessoes)]).toEqual(["bruno|2021-06-09|17:45"]);
  });

  it("lê um .xls de verdade (formato do Excel antigo) e reconhece qual planilha é qual", () => {
    const xls = (linhas: Linha[]) => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Relatório");
      return XLSX.write(wb, { type: "array", bookType: "biff8" }) as ArrayBuffer;
    };
    const ler = (buf: ArrayBuffer) => {
      const wb = XLSX.read(buf, { type: "array", dateNF: "dd/mm/yyyy" });
      return XLSX.utils.sheet_to_json<Linha>(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
    };
    const pac = ler(xls([paciente()]));
    const ses = ler(xls([sessao()]));
    expect(tipoDaPlanilha(Object.keys(pac[0]))).toBe("pacientes");
    expect(tipoDaPlanilha(Object.keys(ses[0]))).toBe("sessoes");
    const r = importarPlanilhas(pac, ses, AGORA);
    expect(r.pacientes[0].cpf).toBe("52998224725");
    expect(r.sessoes[0].pagamento?.valor).toBe(120);
  });
});
