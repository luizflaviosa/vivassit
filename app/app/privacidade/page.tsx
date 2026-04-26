import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Política de Privacidade · Singulare',
};

export default function PrivacidadePage() {
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
          Política de Privacidade
        </h1>
        <p className="text-[14px] text-zinc-500 mb-10">
          Última atualização: 26 de abril de 2026 · Versão 1.0 · Em conformidade com a LGPD
          (Lei nº 13.709/2018)
        </p>

        <article className="prose prose-zinc max-w-none text-[15px] leading-relaxed text-zinc-700 space-y-5">
          <Section title="1. Quem somos">
            <strong>Singulare / Singulare</strong>, controladora dos dados pessoais tratados nesta
            plataforma. Contato do encarregado (DPO):{' '}
            <a href="mailto:dpo@singulare.org" className="underline">dpo@singulare.org</a>
          </Section>

          <Section title="2. Dados que coletamos">
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Profissional cadastrante:</strong> nome, email, telefone, registro profissional, especialidade, dados da clínica</li>
              <li><strong>Pacientes:</strong> nome, telefone, email, histórico de mensagens com a IA, datas de consulta, valores pagos</li>
              <li><strong>Pagamento:</strong> dados processados via Asaas (não armazenamos dados de cartão)</li>
              <li><strong>Uso da plataforma:</strong> logs de acesso, IP, dispositivo</li>
            </ul>
          </Section>

          <Section title="3. Para que usamos">
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Operação da plataforma (atendimento via IA, agendamento, cobranças)</li>
              <li>Suporte ao cliente</li>
              <li>Cumprimento de obrigações legais (notas fiscais, retenção de dados financeiros)</li>
              <li>Análise agregada para melhorar o serviço</li>
            </ul>
          </Section>

          <Section title="4. Base legal (LGPD Art. 7)">
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Execução de contrato</strong> (art. 7, V) — operação do serviço</li>
              <li><strong>Consentimento</strong> (art. 7, I) — registrado durante onboarding com timestamp e IP</li>
              <li><strong>Cumprimento de obrigação legal</strong> (art. 7, II) — fiscal, contábil</li>
              <li><strong>Legítimo interesse</strong> (art. 7, IX) — segurança, prevenção de fraude</li>
            </ul>
          </Section>

          <Section title="5. Compartilhamento">
            Compartilhamos dados estritamente necessários com:
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Asaas</strong> — processador de pagamentos (PCI-DSS)</li>
              <li><strong>Supabase</strong> — banco de dados (servidores em região South America)</li>
              <li><strong>Vercel</strong> — hospedagem da aplicação</li>
              <li><strong>Google Cloud</strong> — Calendar para agendamentos</li>
              <li><strong>OpenAI / Anthropic</strong> — modelos de IA do agente</li>
              <li><strong>Contador da clínica</strong> — quando NF automática habilitada</li>
            </ul>
          </Section>

          <Section title="6. Retenção">
            Mantemos dados enquanto a conta estiver ativa. Após cancelamento, dados pessoais
            de pacientes são anonimizados em 30 dias, exceto quando exigido por lei (ex: dados
            fiscais retidos por 5 anos conforme legislação tributária).
          </Section>

          <Section title="7. Seus direitos (LGPD Art. 18)">
            Você pode solicitar a qualquer momento:
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Confirmação da existência de tratamento</li>
              <li>Acesso aos dados</li>
              <li>Correção de dados incompletos ou desatualizados</li>
              <li>Anonimização ou eliminação de dados desnecessários</li>
              <li>Portabilidade</li>
              <li>Eliminação dos dados pessoais tratados com seu consentimento</li>
              <li>Revogação do consentimento</li>
            </ul>
            Solicitações via:{' '}
            <a href="mailto:dpo@singulare.org" className="underline">dpo@singulare.org</a>
          </Section>

          <Section title="8. Segurança">
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Criptografia em trânsito (TLS 1.3) e em repouso (AES-256)</li>
              <li>Autenticação multi-fator disponível</li>
              <li>Princípio do menor privilégio nas APIs internas</li>
              <li>Logs de auditoria</li>
              <li>Backups diários</li>
            </ul>
          </Section>

          <Section title="9. Cookies">
            Usamos apenas cookies essenciais (sessão de login). Não usamos cookies de
            rastreamento de terceiros nem publicidade.
          </Section>

          <Section title="10. Crianças">
            A plataforma destina-se a profissionais maiores de 18 anos. Pacientes menores
            de idade são responsabilidade do profissional cadastrante (LGPD Art. 14).
          </Section>

          <Section title="11. Alterações">
            Mudanças nesta política serão notificadas por email com 15 dias de antecedência.
          </Section>
        </article>

        <p className="text-[12px] text-zinc-400 mt-12 italic border-t border-black/[0.07] pt-6">
          Este documento é uma versão simplificada para MVP. Recomenda-se revisão por
          assessoria jurídica especializada em LGPD antes de operação comercial em escala.
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
