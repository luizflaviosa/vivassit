import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'A Singulare · Empresa, contato e razão social',
  description:
    'Singulare é uma plataforma SaaS B2B que automatiza o atendimento de clínicas médicas brasileiras via WhatsApp e inteligência artificial. Marca operada por MEDICAL SAO PAULO SERVICOS MEDICOS LTDA (CNPJ 20.247.908/0001-01).',
  alternates: { canonical: 'https://singulare.org/empresa' },
  robots: { index: true, follow: true },
};

const LEGAL = {
  razaoSocial: 'MEDICAL SAO PAULO SERVICOS MEDICOS LTDA',
  cnpj: '20.247.908/0001-01',
  inscricaoMunicipal: '173294',
  endereco: {
    logradouro: 'Rua Capitão Cassiano Ricardo de Toledo',
    numero: '191',
    complemento: 'Sala 306',
    bairro: 'Chácara Urbana',
    cidade: 'Jundiaí',
    uf: 'SP',
    cep: '13201-840',
    pais: 'Brasil',
  },
  telefone: '(17) 3305-9030',
  email: 'paulafranzon@yahoo.com.br',
  emailComercial: 'contato@singulare.org',
};

const FUNDADO_EM = '2014';

export default function EmpresaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Header />

      <main>
        <Hero />
        <SectionDivider />

        <SobreSection />
        <SectionDivider />

        <ProdutosSection />
        <SectionDivider />

        <RazaoSocialSection />
        <SectionDivider />

        <ContatoSection />
        <SectionDivider />

        <ComplianceSection />
      </main>

      <Footer />
    </div>
  );
}

/* ───────────────────────── Header ───────────────────────── */

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight text-foreground"
        >
          Singulare
        </Link>
        <nav className="flex items-center gap-6 text-[13px] text-muted-foreground">
          <Link href="/empresa" className="text-foreground">
            Empresa
          </Link>
          <Link href="/privacidade" className="hover:text-foreground">
            Privacidade
          </Link>
          <Link href="/termos" className="hover:text-foreground">
            Termos
          </Link>
          <a
            href={`mailto:${LEGAL.emailComercial}`}
            className="hidden rounded-full border border-border px-3 py-1.5 text-[12px] text-foreground hover:border-foreground/30 md:inline-block"
          >
            Falar com a Singulare
          </a>
        </nav>
      </div>
    </header>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 pt-24 md:pt-32">
      <p className="mb-6 text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
        Empresa
      </p>
      <h1 className="max-w-3xl text-balance text-[40px] font-semibold leading-[1.1] tracking-tight text-foreground md:text-[56px]">
        A Singulare automatiza o consultório brasileiro — do primeiro contato
        no WhatsApp ao acompanhamento clínico contínuo.
      </h1>
      <p className="mt-8 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
        Plataforma SaaS B2B desenvolvida para clínicas médicas. Combinamos
        atendimento por agente de inteligência artificial, agenda integrada,
        gestão de pagamentos e monitoramento de sinais vitais — em uma única
        operação, com infraestrutura nacional e em conformidade com a LGPD.
      </p>

      <dl className="mt-16 grid grid-cols-2 gap-x-8 gap-y-10 border-t border-border/60 pt-10 md:grid-cols-4">
        <Stat label="Sede" value="Jundiaí · SP" />
        <Stat label="Fundada em" value={FUNDADO_EM} />
        <Stat label="Setor" value="Saúde · SaaS" />
        <Stat label="Atuação" value="Brasil" />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-3 text-[18px] font-medium tracking-tight text-foreground">
        {value}
      </dd>
    </div>
  );
}

/* ───────────────────────── Sobre ───────────────────────── */

function SobreSection() {
  return (
    <Section eyebrow="Sobre" title="O que fazemos">
      <div className="grid gap-12 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6 text-[16px] leading-relaxed text-muted-foreground">
          <p>
            A Singulare é uma plataforma SaaS multi-tenant para o mercado
            brasileiro de saúde. Construímos ferramentas que reduzem a carga
            operacional de médicos, dentistas, psicólogos, fisioterapeutas e
            nutricionistas — devolvendo horas clínicas que hoje se perdem em
            agenda, lembrete, cobrança e organização administrativa.
          </p>
          <p>
            Nosso núcleo é um agente de inteligência artificial que conversa
            com pacientes diretamente no WhatsApp, agenda consultas,
            confirma comparecimento, dispara cobranças via Pix e mantém o
            histórico do paciente sincronizado com o painel da clínica. O
            agente é treinado com regras clínicas customizadas por
            consultório e operado sob supervisão humana via Chatwoot.
          </p>
          <p>
            Para acompanhamento clínico contínuo — especialmente em
            cardiologia preventiva — o Singulare Health integra dados de
            Apple Health e Health Connect ao prontuário, permitindo que o
            médico observe sinais vitais entre consultas sem precisar pedir
            informações ao paciente.
          </p>
        </div>
        <aside className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
          <h3 className="text-[13px] font-medium uppercase tracking-[0.14em] text-foreground">
            Em uma frase
          </h3>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Tornamos o consultório autônomo em operação, sem desumanizá-lo
            no atendimento.
          </p>
        </aside>
      </div>
    </Section>
  );
}

/* ───────────────────────── Produtos ───────────────────────── */

function ProdutosSection() {
  const produtos = [
    {
      nome: 'Singulare Painel',
      kicker: 'Plataforma web',
      desc: 'Agenda, prontuário, financeiro, CRM de pacientes e supervisão do agente IA. Acesso via web, multi-usuário, multi-clínica.',
    },
    {
      nome: 'Singulare WhatsApp',
      kicker: 'Agente IA',
      desc: 'Atendimento conversacional 24/7 no WhatsApp do consultório. Agendamento, confirmação, cobrança e suporte clínico básico.',
    },
    {
      nome: 'Singulare Health',
      kicker: 'App iOS',
      desc: 'Aplicativo para pacientes em programas de RPM (remote patient monitoring). Coleta dados de Apple Health e transmite ao médico responsável.',
    },
  ];

  return (
    <Section eyebrow="Produtos" title="O que oferecemos">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 md:grid-cols-3">
        {produtos.map((p) => (
          <div key={p.nome} className="flex flex-col gap-3 bg-card p-8">
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {p.kicker}
            </span>
            <h3 className="text-[20px] font-medium tracking-tight text-foreground">
              {p.nome}
            </h3>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {p.desc}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────────── Razão Social ───────────────────────── */

function RazaoSocialSection() {
  return (
    <Section eyebrow="Razão social" title="Quem opera a Singulare">
      <div className="grid gap-12 md:grid-cols-2">
        <div className="space-y-6 text-[16px] leading-relaxed text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Singulare</span> é
            uma marca operada por{' '}
            <span className="font-medium text-foreground">
              {LEGAL.razaoSocial}
            </span>
            , pessoa jurídica de direito privado, regularmente inscrita no
            CNPJ sob o nº{' '}
            <span className="font-medium text-foreground">{LEGAL.cnpj}</span>,
            com sede em Jundiaí (SP).
          </p>
          <p>
            Toda relação contratual, faturamento e responsabilidade técnica
            por dados de saúde (LGPD, Lei 13.709/2018) é assumida pela
            referida pessoa jurídica. Apple App Store, Google Play, gateways
            de pagamento e demais terceiros institucionais identificam a
            empresa pela razão social acima.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-8">
          <h3 className="mb-6 text-[13px] font-medium uppercase tracking-[0.14em] text-foreground">
            Dados cadastrais
          </h3>
          <dl className="space-y-4 text-[14px]">
            <Field label="Razão social" value={LEGAL.razaoSocial} />
            <Field label="CNPJ" value={LEGAL.cnpj} />
            <Field
              label="Inscrição municipal"
              value={LEGAL.inscricaoMunicipal}
            />
            <Field label="Sede" value="Jundiaí · São Paulo · Brasil" />
          </dl>
        </div>
      </div>
    </Section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/40 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[15px] tracking-tight text-foreground">{value}</dd>
    </div>
  );
}

/* ───────────────────────── Contato ───────────────────────── */

function ContatoSection() {
  const e = LEGAL.endereco;
  const enderecoCompleto = `${e.logradouro}, ${e.numero}, ${e.complemento} — ${e.bairro}, ${e.cidade} · ${e.uf} · CEP ${e.cep} · ${e.pais}`;

  return (
    <Section eyebrow="Contato" title="Como falar com a Singulare">
      <div className="grid gap-8 md:grid-cols-3">
        <ContactCard
          label="Endereço da sede"
          value={enderecoCompleto}
          href={`https://maps.google.com/?q=${encodeURIComponent(
            enderecoCompleto
          )}`}
          hrefLabel="Abrir no Google Maps"
        />
        <ContactCard
          label="Telefone"
          value={LEGAL.telefone}
          href={`tel:+55${LEGAL.telefone.replace(/\D/g, '')}`}
          hrefLabel="Ligar"
        />
        <ContactCard
          label="E-mail comercial"
          value={LEGAL.emailComercial}
          href={`mailto:${LEGAL.emailComercial}`}
          hrefLabel="Enviar mensagem"
        />
        <ContactCard
          label="E-mail responsável legal"
          value={LEGAL.email}
          href={`mailto:${LEGAL.email}`}
          hrefLabel="Enviar mensagem"
        />
        <ContactCard
          label="Suporte clínicas"
          value="Via WhatsApp na própria plataforma"
          href="/painel"
          hrefLabel="Acessar painel"
        />
        <ContactCard
          label="Imprensa"
          value={LEGAL.emailComercial}
          href={`mailto:${LEGAL.emailComercial}?subject=Imprensa`}
          hrefLabel="Solicitar pauta"
        />
      </div>
    </Section>
  );
}

function ContactCard({
  label,
  value,
  href,
  hrefLabel,
}: {
  label: string;
  value: string;
  href: string;
  hrefLabel: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-6">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <p className="text-[15px] leading-relaxed text-foreground">{value}</p>
      </div>
      <a
        href={href}
        className="mt-6 inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
      >
        {hrefLabel}
        <span aria-hidden>→</span>
      </a>
    </div>
  );
}

/* ───────────────────────── Compliance ───────────────────────── */

function ComplianceSection() {
  return (
    <Section eyebrow="Compliance" title="Como tratamos dados de saúde">
      <div className="grid gap-12 md:grid-cols-2">
        <div className="space-y-6 text-[16px] leading-relaxed text-muted-foreground">
          <p>
            A Singulare processa dados pessoais e dados pessoais sensíveis de
            saúde com base na Lei nº 13.709/2018 (LGPD) e em sintonia com a
            Resolução CFM nº 2.314/2022. Atuamos como operador ou controlador
            conjunto, conforme o contexto, e mantemos contratos de
            tratamento de dados com os profissionais de saúde clientes.
          </p>
          <p>
            Aplicativos da família Singulare disponíveis em App Store e
            Google Play seguem as políticas dessas lojas — em especial os
            requisitos de HealthKit, Health Connect, transparência de uso de
            dados e remoção sob solicitação.
          </p>
          <p>
            O usuário final pode, a qualquer momento, revogar o
            consentimento, solicitar acesso aos seus dados ou requerer
            eliminação completa por meio do{' '}
            <a
              href={`mailto:${LEGAL.emailComercial}`}
              className="text-foreground underline-offset-4 hover:underline"
            >
              {LEGAL.emailComercial}
            </a>
            .
          </p>
        </div>

        <div className="space-y-3">
          <PolicyLink
            href="/privacidade"
            title="Política de Privacidade"
            desc="Como coletamos, tratamos e armazenamos dados pessoais."
          />
          <PolicyLink
            href="/termos"
            title="Termos de Uso"
            desc="Condições contratuais para clínicas e profissionais."
          />
          <PolicyLink
            href="/privacidade#saude"
            title="Política específica — Singulare Health"
            desc="Tratamento de dados clínicos via Apple Health e Health Connect."
          />
        </div>
      </div>
    </Section>
  );
}

function PolicyLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-6 rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-foreground/30"
    >
      <div>
        <h4 className="text-[15px] font-medium tracking-tight text-foreground">
          {title}
        </h4>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {desc}
        </p>
      </div>
      <span
        aria-hidden
        className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground"
      >
        →
      </span>
    </Link>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function Footer() {
  const e = LEGAL.endereco;
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2 space-y-4">
            <p className="text-[15px] font-semibold tracking-tight text-foreground">
              Singulare
            </p>
            <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
              Singulare é uma marca operada por {LEGAL.razaoSocial}, CNPJ{' '}
              {LEGAL.cnpj}. Sede em {e.cidade} · {e.uf} · {e.pais}. Plataforma
              SaaS para clínicas médicas brasileiras.
            </p>
          </div>

          <div className="space-y-3 text-[13px] text-muted-foreground">
            <p className="text-foreground">Endereço</p>
            <address className="not-italic leading-relaxed">
              {e.logradouro}, {e.numero}
              <br />
              {e.complemento} — {e.bairro}
              <br />
              {e.cidade} · {e.uf} · CEP {e.cep}
              <br />
              {e.pais}
            </address>
          </div>

          <div className="space-y-3 text-[13px] text-muted-foreground">
            <p className="text-foreground">Contato</p>
            <p className="leading-relaxed">
              <a
                href={`mailto:${LEGAL.emailComercial}`}
                className="block hover:text-foreground"
              >
                {LEGAL.emailComercial}
              </a>
              <a
                href={`tel:+55${LEGAL.telefone.replace(/\D/g, '')}`}
                className="block hover:text-foreground"
              >
                {LEGAL.telefone}
              </a>
            </p>
            <p className="pt-3">
              <Link
                href="/privacidade"
                className="block hover:text-foreground"
              >
                Privacidade
              </Link>
              <Link href="/termos" className="block hover:text-foreground">
                Termos
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-16 border-t border-border/40 pt-8 text-[12px] text-muted-foreground">
          © {new Date().getFullYear()} {LEGAL.razaoSocial} · Todos os
          direitos reservados.
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── Helpers ───────────────────────── */

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:py-28">
      <p className="mb-4 text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mb-12 max-w-3xl text-balance text-[32px] font-semibold leading-[1.1] tracking-tight text-foreground md:text-[40px]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SectionDivider() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <div className="border-t border-border/60" />
    </div>
  );
}
