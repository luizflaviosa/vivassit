import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import {
  MessageCircle,
  Calendar,
  CreditCard,
  Bell,
  FileText,
  FlaskConical,
  Heart,
  Sparkles,
  Shield,
  Clock,
  CheckCircle2,
  Mail,
  Phone,
  LayoutDashboard,
} from 'lucide-react';

export const metadata = {
  title: 'Guia rápido · Singulare',
  description: 'Como funciona sua secretária IA e respostas pras dúvidas mais comuns.',
};

// ──────────────────────────────────────────────────────────────────────────────
// Design tokens — consistent with onboarding/page.tsx
// ──────────────────────────────────────────────────────────────────────────────

const ACCENT = '#0F1B33';
const ACCENT_DEEP = '#0F1B33';
const ACCENT_SOFT = '#F5F3FF';

const SUPPORT_WHATSAPP_DISPLAY = '(11) 98939-0155';
const SUPPORT_WHATSAPP_URL = 'https://wa.me/5511989390155';
const SUPPORT_EMAIL = 'contato@singulare.org';

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────

export default function BemVindoPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF7] text-zinc-900">
      {/* Top bar */}
      <header className="border-b border-black/[0.06] bg-white/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/landing" className="flex items-center">
            <Image
              src="/logos/singulare-a.svg"
              alt="Singulare"
              width={120}
              height={40}
              className="h-10 sm:h-11 w-auto"
              priority
            />
          </Link>
          <Link
            href="/painel"
            className="text-[13px] font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Ir para o painel →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-16">
        {/* Hero */}
        <section className="text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium mb-6"
            style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            Guia rápido
          </div>
          <h1 className="text-[40px] sm:text-[52px] leading-[1.05] tracking-[-0.03em] font-medium text-zinc-900 mb-4">
            Sua clínica, no piloto automático.
          </h1>
          <p className="text-[16px] sm:text-[17px] text-zinc-600 max-w-2xl mx-auto leading-relaxed">
            Aqui está tudo que você precisa saber pra começar.
          </p>
        </section>

        {/* Como a IA atende */}
        <Section
          eyebrow="Como a IA atende"
          title="Profissional, com o seu jeito"
          description="A IA fala em nome da sua clínica, segue regras claras e sabe quando chamar você."
        >
          <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
            <Card
              icon={<MessageCircle className="w-4 h-4" strokeWidth={1.75} />}
              title="Tom"
              body="Atendimento simpático, direto e profissional. Sem gírias, sem promessas médicas. Adapta-se à sua especialidade."
            />
            <Card
              icon={<Shield className="w-4 h-4" strokeWidth={1.75} />}
              title="Escopo"
              body="Marca, remarca, cobra, envia lembretes e responde dúvidas operacionais. Nunca dá diagnóstico nem prescreve."
            />
            <Card
              icon={<Bell className="w-4 h-4" strokeWidth={1.75} />}
              title="Escalação"
              body="Se o paciente pedir um humano, urgência aparente ou tema sensível, a IA pausa e chama você imediatamente."
            />
          </div>
        </Section>

        {/* Funcionalidades */}
        <Section
          eyebrow="Funcionalidades principais"
          title="O que a Singulare faz por você"
          description="Tudo integrado, sem você precisar gerenciar várias ferramentas."
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Card
              icon={<Calendar className="w-4 h-4" strokeWidth={1.75} />}
              title="Agenda"
              body="Sincronizada com o Google Calendar. A IA agenda nos seus horários disponíveis automaticamente."
            />
            <Card
              icon={<CreditCard className="w-4 h-4" strokeWidth={1.75} />}
              title="Cobrança"
              body="Pix, cartão ou boleto via Asaas. Link enviado pelo WhatsApp na hora ou após a consulta."
            />
            <Card
              icon={<Bell className="w-4 h-4" strokeWidth={1.75} />}
              title="Lembretes"
              body="24h antes e 1h antes da consulta. Confirma presença e libera horário se o paciente cancelar."
            />
            <Card
              icon={<FileText className="w-4 h-4" strokeWidth={1.75} />}
              title="Nota fiscal"
              body="Emissão automática após pagamento confirmado. NF enviada por email pro paciente e contador."
            />
            <Card
              icon={<FlaskConical className="w-4 h-4" strokeWidth={1.75} />}
              title="Exames"
              body="Paciente envia exame pelo WhatsApp, a IA arquiva no Drive da clínica e te avisa do upload."
            />
            <Card
              icon={<Heart className="w-4 h-4" strokeWidth={1.75} />}
              title="NPS"
              body="Pesquisa de satisfação automática depois da consulta. Você acompanha a nota no painel."
            />
          </div>
        </Section>

        {/* Primeiros passos */}
        <Section
          eyebrow="Primeiros passos"
          title="5 minutos pra deixar tudo redondo"
          description="Faz esses passos antes do primeiro paciente. Depois é só deixar a IA trabalhar."
        >
          <div className="rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            <ChecklistItem
              number={1}
              title="Confirme o WhatsApp da clínica"
              body="Escaneie o QR Code (ou use o código de pareamento) para conectar a Evolution. Aparece no seu painel."
            />
            <ChecklistItem
              number={2}
              title="Revise seus horários de atendimento"
              body="No painel, em Configurações → Agenda, ajuste dias, horários e duração da consulta."
            />
            <ChecklistItem
              number={3}
              title="Confirme valor e métodos de cobrança"
              body="Defina valor da consulta, formas aceitas (Pix, cartão, boleto) e quando cobrar — antes ou depois."
            />
            <ChecklistItem
              number={4}
              title="Personalize o prompt da IA"
              body="Em Configurações → Assistente IA, ajuste o tom e adicione regras específicas do seu atendimento."
            />
            <ChecklistItem
              number={5}
              title="Faça um teste no seu próprio WhatsApp"
              body="Mande mensagem pra clínica como se fosse paciente. Veja se a IA responde como você espera."
              last
            />
          </div>
        </Section>

        {/* Q&A */}
        <Section
          eyebrow="Q&A"
          title="Situações comuns"
          description="As 12 perguntas que mais aparecem. Clique pra expandir."
        >
          <div className="space-y-2">
            <Faq question="Como pausar a IA num atendimento que quero assumir?">
              No painel de conversas (Chatwoot), abra a conversa e clique em
              &quot;Atribuir a mim&quot;. A IA pausa automaticamente quando você
              entra. Para retomar, basta sair da conversa ou marcar como resolvida.
            </Faq>

            <Faq question="Como ver o histórico de conversa de um paciente?">
              No painel, vá em Pacientes, busque pelo nome ou telefone e clique
              no card. O histórico completo aparece na lateral direita, com todas
              as mensagens e agendamentos anteriores.
            </Faq>

            <Faq question="Posso alterar o tom/jeito que a IA fala?">
              Sim. Em Configurações → Assistente IA, você edita o prompt base e
              adiciona instruções específicas. Alterações entram em vigor na próxima
              mensagem recebida.
            </Faq>

            <Faq question="E se a IA agendar errado?">
              Se houve confusão, basta ir até a agenda no painel, editar o horário
              ou cancelar. A IA notifica o paciente automaticamente. Se virar
              padrão, ajuste as regras no prompt — ou nos avise para investigar.
            </Faq>

            <Faq question="Como ajusto meus horários de atendimento?">
              Vá em Configurações → Agenda. Você define dias da semana, horários
              de início e fim, duração da consulta e intervalos. A IA passa a
              respeitar isso na hora de oferecer encaixes.
            </Faq>

            <Faq question="Como funciona a cobrança via WhatsApp?">
              Quando a consulta é confirmada, a IA gera um link Asaas (Pix,
              cartão ou boleto) e envia automaticamente. Você escolhe se cobra
              antes ou depois da consulta — e pode pedir só uma porcentagem
              como reserva.
            </Faq>

            <Faq question="E se o paciente quiser cancelar a consulta?">
              O próprio paciente avisa pelo WhatsApp. A IA confirma o cancelamento,
              libera o horário na agenda e avisa você. Se a cobrança foi feita
              antes, a política de reembolso é a que você definiu.
            </Faq>

            <Faq question="A IA atende fora do horário?">
              Sim. A IA está ativa 24/7 pra agendar, responder dúvidas
              operacionais e enviar lembretes. Fora do seu horário comercial,
              ela oferece encaixes só dentro dos dias e horários configurados.
            </Faq>

            <Faq question="Como pedir suporte humano da Singulare?">
              Responde no WhatsApp {SUPPORT_WHATSAPP_DISPLAY} — nosso time
              responde de seg a sex, 9h às 18h. Para urgências fora do horário,
              deixe mensagem que retornamos rápido.
            </Faq>

            <Faq question="Como cancelar minha assinatura?">
              Em Configurações → Assinatura, no painel, tem o botão de cancelar.
              Você mantém o acesso até o fim do ciclo já pago, e os dados ficam
              guardados por 90 dias caso queira voltar.
            </Faq>

            <Faq question="Meus dados estão seguros? (LGPD)">
              Sim. Estamos em conformidade com a LGPD: dados são criptografados,
              armazenados no Brasil (Supabase) e nunca compartilhados sem
              autorização. Você é o controlador dos dados dos seus pacientes.
            </Faq>

            <Faq question="A IA pode dar diagnóstico médico?">
              Não. A IA nunca dá diagnósticos, prescreve medicamentos ou
              interpreta exames. Se o paciente pedir, ela orienta a buscar
              avaliação profissional e oferece um agendamento com você.
            </Faq>
          </div>
        </Section>

        {/* Quando chamar a gente */}
        <Section
          eyebrow="Suporte"
          title="Quando chamar a gente"
          description="Esses são os canais oficiais. Use o que for mais prático."
        >
          <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
            <ContactCard
              icon={<Phone className="w-4 h-4" strokeWidth={1.75} />}
              title="WhatsApp"
              value={SUPPORT_WHATSAPP_DISPLAY}
              hint="Seg a sex, 9h às 18h"
              href={SUPPORT_WHATSAPP_URL}
            />
            <ContactCard
              icon={<Mail className="w-4 h-4" strokeWidth={1.75} />}
              title="Email"
              value={SUPPORT_EMAIL}
              hint="Resposta em até 1 dia útil"
              href={`mailto:${SUPPORT_EMAIL}`}
            />
            <ContactCard
              icon={<LayoutDashboard className="w-4 h-4" strokeWidth={1.75} />}
              title="Painel"
              value="app.singulare.org/painel"
              hint="Configurações, conversas e relatórios"
              href="/painel"
            />
          </div>
        </Section>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/[0.06] bg-white/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[12px] text-zinc-500">
            © {new Date().getFullYear()} Singulare · Sua secretária IA
          </div>
          <nav className="flex items-center gap-5 text-[13px] text-zinc-600">
            <Link href="/painel" className="hover:text-zinc-900 transition-colors">
              Painel
            </Link>
            <Link href="/termos" className="hover:text-zinc-900 transition-colors">
              Termos
            </Link>
            <Link href="/privacidade" className="hover:text-zinc-900 transition-colors">
              Privacidade
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Building blocks
// ──────────────────────────────────────────────────────────────────────────────

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-6 sm:mb-8">
        <p
          className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-2"
          style={{ color: ACCENT_DEEP }}
        >
          {eyebrow}
        </p>
        <h2 className="text-[26px] sm:text-[32px] leading-[1.1] tracking-[-0.02em] font-medium text-zinc-900 mb-2">
          {title}
        </h2>
        {description && (
          <p className="text-[15px] text-zinc-600 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Card({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6">
      <div
        className="h-8 w-8 rounded-lg flex items-center justify-center mb-4"
        style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
      >
        {icon}
      </div>
      <h3 className="text-[15px] sm:text-[16px] font-medium text-zinc-900 mb-1.5">
        {title}
      </h3>
      <p className="text-[14px] text-zinc-600 leading-relaxed">{body}</p>
    </div>
  );
}

function ChecklistItem({
  number,
  title,
  body,
  last,
}: {
  number: number;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-4 px-5 sm:px-6 py-4 sm:py-5 ${
        last ? '' : 'border-b border-black/[0.05]'
      }`}
    >
      <div
        className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-semibold"
        style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
      >
        {number}
      </div>
      <div className="min-w-0">
        <h4 className="text-[15px] font-medium text-zinc-900 mb-0.5">{title}</h4>
        <p className="text-[14px] text-zinc-600 leading-relaxed">{body}</p>
      </div>
      <CheckCircle2
        className="shrink-0 w-4 h-4 mt-1 text-zinc-300"
        strokeWidth={1.75}
      />
    </div>
  );
}

function Faq({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
      <summary className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 cursor-pointer list-none select-none">
        <span className="text-[15px] font-medium text-zinc-900">{question}</span>
        <span
          className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[16px] leading-none font-light transition-transform group-open:rotate-45"
          style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
          aria-hidden
        >
          +
        </span>
      </summary>
      <div className="px-5 sm:px-6 pb-5 text-[14px] text-zinc-600 leading-relaxed border-t border-black/[0.05] pt-4">
        {children}
      </div>
    </details>
  );
}

function ContactCard({
  icon,
  title,
  value,
  hint,
  href,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  hint: string;
  href: string;
}) {
  const external = href.startsWith('http') || href.startsWith('mailto:');
  const Wrapper = ({ children }: { children: ReactNode }) =>
    external ? (
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="block"
      >
        {children}
      </a>
    ) : (
      <Link href={href} className="block">
        {children}
      </Link>
    );

  return (
    <Wrapper>
      <div className="rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-black/[0.1]">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center mb-4"
          style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
        >
          {icon}
        </div>
        <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-400 font-medium mb-1">
          {title}
        </p>
        <p
          className="text-[15px] font-medium mb-1"
          style={{ color: ACCENT_DEEP }}
        >
          {value}
        </p>
        <p className="text-[13px] text-zinc-500">{hint}</p>
      </div>
    </Wrapper>
  );
}
