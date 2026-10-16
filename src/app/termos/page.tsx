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
          O Gradatim é oferecido por Bernardo Dornelles, pessoa física,
          Torres/RS. Ao
          criar uma conta, você concorda com estes termos e com a nossa{" "}
          <Link href="/privacidade" className="underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </Secao>

      <Secao titulo="2. O que é o serviço">
        <p>
          O Gradatim é uma plataforma de gestão de consultório (agenda,
          prontuário e evolução, financeiro e assinatura) para psicólogos
          autônomos que atendem individualmente. Não atende clínicas com vários
          profissionais. É uma ferramenta de organização e registro: o serviço{" "}
          <strong>não presta atendimento psicológico</strong> e não substitui o
          julgamento clínico do profissional.
        </p>
      </Secao>

      <Secao titulo="3. Cadastro e responsabilidade pela conta">
        <ul className="list-disc space-y-1 pl-5">
          <li>Cada conta é de um único psicólogo e não pode ser compartilhada.</li>
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
            partir do cadastro. Os planos são mensal, trimestral (10% de
            desconto) e semestral (15% de desconto), com os valores mostrados
            na tela de assinatura antes da confirmação.
          </li>
          <li>
            A cobrança é processada pelo Asaas. Você escolhe a forma de
            pagamento (Pix, boleto ou cartão) na página hospedada pelo Asaas, e
            nenhum dado de cartão passa pelos nossos servidores.
          </li>
          <li>
            Com o pagamento em atraso, a conta fica em{" "}
            <strong>modo somente leitura</strong>: você continua vendo e
            exportando pacientes, agenda, prontuário e financeiro, mas não pode
            criar nem editar nada até regularizar. O acesso de leitura nunca é
            bloqueado, para não impedir que você cumpra a obrigação de guarda
            do prontuário.
          </li>
          <li>Você pode cancelar a assinatura a qualquer momento, pela própria plataforma.</li>
          <li>
            Ainda não emitimos nota fiscal, porque isso depende da formalização
            do CNPJ.
          </li>
        </ul>
      </Secao>

      <Secao titulo="5. Seus dados e os dados dos seus pacientes">
        <p>
          Os dados que você cadastra sobre seus pacientes pertencem a você.
          Nós apenas os armazenamos e processamos em seu nome, como explica a
          Política de Privacidade. Você pode exportar ou excluir esses dados a
          qualquer momento, respeitado o prazo mínimo de 5 anos de guarda do
          prontuário (Resolução CFP nº 01/2009).
        </p>
      </Secao>

      <Secao titulo="6. Integração com Google Agenda">
        <p>
          A integração com o Google Agenda é opcional e de mão única: o
          sistema cria eventos na sua agenda e não lê o que já está nela. Você
          pode revogar essa permissão a qualquer momento em{" "}
          <Link href="/configuracoes" className="underline">
            Configurações
          </Link>{" "}
          ou na sua conta Google, e a plataforma continua funcionando sem a
          integração.
        </p>
      </Secao>

      <Secao titulo="7. Limitação de responsabilidade">
        <p>
          O serviço é fornecido &ldquo;como está&rdquo;. Fazemos esforço razoável para
          manter a plataforma disponível e os dados seguros, mas não
          garantimos disponibilidade ininterrupta. A plataforma foi construída
          para que uma falha em serviços de terceiros (Google, Asaas) não
          impeça o uso principal do sistema.
        </p>
      </Secao>

      <Secao titulo="8. Cancelamento e encerramento de conta">
        <p>
          Você pode cancelar a assinatura a qualquer momento, pela própria
          plataforma. Depois do cancelamento, a conta fica em modo somente
          leitura: você continua entrando para consultar e exportar seus
          dados, inclusive o prontuário, que precisa ser guardado por no mínimo
          5 anos (Resolução CFP nº 01/2009). Se quiser a exclusão definitiva da
          conta, fale com a gente pelo contato no fim desta página. Os dados
          sem guarda obrigatória são apagados, e o prontuário é apagado quando
          o prazo legal terminar.
        </p>
      </Secao>

      <Secao titulo="9. Alterações destes termos">
        <p>
          Estes termos podem mudar com o produto. Avisamos mudanças relevantes
          por e-mail ou dentro do sistema antes de entrarem em vigor.
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
