import Link from "next/link";
import { ChevronLeft } from "lucide-react";

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
        <Link href="/login" className="inline-flex items-center gap-1 text-xs text-teal-700 underline">
          <ChevronLeft className="size-3.5" aria-hidden />
          Voltar
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          Política de Privacidade
        </h1>
        <p className="mt-1 text-xs text-slate-400">Última atualização: outubro de 2026.</p>
      </div>

      <Secao titulo="1. Quem somos">
        <p>
          O Gradatim é operado por Bernardo Dornelles, pessoa física, com sede
          em Torres/RS. Ainda não temos CNPJ. Quando a empresa for formalizada,
          esta política passa a trazer a razão social.
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
          O Gradatim é um sistema de gestão de consultório para psicólogos
          autônomos, com agenda, prontuário e evolução de sessões, financeiro e
          assinatura. Só o psicólogo usa o sistema. Pacientes não têm login nem
          acesso direto à plataforma.
        </p>
      </Secao>

      <Secao titulo="3. Quem é o controlador dos dados do paciente">
        <p>
          Nos dados de pacientes (cadastro, anamnese, evolução clínica,
          financeiro), o <strong>controlador</strong> é o psicólogo que usa a
          plataforma, nos termos da LGPD, porque é ele quem decide coletar e
          tratar esses dados no exercício da profissão. Nós somos{" "}
          <strong>operadores</strong>: armazenamos e processamos esses dados em
          nome do psicólogo, seguindo as instruções e finalidades definidas por
          ele, e não os usamos para nenhum fim próprio.
        </p>
        <p>
          Nos dados do próprio psicólogo (cadastro, login, assinatura), o
          controlador somos nós.
        </p>
      </Secao>

      <Secao titulo="4. Dados que coletamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Cadastro do psicólogo:</strong> nome e e-mail. Quem entra
            com o Google também compartilha a foto de perfil da conta Google.
          </li>
          <li>
            <strong>Dados de pacientes:</strong> nome, contato (telefone/WhatsApp),
            status (ativo/inativo/alta), ficha de anamnese e evoluções de
            sessão. São dados de saúde, categoria sensível pela LGPD (art. 5º,
            II).
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
            (AES-256-GCM), o token necessário para isso. A via é de mão única:
            o sistema escreve na sua agenda, mas não lê nem importa nada dela.
          </li>
          <li>
            <strong>Assinatura:</strong> CPF/CNPJ e dados de cobrança
            necessários para gerar a cobrança no Asaas. Não armazenamos dados
            de cartão. O pagamento (Pix, boleto ou cartão) acontece
            inteiramente na página hospedada pelo Asaas.
          </li>
        </ul>
        <p>
          O uso e a transferência, para qualquer outro aplicativo, de
          informações recebidas das APIs do Google seguem a{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado. Na prática: usamos o
          acesso à sua Google Agenda só para criar e atualizar os eventos das
          suas consultas e os links do Meet; não usamos esses dados para
          publicidade; não os vendemos nem repassamos a terceiros; e ninguém da
          nossa equipe os lê, exceto com o seu consentimento, quando a lei
          exigir ou para investigar um problema de segurança.
        </p>
      </Secao>

      <Secao titulo="5. Por que tratamos esses dados (base legal)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Execução de contrato</strong> (LGPD art. 7º, V): para
            fornecer a plataforma de gestão que você contratou.
          </li>
          <li>
            <strong>Consentimento</strong> (LGPD art. 11, I): para o tratamento
            de dados de saúde de pacientes, consentimento que o psicólogo obtém
            do próprio paciente, e para o acesso à sua Google Agenda (permissão
            pedida explicitamente no login, que você pode revogar a qualquer
            momento em{" "}
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
            <strong>Supabase:</strong> banco de dados e autenticação.
          </li>
          <li>
            <strong>Google:</strong> eventos na sua agenda e links do Meet
            (Google Calendar API), só com a sua autorização.
          </li>
          <li>
            <strong>Asaas:</strong> cobrança da sua assinatura. Os pagamentos
            que seus pacientes fazem a você ficam só no nosso banco (lançamento
            manual, sem gateway).
          </li>
          <li>
            <strong>Vercel:</strong> hospedagem da aplicação.
          </li>
        </ul>
        <p>Não vendemos nem alugamos dados a terceiros.</p>
      </Secao>

      <Secao titulo="7. Guarda e segurança">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Registros de evolução e prontuário são mantidos por no mínimo{" "}
            <strong>5 anos</strong>, como exige a Resolução CFP nº 01/2009.
            Excluir um registro clínico apenas o arquiva; nada é apagado
            fisicamente antes desse prazo.
          </li>
          <li>
            Os dados armazenados são protegidos pela criptografia nativa do
            banco e por controle de acesso (Row Level Security), que limita cada
            psicólogo aos dados da própria conta.
          </li>
          <li>
            O token de acesso à sua Google Agenda tem uma camada extra de
            cifra, feita na própria aplicação (AES-256-GCM).
          </li>
          <li>Toda comunicação com o sistema usa HTTPS.</li>
        </ul>
      </Secao>

      <Secao titulo="8. Seus direitos (titular dos dados)">
        <p>
          Você pode pedir acesso, correção, portabilidade ou exclusão dos seus
          dados e revogar consentimentos a qualquer momento, pela própria
          plataforma (quando houver a opção) ou pelo contato no topo desta
          página. Dados com guarda obrigatória por lei, como o prontuário (5
          anos), não podem ser excluídos antes do prazo, mesmo a pedido.
        </p>
      </Secao>

      <Secao titulo="9. Alterações desta política">
        <p>
          Esta política pode mudar com o produto, por exemplo quando a empresa
          tiver CNPJ. Avisamos mudanças relevantes por e-mail ou dentro do
          próprio sistema.
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
