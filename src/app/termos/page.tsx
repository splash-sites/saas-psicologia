import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "Termos de Uso" };

// Página pública — ver nota em src/app/privacidade/page.tsx (mesmo motivo:
// exigência da verificação OAuth do Google + boa prática antes de cobrar
// assinatura de verdade).

export default function TermosDeUsoPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6 text-sm leading-relaxed text-slate-700 sm:p-10">
      <div>
        <Link href="/login" className="inline-flex items-center gap-1 text-xs text-teal-700 underline">
          <ChevronLeft className="size-3.5" aria-hidden />
          Voltar
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Termos de Uso</h1>
        <p className="mt-1 text-xs text-slate-400">Última atualização: outubro de 2026.</p>
      </div>

      <Secao titulo="1. Quem oferece o serviço">
        <p>
          O <strong>Gestão para Psicólogos</strong> é oferecido por{" "}
          <strong>Bernardo Dornelles</strong>, pessoa física, Torres/RS. Ao
          criar uma conta, você concorda com estes termos e com a nossa{" "}
          <Link href="/privacidade" className="underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </Secao>

      <Secao titulo="2. O que é o serviço">
        <p>
          Plataforma de gestão de consultório (agenda, prontuário/evolução,
          financeiro e assinatura) voltada a psicólogos autônomos, com
          atendimento individual (não clínicas com múltiplos profissionais). O
          serviço <strong>não presta atendimento psicológico</strong> nem
          substitui o julgamento clínico do profissional — é só uma ferramenta
          de organização e registro.
        </p>
      </Secao>

      <Secao titulo="3. Cadastro e responsabilidade pela conta">
        <ul className="list-disc space-y-1 pl-5">
          <li>Uma conta por psicólogo; o uso é individual, não compartilhado.</li>
          <li>
            Você é responsável por manter a confidencialidade do seu login e
            por tudo que acontecer na sua conta.
          </li>
          <li>
            Você é responsável pela exatidão dos dados inseridos (seus e dos
            seus pacientes) e por obter o consentimento necessário dos
            pacientes para o tratamento dos dados deles na plataforma,
            conforme a LGPD e o Código de Ética Profissional do Psicólogo.
          </li>
        </ul>
      </Secao>

      <Secao titulo="4. Assinatura e cobrança">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            A plataforma é paga por assinatura, com 14 dias de teste grátis a
            partir do cadastro. Planos: mensal, trimestral (10% de desconto) e
            semestral (15% de desconto) — valores exibidos na tela de
            assinatura antes da confirmação.
          </li>
          <li>
            A cobrança é processada pelo Asaas. Você escolhe a forma de
            pagamento (Pix, boleto ou cartão) diretamente na página hospedada
            pelo Asaas — nenhum dado de cartão passa pelos nossos servidores.
          </li>
          <li>
            Pagamento em atraso restringe a conta ao{" "}
            <strong>modo somente leitura</strong>: você continua vendo e
            exportando pacientes, agenda, prontuário e financeiro, mas não
            consegue criar ou editar nada até regularizar. Nunca bloqueamos o
            acesso de leitura, justamente pra não impedir o cumprimento da sua
            obrigação de guarda de prontuário.
          </li>
          <li>Você pode cancelar a assinatura a qualquer momento, pela própria plataforma.</li>
          <li>
            Emissão de nota fiscal ainda não está disponível (depende da
            formalização de CNPJ) — ver{" "}
            <Link href="/privacidade" className="underline">
              Política de Privacidade
            </Link>
            .
          </li>
        </ul>
      </Secao>

      <Secao titulo="5. Seus dados e os dados dos seus pacientes">
        <p>
          Os dados que você cadastra sobre seus pacientes pertencem a você
          (psicólogo) — nós só armazenamos e processamos em seu nome, como
          detalhado na Política de Privacidade. Você pode exportar ou excluir
          esses dados a qualquer momento, respeitado o prazo legal mínimo de 5
          anos de guarda de prontuário (Resolução CFP nº 01/2009).
        </p>
      </Secao>

      <Secao titulo="6. Integração com Google Agenda">
        <p>
          A sincronização com o Google Agenda é opcional e de mão única
          (nosso sistema cria eventos na sua agenda; nunca lemos o que já está
          nela). Você pode revogar essa permissão a qualquer momento, em{" "}
          <Link href="/configuracoes" className="underline">
            Configurações
          </Link>{" "}
          ou diretamente na sua conta Google — a plataforma continua
          funcionando normalmente sem essa integração.
        </p>
      </Secao>

      <Secao titulo="7. Limitação de responsabilidade">
        <p>
          O serviço é fornecido &ldquo;como está&rdquo;. Fazemos esforço razoável pra
          manter a plataforma disponível e os dados seguros, mas não
          garantimos disponibilidade ininterrupta. Falhas pontuais de
          integrações de terceiros (Google, Asaas) não derrubam o
          funcionamento essencial da plataforma — é uma decisão de projeto que
          falha de integração externa nunca impede o uso principal do sistema.
        </p>
      </Secao>

      <Secao titulo="8. Cancelamento e encerramento de conta">
        <p>
          Você pode encerrar sua conta a qualquer momento. Dados sob
          obrigação legal de guarda (prontuário, dentro do prazo de 5 anos)
          permanecem armazenados mesmo após o encerramento, conforme exigido
          por lei, mas deixam de ser acessíveis via login.
        </p>
      </Secao>

      <Secao titulo="9. Alterações destes termos">
        <p>
          Podemos atualizar estes termos conforme o produto evolui. Mudanças
          relevantes serão avisadas por e-mail ou dentro do sistema antes de
          entrarem em vigor.
        </p>
      </Secao>

      <Secao titulo="10. Foro">
        <p>
          Fica eleito o foro da comarca de Torres/RS para dirimir eventuais
          controvérsias decorrentes destes termos.
        </p>
      </Secao>

      <Secao titulo="11. Contato">
        <p>
          <a href="mailto:bernardo.dornelles22@gmail.com" className="underline">
            bernardo.dornelles22@gmail.com
          </a>
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
