import type { Metadata } from 'next';
import Image from 'next/image';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

const URL_CANONICA = 'https://singulare.org/guias/visibilidade-digital-clinicas';
const OG_IMAGE = 'https://singulare.org/og-singulare.png';
const PUBLICADO_EM = '2026-05-16';
const ATUALIZADO_EM = '2026-05-16';

export const metadata: Metadata = {
  title: 'Visibilidade digital para clínicas: o guia completo com dados',
  description:
    'Por que o paciente brasileiro não te encontra, o que decide a escolha, e como construir presença sem violar a ética profissional. Os cinco pilares, dados reais e seis métricas que importam.',
  keywords: [
    'marketing para clínicas',
    'visibilidade digital médico',
    'marketing digital saúde',
    'Google Meu Negócio clínica',
    'Doctoralia',
    'SEO local médico',
    'marketing ético médico',
    'CFM publicidade',
    'KPIs clínica',
    'CPA paciente novo',
  ],
  alternates: { canonical: URL_CANONICA },
  openGraph: {
    type: 'article',
    url: URL_CANONICA,
    title: 'Visibilidade digital para clínicas — o guia completo',
    description:
      'O caminho silencioso que conduz o paciente até a sua porta, em quinze minutos de leitura.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Singulare · Guia de visibilidade digital' }],
    publishedTime: `${PUBLICADO_EM}T00:00:00Z`,
    modifiedTime: `${ATUALIZADO_EM}T00:00:00Z`,
    authors: ['Singulare'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Visibilidade digital para clínicas — o guia completo',
    description: 'Por que o paciente não te encontra. E o que fazer a respeito.',
    images: [OG_IMAGE],
  },
};

const FAQ = [
  {
    q: 'O que é visibilidade digital para uma clínica?',
    a: 'É a soma do que aparece no Google, no Doctoralia, no Instagram e no site quando alguém procura por sua especialidade, sua cidade ou o seu nome. Mede-se em cinco pilares — Google Meu Negócio, Doctoralia, redes sociais, SEO/site e operacional — e cada um pesa uma fatia da decisão silenciosa que o paciente toma antes de fazer o primeiro contato.',
  },
  {
    q: 'É ético um médico ou profissional de saúde fazer marketing?',
    a: 'Sim, dentro dos limites da Resolução CFM 1.974/2011 (e equivalentes nos demais conselhos). É proibido sensacionalismo, comparação direta com concorrentes e garantia de resultado. É permitido — e cada vez mais necessário — manter presença ativa nos canais onde o paciente pesquisa, oferecendo informação educativa, perfil verificado e canais de agendamento que funcionam.',
  },
  {
    q: 'Qual é o peso de cada pilar de visibilidade?',
    a: 'No score composto da Singulare, Google Meu Negócio pesa 30%, redes sociais 20%, SEO/site 20%, Doctoralia 15% e operacional (NPS, taxa de agendamento, tempo de resposta) 15%. A soma dá um score de 0 a 100 que indica em quais pilares a clínica está saudável e em quais está sangrando.',
  },
  {
    q: 'Quanto custa em média um paciente novo via Google Ads no Brasil?',
    a: 'O CPC (custo por clique) em especialidades de saúde varia entre R$ 4 e R$ 12. A taxa de conversão típica de clique para agendamento fica entre 4% e 8%. Combinando os dois, o CPA (custo por aquisição) por paciente novo costuma cair entre R$ 80 e R$ 280, dependendo da especialidade, da região e da maturidade da campanha.',
  },
  {
    q: 'O que é mais importante: tráfego orgânico ou pago?',
    a: 'A pergunta correta não é qual escolher, mas qual proporção. O tráfego orgânico (SEO, Google Meu Negócio, conteúdo) é lento como árvore — leva três a seis meses para frutificar e depois alimenta por anos. O pago (Google Ads, Meta Ads) é veloz como fogo — gera resultado em vinte e quatro horas e para no instante em que o orçamento acaba.',
  },
  {
    q: 'Quais métricas uma clínica deve acompanhar toda semana?',
    a: 'Seis bastam: impressões no Google, cliques úteis (chamada, rota, site), brand search (volume de buscas pelo seu nome), taxa de agendamento, NPS e o score composto de visibilidade digital. Painéis com quarenta métricas não geram clareza — geram sensação de controle.',
  },
  {
    q: 'Como começar do zero a construir visibilidade digital?',
    a: 'Pela base: verificar e completar o Google Meu Negócio (foto, horário, descrição, telefone), criar ou verificar o perfil no Doctoralia, garantir um site mobile-first com SSL, e estabelecer uma rotina semanal de publicação simples nas redes. Esses quatro movimentos cobrem mais de 80% do que rankeia em busca local na saúde.',
  },
  {
    q: 'O que diferencia marketing promocional de marketing da presença?',
    a: 'Marketing promocional força confiança — anúncios chamativos, promessas, comparações. Marketing da presença oferece valor para ser encontrado — perfil completo, conteúdo educativo, canais que funcionam quando alguém precisa. O primeiro corrói a relação médico-paciente; o segundo a sustenta.',
  },
];

function ArticleSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Visibilidade digital para clínicas: o guia completo com dados',
    description:
      'Por que o paciente brasileiro não te encontra, o que decide a escolha, e como construir presença sem violar a ética profissional.',
    image: OG_IMAGE,
    datePublished: PUBLICADO_EM,
    dateModified: ATUALIZADO_EM,
    author: { '@type': 'Organization', name: 'Singulare', url: 'https://singulare.org' },
    publisher: {
      '@type': 'Organization',
      name: 'Singulare',
      logo: { '@type': 'ImageObject', url: 'https://singulare.org/logos/singulare-a.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': URL_CANONICA },
    inLanguage: 'pt-BR',
    articleSection: 'Marketing em Saúde',
    wordCount: 5400,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function FaqSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function BreadcrumbSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://singulare.org' },
      { '@type': 'ListItem', position: 2, name: 'Guias', item: 'https://singulare.org/guias' },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Visibilidade digital para clínicas',
        item: URL_CANONICA,
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function AlternateLink() {
  return (
    <link
      rel="alternate"
      type="text/html"
      media="print"
      href="https://singulare.org/ebook/visibilidade-digital"
      title="Versão imprimível"
    />
  );
}

function Eyebrow({ children, color = ACCENT_DEEP }: { children: React.ReactNode; color?: string }) {
  return (
    <p
      className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-4"
      style={{ color }}
    >
      {children}
    </p>
  );
}

function Hairline({ className = '' }: { className?: string }) {
  return <div className={`h-px w-full bg-black/[0.08] ${className}`} />;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[17px] leading-[1.75] text-zinc-700 mb-5">{children}</p>;
}

function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="text-[32px] sm:text-[36px] leading-[1.15] tracking-[-0.02em] font-medium text-zinc-900 mt-16 mb-6"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[22px] leading-[1.25] tracking-[-0.015em] font-semibold text-zinc-900 mt-12 mb-4">
      {children}
    </h3>
  );
}

function PullQuote({ children, author }: { children: React.ReactNode; author?: string }) {
  return (
    <figure className="my-10 pl-6 border-l-2" style={{ borderColor: ACCENT }}>
      <blockquote className="text-[22px] leading-[1.45] font-serif italic text-zinc-800">
        {children}
      </blockquote>
      {author && (
        <figcaption className="mt-3 text-[13px] uppercase tracking-[0.14em] text-zinc-500 not-italic">
          {author}
        </figcaption>
      )}
    </figure>
  );
}

function PillaresChart() {
  const pilares = [
    { nome: 'Google Meu Negócio', peso: 30 },
    { nome: 'Redes sociais', peso: 20 },
    { nome: 'SEO e site', peso: 20 },
    { nome: 'Doctoralia', peso: 15 },
    { nome: 'Operacional', peso: 15 },
  ];
  return (
    <figure
      className="my-10 rounded-2xl border border-black/[0.07] bg-white p-6 sm:p-8"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
    >
      <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400 font-medium mb-5">
        Peso de cada pilar no score de visibilidade
      </p>
      <div className="space-y-4">
        {pilares.map(p => (
          <div key={p.nome} className="flex items-center gap-4">
            <div className="text-[13px] text-zinc-700 w-[180px] shrink-0">{p.nome}</div>
            <div className="flex-1 h-[10px] rounded-full bg-black/[0.05] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(p.peso / 30) * 100}%`,
                  background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DEEP})`,
                }}
              />
            </div>
            <div className="text-[13px] font-semibold text-zinc-900 tabular-nums w-[40px] text-right">
              {p.peso}%
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-5 text-[12px] text-zinc-500 leading-relaxed">
        Score composto Singulare. A soma dá 100 e indica a saúde da presença digital de uma clínica.
      </figcaption>
    </figure>
  );
}

function ArvoreFogo() {
  return (
    <figure
      className="my-10 rounded-2xl border border-black/[0.07] bg-white p-6 sm:p-8"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
    >
      <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400 font-medium mb-5">
        Dois ritmos opostos
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <svg viewBox="0 0 240 120" className="w-full h-auto" aria-hidden>
            <defs>
              <linearGradient id="organicGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.18" />
                <stop offset="100%" stopColor={ACCENT_DEEP} stopOpacity="0.55" />
              </linearGradient>
            </defs>
            <path
              d="M0,110 Q60,108 90,98 T160,68 T240,12"
              fill="none"
              stroke={ACCENT_DEEP}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M0,110 Q60,108 90,98 T160,68 T240,12 L240,120 L0,120 Z"
              fill="url(#organicGrad)"
            />
          </svg>
          <p className="text-[14px] font-semibold text-zinc-900 mt-3 mb-1">Orgânico — árvore</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed">
            Três a seis meses até frutificar. Depois alimenta por anos, com custo marginal próximo
            de zero por paciente novo.
          </p>
        </div>
        <div>
          <svg viewBox="0 0 240 120" className="w-full h-auto" aria-hidden>
            <defs>
              <linearGradient id="pagoGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#18181b" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#18181b" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <path
              d="M0,110 L20,40 L40,30 L60,30 L80,90 L100,110 L240,110"
              fill="none"
              stroke="#18181b"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M0,110 L20,40 L40,30 L60,30 L80,90 L100,110 L240,110 L240,120 L0,120 Z"
              fill="url(#pagoGrad)"
            />
          </svg>
          <p className="text-[14px] font-semibold text-zinc-900 mt-3 mb-1">Pago — fogo</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed">
            Vinte e quatro horas até o primeiro paciente. Para no instante em que o orçamento acaba.
            CPC entre R$ 4 e R$ 12 em saúde.
          </p>
        </div>
      </div>
    </figure>
  );
}

function KPIBoard() {
  const kpis = [
    { n: '01', nome: 'Impressões no Google', exemplo: '4.812 / mês' },
    { n: '02', nome: 'Cliques úteis', exemplo: '127 · +18%' },
    { n: '03', nome: 'Brand search', exemplo: '210 buscas / mês' },
    { n: '04', nome: 'Taxa de agendamento', exemplo: '47%' },
    { n: '05', nome: 'NPS', exemplo: '72 · promotor' },
    { n: '06', nome: 'Score Singulare', exemplo: '68 / 100' },
  ];
  return (
    <figure
      className="my-10 rounded-2xl border border-black/[0.07] bg-white p-6 sm:p-8"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
    >
      <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400 font-medium mb-5">
        Os seis números que importam
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map(k => (
          <div
            key={k.n}
            className="rounded-xl border border-black/[0.06] p-4"
            style={{ background: ACCENT_SOFT }}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <span
                className="text-[10px] uppercase tracking-[0.14em] font-semibold"
                style={{ color: ACCENT_DEEP }}
              >
                {k.n}
              </span>
              <span className="text-[13px] font-semibold text-zinc-900 tracking-tight">
                {k.nome}
              </span>
            </div>
            <p
              className="text-[14px] font-mono tabular-nums"
              style={{ color: ACCENT_DEEP }}
            >
              {k.exemplo}
            </p>
          </div>
        ))}
      </div>
      <figcaption className="mt-5 text-[12px] text-zinc-500 leading-relaxed">
        Atualizados a cada vinte e quatro horas no painel Singulare, extraídos de Google, Doctoralia,
        Instagram e operação.
      </figcaption>
    </figure>
  );
}

function AsideStats({ items }: { items: { value: string; label: string }[] }) {
  return (
    <aside
      className="my-10 rounded-2xl p-6 sm:p-8 border"
      style={{ background: ACCENT_SOFT, borderColor: 'rgba(110,86,207,0.18)' }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {items.map((it, i) => (
          <div key={i}>
            <p
              className="text-[28px] sm:text-[32px] font-medium tracking-[-0.02em] tabular-nums"
              style={{ color: ACCENT_DEEP }}
            >
              {it.value}
            </p>
            <p className="text-[13px] text-zinc-600 leading-tight mt-1">{it.label}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function GuiaVisibilidadeDigital() {
  return (
    <>
      <ArticleSchema />
      <FaqSchema />
      <BreadcrumbSchema />
      <AlternateLink />

      <article className="bg-[#FAFAF7] text-zinc-900 selection:bg-zinc-900 selection:text-white">
        {/* HEADER ===================================== */}
        <header className="max-w-[1100px] mx-auto px-6 sm:px-10 pt-10 pb-6 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-[14px]"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
            >
              S
            </div>
            <span className="text-[13px] font-medium tracking-tight text-zinc-900">Singulare</span>
          </a>
          <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-medium">
            Guia · Edição 02
          </span>
        </header>

        {/* HERO ===================================== */}
        <section className="max-w-[1100px] mx-auto px-6 sm:px-10 pt-8 pb-12">
          <div className="max-w-[820px]">
            <Eyebrow>Marketing em saúde · 18 min de leitura</Eyebrow>
            <h1 className="text-[44px] sm:text-[64px] leading-[0.98] tracking-[-0.035em] font-medium text-zinc-900 mb-6">
              Visibilidade digital
              <br />
              <span className="font-serif italic font-normal text-zinc-700">para clínicas.</span>
            </h1>
            <p className="text-[20px] sm:text-[22px] leading-[1.5] text-zinc-600 max-w-[680px]">
              Um guia sobre o caminho silencioso que conduz o paciente até a sua porta. O que decide
              a escolha. E o que, com método e sem fé, se pode fazer a respeito.
            </p>
          </div>

          {/* Hero image (LCP candidate — priority + sizes responsive) */}
          <div className="mt-12 relative w-full aspect-[21/9] overflow-hidden rounded-3xl bg-zinc-100">
            <Image
              src="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=2000&q=80&auto=format&fit=crop"
              alt="Profissional de saúde em ambiente clínico moderno, iluminação suave, atmosfera de cuidado"
              fill
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1280px"
              className="object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.25) 100%)',
              }}
            />
          </div>

          {/* Meta line */}
          <div className="mt-6 flex items-center gap-4 text-[12px] text-zinc-500 flex-wrap">
            <span>Por <span className="text-zinc-900 font-medium">Singulare</span></span>
            <span className="text-zinc-300">·</span>
            <time dateTime={PUBLICADO_EM}>Maio de 2026</time>
            <span className="text-zinc-300">·</span>
            <span>Atualizado em {new Date(ATUALIZADO_EM).toLocaleDateString('pt-BR')}</span>
          </div>
        </section>

        <div className="max-w-[1100px] mx-auto px-6 sm:px-10">
          <Hairline />
        </div>

        {/* SUMÁRIO ================================== */}
        <nav
          className="max-w-[1100px] mx-auto px-6 sm:px-10 py-10"
          aria-label="Sumário"
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-medium mb-4">
            Neste guia
          </p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[14px] text-zinc-700">
            <li><a href="#capitulo-1" className="hover:text-zinc-900 transition">1. O médico que detestava marketing</a></li>
            <li><a href="#capitulo-2" className="hover:text-zinc-900 transition">2. Os cinco pilares que decidem quem é encontrado</a></li>
            <li><a href="#capitulo-3" className="hover:text-zinc-900 transition">3. Orgânico planta. Pago colhe.</a></li>
            <li><a href="#capitulo-4" className="hover:text-zinc-900 transition">4. Seis números bastam</a></li>
            <li><a href="#capitulo-5" className="hover:text-zinc-900 transition">5. Onde isso leva</a></li>
            <li><a href="#perguntas" className="hover:text-zinc-900 transition">Perguntas frequentes</a></li>
          </ol>
        </nav>

        {/* BODY ===================================== */}
        <div className="max-w-[1100px] mx-auto px-6 sm:px-10 pb-24">
          <div className="max-w-[680px] mx-auto">

            {/* ============ CAPÍTULO 1 ============ */}
            <section id="capitulo-1">
              <Eyebrow>Capítulo 1 · A relutância</Eyebrow>
              <H2>O médico que detestava marketing</H2>

              <P>
                Dois ortopedistas, mesma cidade do interior paulista, mesma faculdade, mesmo ano de
                formatura. Um, hoje, tem agenda cheia três meses à frente. O outro, lacunas.
                Tecnicamente são equivalentes — a julgar pelo currículo, talvez o segundo seja até um
                pouco melhor, com publicação científica mais consistente. Mas o paciente que abre o
                Google às onze da noite, procurando alguém para uma dor que não passa, não encontra o
                melhor. Encontra o que aparece.
              </P>

              <P>
                Essa diferença, que parece detalhe, é o que está decidindo quem vai prosperar na
                medicina dos próximos dez anos.
              </P>

              <H3>A dor que ninguém comenta</H3>

              <P>
                A maior parte dos profissionais de saúde que eu conheço carrega alguma forma de
                aversão à palavra <em>marketing</em>. Não é preconceito gratuito — é treinamento.
                Aprenderam, ao longo dos anos de faculdade e residência, que medicina se aproxima do
                sacerdócio. Que o bom profissional é discreto. Que se vender é, em algum nível
                profundo, indigno daquilo que se faz.
              </P>

              <P>
                Há sabedoria nesse instinto. As consequências de um marketing médico mal feito são
                concretas e graves: promessas de cura, comparações constantes com concorrentes, fotos
                sensacionalistas de antes e depois, procedimentos vendidos como produtos de
                prateleira. Tudo isso corrói a relação médico-paciente — corrói, num plano mais
                largo, a confiança que a profissão demorou um século inteiro a construir.
              </P>

              <P>
                O problema é que esse instinto, que protege bem contra o ruim, acabou impedindo o
                necessário. O paciente brasileiro de hoje não decide mais ao acaso. Não escolhe pelo
                nome que apareceu primeiro na lista do convênio. Não vai mais ao consultório
                recomendado pela tia sem antes pesquisar. Ele googla — antes, durante e depois.
              </P>

              <PullQuote>
                O profissional invisível, por mais competente que seja, está abrindo mão de algo bem
                concreto: a chance de ajudar pessoas que precisariam dele e nunca souberam que ele
                existia.
              </PullQuote>

              <H3>O marketing que dói não é o que se está pedindo</H3>

              <P>
                Aqui mora a distinção que reconcilia o conflito interno. Existem, na prática, dois
                tipos quase opostos de marketing aplicados à saúde.
              </P>

              <P>
                O primeiro é o que o profissional aprendeu a desprezar. É o marketing
                <strong> promocional</strong>: anúncios chamativos, ofertas relâmpago, depoimentos
                exagerados, comparações implícitas. Esse força confiança. E quando se força
                confiança, ela quebra — porque o paciente percebe.
              </P>

              <P>
                O segundo é o que vem sendo cobrado. É o marketing
                <strong> da presença</strong>: estar onde o paciente procura, com informação correta,
                com forma cuidada, com canais que funcionam quando alguém precisa deles. Não promete
                nada. Apenas existe publicamente. É a diferença entre um médico que paga para gritar
                e um médico que se deixa encontrar quando alguém o procura.
              </P>

              <P>
                Atul Gawande, cirurgião de Boston e talvez o autor médico mais influente da sua
                geração, nunca rodou um anúncio na vida. Mas escreve regularmente no
                <em> The New Yorker</em> sobre os dilemas reais da sua profissão — listas de
                verificação em cirurgia, decisões de fim de vida, falhas sistêmicas em hospitais. O
                resultado é o que se vê: encheu seu próprio hospital de pacientes, foi convidado a
                dirigir uma das maiores iniciativas globais de saúde pública e virou referência
                internacional. Sem jamais escrever &quot;agende sua consulta com o melhor cirurgião
                de Boston&quot;. Apenas sendo útil, em público, com regularidade.
              </P>

              <H3>O custo silencioso da ausência</H3>

              <P>
                Há um cálculo que poucos profissionais se permitem fazer. Suponha que, numa cidade de
                cem mil habitantes, existam num determinado mês vinte pessoas que precisam exatamente
                do tipo de cuidado que você oferece.
              </P>

              <AsideStats
                items={[
                  { value: '20', label: 'pacientes que precisam de você neste mês' },
                  { value: '3', label: 'chegam por indicação direta' },
                  { value: '17', label: 'vão para o profissional que apareceu primeiro' },
                ]}
              />

              <P>
                Sem qualquer visibilidade digital, talvez três cheguem até você — as três indicadas
                por algum amigo em comum. As outras dezessete vão procurar outro profissional,
                escolhido na maioria das vezes porque ele apareceu primeiro. Algumas dessas dezessete
                vão receber o cuidado de que precisavam. Outras vão receber um cuidado pior do que o
                seu. Mas todas elas, em algum sentido moral, foram afetadas pela sua ausência da
                busca delas.
              </P>

              <P>
                É esse argumento que costuma deslocar a relutância de quem cuida com seriedade. Não
                fazer marketing não é uma escolha neutra. É deixar para o algoritmo do Google a
                decisão sobre quem vai atender aqueles dezessete pacientes — e o algoritmo, é
                preciso lembrar, não sabe quem é melhor. Sabe apenas quem está presente.
              </P>

              <H3>Três regras que mantêm a dignidade intacta</H3>

              <P>
                Para quem decide entrar nessa conversa sem violar o instinto que protegeu a profissão
                por décadas, três princípios bastam.
              </P>

              <P>
                <strong>Educar antes de promover.</strong> O conteúdo que mais converte para clínica
                não é o que descreve o serviço — é o que ensina alguma coisa útil ao paciente sobre a
                própria condição. Um post que explica, com calma, por que dor lombar nem sempre é
                hérnia, vale mais do que dez chamadas de &quot;agende sua consulta hoje&quot;.
              </P>

              <P>
                <strong>Presença em vez de propaganda.</strong> Estar bem indexado no Google Meu
                Negócio, manter um Doctoralia atualizado, ter um Instagram que respira — tudo isso é
                presença. Anúncio pago é propaganda. Os dois funcionam, mas só a presença sustenta. A
                propaganda evapora no instante em que se desliga o cartão.
              </P>

              <P>
                <strong>Sinais em vez de promessas.</strong> Avaliações reais de pacientes, fotos
                honestas do consultório, formação documentada com transparência, horários que se
                cumprem. Tudo isso são sinais que o paciente coleta sozinho — e que ele, depois,
                atribui a você como mérito conquistado.
              </P>

              <P>
                A ética continua exatamente a mesma. A Resolução CFM 1.974/2011 e as similares dos
                demais conselhos profissionais continuam definindo o que pode e o que não pode ser
                feito. Sensacionalismo é proibido. Comparação direta é proibida. Garantia de
                resultado é proibida. Quem cumpre a regra tem, dentro do limite legal, espaço enorme
                para construir presença.
              </P>

              <PullQuote>
                O silêncio também é uma escolha de marketing. Só que feita por omissão.
              </PullQuote>
            </section>

            {/* ============ CAPÍTULO 2 ============ */}
            <section id="capitulo-2">
              <Eyebrow>Capítulo 2 · A anatomia</Eyebrow>
              <H2>Os cinco pilares que decidem quem é encontrado</H2>

              <P>
                Visibilidade digital não é uma vitrine — é uma somatória, quase invisível ao olho de
                quem está dentro do consultório, de tudo o que o mundo encontra quando procura por
                aquilo que você faz. Cinco pilares carregam essa decisão silenciosa. Cada um pesa uma
                fatia que se pode medir.
              </P>

              <PillaresChart />

              <H3>Pilar 1 — Google Meu Negócio (30%)</H3>

              <P>
                É noite, alguém sente um aperto no peito e procura um cardiologista no celular.
                Surgem três clínicas próximas no Maps, com fotos cuidadas e horário aberto. A
                primeira é escolhida. Quem não estava ali sequer foi cogitado — competência alguma
                compensa ausência completa.
              </P>

              <P>
                Quase oito em cada dez buscas por clínica no Brasil acontecem com mediação direta do
                Google. Maps, Knowledge Panel à direita da tela, caixa de avaliações na primeira
                rolagem: tudo isso é Google Meu Negócio. Um perfil sob cuidado contínuo — fotos que
                mostram, horário que se cumpre, reviews que se respondem — vai, aos poucos, sendo
                recompensado pelo algoritmo. Estar entre os três primeiros da sua região deixa de ser
                sorte; passa a ser consequência previsível.
              </P>

              <H3>Pilar 2 — Redes sociais (20%)</H3>

              <P>
                Uma indicação é dada num jantar. No dia seguinte, antes de ligar, a pessoa abre seu
                Instagram. O perfil está parado há oito meses. O elogio do amigo, que parecia sólido
                na hora, dissolve-se em uma dúvida — e a dúvida raramente sobrevive até o telefone.
              </P>

              <P>
                Redes sociais ativas não são vaidade. São a superfície onde a confiança alheia
                precisa, em algum momento, se apoiar. Publicações regulares, mesmo singelas, um link
                de agendamento à mão na bio, depoimentos que se acumulam sem alarde. É sobre dar à
                indicação alheia um lugar onde se sustentar — para que ela sobreviva o trajeto do
                jantar até a primeira consulta.
              </P>

              <H3>Pilar 3 — SEO e site (20%)</H3>

              <P>
                Um site lento no celular não falha de maneira ruidosa. Falha em silêncio — o paciente
                fecha a aba antes mesmo de saber que fechou. Cada segundo a mais no carregamento
                devora cerca de 7% das conversões; o consultório não percebe, porque a hemorragia
                escorre num lugar invisível.
              </P>

              <P>
                Mobile-first, performance acima de oitenta no PageSpeed, SSL ativo e as palavras da
                sua especialidade bem postas onde precisam estar: o site passa a trabalhar enquanto
                você dorme, sem cobrar mais por paciente atendido. É o único pilar que rende juros
                compostos.
              </P>

              <H3>Pilar 4 — Doctoralia (15%)</H3>

              <P>
                Há um instante entre saber do que se precisa e saber a quem entregar essa
                necessidade. Nesse intervalo, milhares de pacientes brasileiros abrem o Doctoralia —
                comparam, como quem compara hotéis para uma viagem importante. Sem perfil
                verificado, você está fora da lista antes mesmo da disputa começar.
              </P>

              <P>
                Um perfil verificado, um rating que se zela e um botão de agendamento que de fato
                funciona: o paciente decide no instante em que está decidido, sem ser conduzido a
                outro lugar onde a dúvida possa, no caminho, voltar.
              </P>

              <H3>Pilar 5 — Operacional (15%)</H3>

              <P>
                Há clínicas que gastam dois mil reais para serem encontradas, e perdem quase tudo por
                demorar quatro horas para responder. O marketing entregou cem cliques; a operação
                entregou doze pacientes. A diferença entre os dois números é o que o consultório
                nunca soube que possuía.
              </P>

              <P>
                Responder em menos de quinze minutos, manter o NPS acima de setenta, ter um processo
                de confirmação simples — três disciplinas pequenas que transformam atenção em agenda
                preenchida. E mais: começam o boca-a-boca que, anos depois, dispensa anúncio.
              </P>

              <PullQuote>
                Um score 65 sobre 100 não é nota de prova. É a fração da sua presença digital que
                efetivamente vira paciente. Tudo o que sobra é vaidade vestida de métrica.
              </PullQuote>
            </section>

            {/* ============ CAPÍTULO 3 ============ */}
            <section id="capitulo-3">
              <Eyebrow>Capítulo 3 · A economia</Eyebrow>
              <H2>Orgânico planta. Pago colhe.</H2>

              <P>
                Todo paciente novo chegou por um de dois caminhos — e esses caminhos operam em ritmos
                quase opostos. O orgânico é lento como árvore: leva estação inteira para frutificar,
                mas, frutificando, alimenta por anos. O pago é veloz como fogo: aquece o ambiente no
                instante em que se acende, e se extingue assim que falta combustível. Quem mistura
                os dois sem compreender seus tempos espera frutos do fogo, ou calor da árvore, e
                desiste antes da hora.
              </P>

              <ArvoreFogo />

              <H3>Tráfego orgânico: o paciente te encontra sozinho</H3>

              <P>
                Você aparece, em silêncio, no caminho de quem te procurava sem saber seu nome. Google
                Meu Negócio, SEO, Doctoralia, redes sociais com conteúdo: o paciente chega até você
                porque o algoritmo, ao longo do tempo, concluiu que faz sentido. Você não pagou a
                fila — esperou ser convocado.
              </P>

              <P>
                Custo marginal por paciente próximo de zero. Compõe ao longo do tempo. Leva entre
                três e seis meses para dar o primeiro retorno mensurável. Difícil de acelerar com
                dinheiro — exige tempo, consistência e qualidade de conteúdo.
              </P>

              <H3>Tráfego pago: você compra a posição</H3>

              <P>
                Você abre uma janela de visibilidade pagando por ela. Google Ads, Instagram Ads, Meta
                Ads: o lance é seu, a posição também, e cada clique tem um preço que se pode anotar
                no caderno. É a forma mais honesta de saber, em reais, quanto custa um paciente novo.
              </P>

              <AsideStats
                items={[
                  { value: 'R$ 4–12', label: 'CPC médio em especialidades de saúde no Brasil' },
                  { value: '4–8%', label: 'taxa de conversão de clique a agendamento' },
                  { value: 'R$ 80–280', label: 'CPA típico por paciente novo' },
                ]}
              />

              <P>
                Resultado em vinte e quatro horas se bem feito. CPA mensurável até o agendamento.
                Para de aparecer no instante em que o orçamento acaba. Concorrência sobe, CPC sobe.
              </P>

              <P>
                Um CPA vale o que vale o paciente que ele compra. Sem saber o ticket médio nem o
                quanto esse paciente voltará nos próximos anos, qualquer número parece caro — e
                qualquer barato esconde um prejuízo lento.
              </P>

              <PullQuote>
                A pergunta certa não é qual escolher. É qual proporção.
              </PullQuote>
            </section>

            {/* ============ CAPÍTULO 4 ============ */}
            <section id="capitulo-4">
              <Eyebrow>Capítulo 4 · A medida</Eyebrow>
              <H2>Seis números bastam para virar o caos em estratégia</H2>

              <P>
                Painéis com quarenta métricas não dão clareza — dão sensação de controle. Bastam
                seis, atualizados sem esforço, lidos com alguma regularidade. Estes seis são
                extraídos automaticamente do Google, do Doctoralia, do Instagram e da sua própria
                operação, e entregues prontos a cada semana, como quem entrega um boletim simples
                sobre o estado da clínica.
              </P>

              <KPIBoard />

              <H3>O que cada número conta</H3>

              <P>
                <strong>Impressões no Google</strong> é o número de vezes em que o seu nome se tornou
                uma possibilidade no celular de alguém. <strong>Cliques úteis</strong> mede quantos,
                desses, vieram em sua direção — pedindo o telefone, traçando a rota, abrindo o site.
              </P>

              <P>
                <strong>Brand search</strong> conta quantas pessoas digitaram, no Google, exatamente
                o seu nome. É a métrica mais íntima da sua reputação: dificilmente alguém procura por
                você sem ter ouvido falar a seu respeito antes.
              </P>

              <P>
                <strong>Taxa de agendamento</strong> mostra, de cada cem que iniciaram uma conversa,
                quantos chegaram à agenda. Mede a operação tanto quanto mede o marketing. Um número
                baixo aqui faz qualquer investimento em aquisição parecer caro.
              </P>

              <P>
                <strong>NPS</strong> é a medida da disposição alheia em recomendar você. Com o
                tempo, prediz o tamanho do seu orgânico — pacientes promotores trazem outros
                pacientes sem nenhum custo. <strong>Score Singulare</strong> é a média ponderada dos
                cinco pilares condensada em um número de zero a cem.
              </P>

              <PullQuote>
                Sem medir, há apenas fé. Com medir, começa a haver estratégia.
              </PullQuote>

              <P>
                O que separa a clínica que cresce da clínica que apenas ocupa um endereço é, quase
                sempre, esses seis números — e a disciplina pequena, semanal, de voltar a eles.
              </P>
            </section>

            {/* ============ CAPÍTULO 5 ============ */}
            <section id="capitulo-5">
              <Eyebrow>Capítulo 5 · A síntese</Eyebrow>
              <H2>Onde isso leva</H2>

              <P>
                O médico que detesta marketing não precisa virar gestor de campanhas. Não precisa
                contratar agência. Não precisa aprender ferramentas que nunca quis aprender. Precisa
                apenas reconhecer que, no estado atual da escolha em saúde no Brasil,
                <strong> estar presente é uma forma de cuidado</strong> — porque quem não está
                presente, simplesmente, não cuida de quem nunca chegou.
              </P>

              <P>
                A relutância continua válida como filtro útil: o que dói fazer é, quase sempre, o que
                não se deveria fazer. Mas o que apenas exige presença — e que, no fundo, alivia
                milhares de pacientes do trabalho cego de procurar no escuro — esse não deveria ser
                recusado por ninguém que escolheu cuidar de gente.
              </P>

              <P>
                Saber o que medir é a metade fácil. A metade difícil é fazer isso toda semana, sem
                esquecer, sem precisar se tornar analista. Foi para isso que construímos o painel da
                Singulare: conecta seu Google, Instagram e Doctoralia em quatro minutos via OAuth,
                lê dezessete métricas reais a cada vinte e quatro horas, e avisa em linguagem direta
                quando se abre uma janela de oportunidade — uma lacuna de conteúdo na sua
                especialidade, um leilão de palavra-chave barato, uma onda de pacientes prontos para
                deixar uma review.
              </P>
            </section>

            {/* CTA card ===================================== */}
            <section
              className="my-16 rounded-3xl p-8 sm:p-10 border relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="absolute -top-20 -right-20 h-[320px] w-[320px] rounded-full blur-3xl opacity-50"
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(110,86,207,0.5), rgba(110,86,207,0) 60%)',
                }}
              />
              <div className="relative">
                <p
                  className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-4"
                  style={{ color: '#a78bfa' }}
                >
                  Comece agora
                </p>
                <h3 className="text-[28px] sm:text-[32px] leading-[1.1] tracking-[-0.02em] font-medium text-white mb-3">
                  Diagnóstico gratuito da sua clínica em{' '}
                  <span className="font-serif italic font-normal text-zinc-300">quatro minutos.</span>
                </h3>
                <p className="text-[15px] leading-relaxed text-zinc-400 mb-6 max-w-[520px]">
                  Conecte seu Google Meu Negócio, receba seu score, descubra em quais pilares está
                  saudável e onde está sangrando sem perceber. Sem cartão. Sem compromisso.
                </p>
                <a
                  href="/"
                  className="inline-flex items-center gap-2 px-6 h-12 rounded-xl text-[14px] font-medium text-white transition-all hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
                    boxShadow: '0 8px 24px -8px rgba(110,86,207,0.7)',
                  }}
                >
                  Começar diagnóstico em singulare.org
                </a>
              </div>
            </section>

            {/* ============ FAQ ============ */}
            <section id="perguntas" className="mt-24">
              <Eyebrow>Perguntas frequentes</Eyebrow>
              <H2 id="faq">Perguntas que costumam aparecer</H2>

              <div className="space-y-6 mt-8">
                {FAQ.map(f => (
                  <details
                    key={f.q}
                    className="group rounded-2xl border border-black/[0.07] bg-white p-6 transition-all hover:border-black/[0.12]"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
                  >
                    <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                      <h3 className="text-[16px] font-semibold text-zinc-900 tracking-tight">
                        {f.q}
                      </h3>
                      <span
                        className="text-[20px] leading-none text-zinc-400 group-open:rotate-45 transition-transform shrink-0"
                        aria-hidden
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-4 text-[15px] leading-[1.65] text-zinc-600">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* FOOTER ================================== */}
        <footer
          className="border-t border-black/[0.07] mt-12 py-12 px-6"
          aria-label="Rodapé"
        >
          <div className="max-w-[1100px] mx-auto flex items-center justify-between gap-6 flex-wrap text-[13px] text-zinc-500">
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-semibold text-[12px]"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
              >
                S
              </div>
              <span>Singulare · Guia de visibilidade digital · 2026</span>
            </div>
            <div className="flex items-center gap-5">
              <a href="/ebook/visibilidade-digital" className="hover:text-zinc-900 transition">
                Versão imprimível
              </a>
              <a href="/" className="hover:text-zinc-900 transition">
                singulare.org
              </a>
            </div>
          </div>
        </footer>
      </article>
    </>
  );
}
