import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Termos de Uso · Singulare',
};

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <header className="border-b border-black/[0.06] bg-white/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/landing">
            <Image
              src="/logos/singulare-a.svg"
              alt="Singulare"
              width={120}
              height={40}
              className="h-7 w-auto"
              priority
            />
          </Link>
          <Link href="/landing" className="text-[13px] font-medium text-zinc-600 hover:text-zinc-900">
            ← Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
        <h1 className="text-[36px] sm:text-[44px] leading-[1.05] tracking-[-0.03em] font-medium text-zinc-900 mb-3">
          Termos de Uso
        </h1>
        <p className="text-[14px] text-zinc-500 mb-10">
          Última atualização: 26 de abril de 2026 · Versão 1.0
        </p>

        <article className="prose prose-zinc max-w-none text-[15px] leading-relaxed text-zinc-700 space-y-5">
          <Section title="1. Aceitação dos termos">
            Ao usar a plataforma Singulare, você concorda com estes Termos de Uso e com a
            Política de Privacidade. Se não concordar, não use o serviço.
          </Section>

          <Section title="2. Descrição do serviço">
            A Singulare é uma plataforma SaaS de automação para profissionais de saúde
            autônomos e clínicas. Inclui agente de inteligência artificial via WhatsApp,
            gestão de agenda integrada com Google Calendar, sistema de cobrança via
            Asaas e CRM de pacientes.
          </Section>

          <Section title="3. Cadastro e responsabilidade">
            Você é responsável pelas informações fornecidas durante o cadastro e por
            manter sigilo de suas credenciais. Profissionais devem garantir que possuem
            registro válido no respectivo conselho de classe.
          </Section>

          <Section title="4. Uso permitido">
            A plataforma deve ser usada exclusivamente para fins profissionais
            relacionados à prestação de serviços de saúde. É proibido usar o serviço
            para atividades ilícitas, envio de spam, ou em violação a normas dos
            conselhos profissionais.
          </Section>

          <Section title="5. Planos e pagamentos">
            A assinatura mensal é cobrada via cartão de crédito de forma recorrente
            através da Asaas. Você pode cancelar a qualquer momento, mantendo acesso
            até o fim do ciclo já pago. Não há reembolso proporcional.
          </Section>

          <Section title="6. Marketplace de cobranças">
            Quando habilitado, o profissional/clínica cria uma subconta Asaas própria
            para receber pagamentos de pacientes. A Singulare não retém valores
            recebidos. Eventuais taxas da Asaas se aplicam às transações.
          </Section>

          <Section title="7. Limitação de responsabilidade">
            A Singulare é uma ferramenta operacional. Decisões clínicas, diagnósticos,
            prescrições ou condutas médicas são responsabilidade exclusiva do
            profissional. O agente IA não substitui consulta nem orientação clínica.
          </Section>

          <Section title="8. Propriedade intelectual">
            A plataforma e seu conteúdo são propriedade da Singulare/Singulare. Os dados
            inseridos pelo usuário (pacientes, profissionais, configurações) permanecem
            de sua propriedade.
          </Section>

          <Section title="9. Modificações">
            Podemos atualizar estes termos a qualquer momento. Mudanças significativas
            serão notificadas por email. O uso continuado após a notificação constitui
            aceite das mudanças.
          </Section>

          <Section title="10. Contato">
            Dúvidas: <a href="mailto:contato@singulare.org" className="underline">contato@singulare.org</a>
          </Section>
        </article>

        <p className="text-[12px] text-zinc-400 mt-12 italic border-t border-black/[0.07] pt-6">
          Este documento é uma versão simplificada para MVP. Recomenda-se revisão por
          assessoria jurídica antes de operação comercial em escala.
        </p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[18px] font-semibold text-zinc-900 mt-6 mb-2">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
