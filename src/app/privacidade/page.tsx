import Link from "next/link";

export const metadata = { title: "Política de Privacidade" };

// Página pública (fora de (app) e fora do login exigido — ver PUBLIC_PATHS em
// src/lib/supabase/middleware.ts). Precisa existir e estar acessível por URL
// pública antes de submeter o app pra verificação de OAuth do Google (exige
// link de política de privacidade) e por obrigação da LGPD (dado de saúde é
// categoria sensível — art. 11).
//
// Responsável: pessoa física (sem CNPJ ainda — ver CLAUDE.md, seção "Status e
// decisões já tomadas"). Trocar pra razão social quando o CNPJ existir.

export default function PoliticaDePrivacidadePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6 text-sm leading-relaxed text-slate-700 sm:p-10">
      <div>
        <Link href="/login" className="text-xs text-teal-700 underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          Política de Privacidade
        </h1>
        <p className="mt-1 text-xs text-slate-400">Última atualização: outubro de 2026.</p>
      </div>

      <Secao titulo="1. Quem somos">
        <p>
          O <strong>Gestão para Psicólogas</strong> (nome do produto ainda não
          definido oficialmente) é operado por <strong>Bernardo Dornelles</strong>,
          pessoa física, com sede em Torres/RS. Ainda não possuímos CNPJ — esta
          política será atualizada com a razão social assim que a empresa for
          formalizada.
        </p>
        <p>
          Contato:{" "}
          <a href="mailto:bernardo.dornelles22@gmail.com" className="underline">
            bernardo.dornelles22@gmail.com
          </a>
        </p>
      </Secao>

      <Secao titulo="2. O que o sistema faz">
        <p>
          Somos uma plataforma de gestão de consultório para psicólogas
          autônomas: agenda, prontuário/evolução de sessões, financeiro e
          assinatura. O sistema é de uso exclusivo da psicóloga — pacientes não
          têm login nem acesso direto à plataforma.
        </p>
      </Secao>

      <Secao titulo="3. Quem é a controladora dos dados do paciente">
        <p>
          Para os dados de <strong>pacientes</strong> (cadastro, anamnese,
          evolução clínica, financeiro), a <strong>psicóloga usuária da
          plataforma é a controladora</strong>, nos termos da LGPD — é ela quem
          decide coletar e tratar esses dados no exercício da sua profissão.
          Atuamos como <strong>operadores</strong>: armazenamos e processamos
          esses dados em nome da psicóloga, seguindo as instruções e
          finalidades definidas por ela, sem uso próprio.
        </p>
        <p>
          Para os dados <strong>da própria psicóloga</strong> (cadastro, login,
          assinatura), nós somos os controladores.
        </p>
      </Secao>

      <Secao titulo="4. Dados que coletamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Cadastro da psicóloga:</strong> nome, e-mail e foto de
            perfil (via login do Google).
          </li>
          <li>
            <strong>Dados de pacientes:</strong> nome, contato (telefone/WhatsApp),
            status (ativo/inativo/alta), ficha de anamnese e evoluções de
            sessão — dado de saúde, categoria sensível pela LGPD (art. 5º, II).
          </li>
          <li>
            <strong>Agenda:</strong> consultas, horários, recorrência, bloqueios
            de disponibilidade.
          </li>
          <li>
            <strong>Financeiro:</strong> lançamentos de pagamento por sessão
            (valor, status, data).
          </li>
          <li>
            <strong>Google Agenda:</strong> com sua autorização explícita,
            criamos eventos na sua Google Agenda pessoal (e o link do Google
            Meet, quando a consulta é online) e guardamos, de forma cifrada
            (AES-256-GCM), o token necessário pra isso. Não lemos nem
            importamos nada da sua agenda — a via é de mão única (nosso
            sistema → sua Google Agenda).
          </li>
          <li>
            <strong>Assinatura:</strong> CPF/CNPJ e dados de cobrança
            necessários pra gerar a cobrança no Asaas. Nunca armazenamos dados
            de cartão — o pagamento (Pix, boleto ou cartão) acontece
            inteiramente na página hospedada pelo Asaas.
          </li>
        </ul>
      </Secao>

      <Secao titulo="5. Por que tratamos esses dados (base legal)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Execução de contrato</strong> (LGPD art. 7º, V): pra
            fornecer a plataforma de gestão que você contratou.
          </li>
          <li>
            <strong>Consentimento</strong> (LGPD art. 11, I): pro tratamento de
            dado de saúde de pacientes, obtido pela psicóloga junto ao próprio
            paciente, e pro acesso à sua Google Agenda (escopo pedido
            explicitamente no login, revogável a qualquer momento em{" "}
            <Link href="/configuracoes" className="underline">
              Configurações
            </Link>{" "}
            ou direto na sua conta Google).
          </li>
        </ul>
      </Secao>

      <Secao titulo="6. Com quem compartilhamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Supabase</strong> — banco de dados e autenticação (infraestrutura
            do produto).
          </li>
          <li>
            <strong>Google</strong> — sincronização de agenda e geração de
            link do Meet (Google Calendar API), só com sua autorização.
          </li>
          <li>
            <strong>Asaas</strong> — processamento da cobrança da sua
            assinatura. Dados de pagamento do paciente para a psicóloga
            continuam só no nosso banco (lançamento manual, sem gateway).
          </li>
          <li>
            <strong>Vercel</strong> — hospedagem da aplicação.
          </li>
        </ul>
        <p>Não vendemos nem alugamos dados a terceiros, em nenhuma hipótese.</p>
      </Secao>

      <Secao titulo="7. Guarda e segurança">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Registros de evolução/prontuário são mantidos por no mínimo{" "}
            <strong>5 anos</strong>, conforme exigência da Resolução CFP nº
            01/2009. &ldquo;Excluir&rdquo; um registro clínico arquiva (soft delete) — nunca
            apaga fisicamente antes desse prazo.
          </li>
          <li>
            Dados em repouso são protegidos pela criptografia nativa do banco
            e por controle de acesso (Row Level Security): cada psicóloga só
            acessa os próprios dados, nunca os de outra conta.
          </li>
          <li>
            O token de acesso à sua Google Agenda é cifrado na aplicação
            (AES-256-GCM), separado do resto do banco.
          </li>
          <li>Toda comunicação com o sistema é feita por HTTPS.</li>
        </ul>
      </Secao>

      <Secao titulo="8. Seus direitos (titular dos dados)">
        <p>
          Você pode pedir acesso, correção, portabilidade ou exclusão dos seus
          dados, e revogar consentimentos, a qualquer momento — direto na
          plataforma (quando aplicável) ou pelo contato no topo desta página.
          Dados sob obrigação legal de guarda (ex: prontuário, 5 anos) não
          podem ser excluídos antes do prazo, mesmo a pedido.
        </p>
      </Secao>

      <Secao titulo="9. Alterações desta política">
        <p>
          Podemos atualizar esta política conforme o produto evolui (ex:
          quando a empresa tiver CNPJ). Mudanças relevantes serão avisadas por
          e-mail ou dentro do próprio sistema.
        </p>
      </Secao>
    </main>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium text-slate-900">{titulo}</h2>
      {children}
    </section>
  );
}
