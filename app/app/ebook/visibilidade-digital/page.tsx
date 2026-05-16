import type { Metadata } from 'next';
import { PrintButton } from './PrintButton';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

export const metadata: Metadata = {
  title: 'Visibilidade digital pra clínicas · Guia Singulare 01',
  description:
    'Sem teoria genérica. Com dados reais. O que é visibilidade digital, tráfego orgânico vs pago, e os seis números que decidem se o paciente te encontra.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Visibilidade digital pra clínicas · Guia Singulare 01',
    description:
      'Sem teoria genérica. Com dados reais. Cinco pilares, dois caminhos, seis métricas.',
    type: 'article',
  },
};

const PILARES = [
  {
    n: '01',
    nome: 'Google Meu Negócio',
    peso: 30,
    desc: 'Onde a maior parte das buscas por clínica começa — no Maps, no Knowledge Panel, nas avaliações que aparecem antes de qualquer site.',
    dor: 'É noite, alguém sente um aperto no peito e procura um cardiologista no celular. Surgem três clínicas próximas, com fotos cuidadas e horário aberto. A primeira é escolhida. Quem não estava ali sequer foi cogitado — competência alguma compensa ausência completa.',
    resolve: 'Um perfil sob cuidado contínuo — fotos que mostram, horário que se cumpre, reviews que se respondem — vai, aos poucos, sendo recompensado pelo Google. Estar entre os três primeiros da sua região deixa de ser sorte; passa a ser consequência previsível.',
    metricas: ['Impressões em busca e mapa', 'Cliques de chamada', 'Pedidos de rota', 'Reviews e rating'],
  },
  {
    n: '02',
    nome: 'Doctoralia',
    peso: 15,
    desc: 'O diretório de saúde mais relevante do país. Onde o paciente já decidiu a especialidade e está, agora, escolhendo o nome.',
    dor: 'Há um instante entre saber do que se precisa e saber a quem entregar essa necessidade. Nesse intervalo, milhares de pacientes abrem o Doctoralia — comparam, como quem compara hotéis para uma viagem importante. Sem perfil verificado, você está fora da lista antes mesmo da disputa começar.',
    resolve: 'Um perfil verificado, um rating que se zela e um botão de agendamento que de fato funciona: o paciente decide no instante em que está decidido, sem ser conduzido a outro lugar onde a dúvida possa, no caminho, voltar.',
    metricas: ['Presença e perfil verificado', 'Rating e reviews', 'Agendamento online ativo'],
  },
  {
    n: '03',
    nome: 'Redes sociais',
    peso: 20,
    desc: 'Instagram e Facebook como prova social — não como vaidade, mas como a superfície onde a confiança alheia precisa, em algum momento, se apoiar.',
    dor: 'Uma indicação é dada num jantar. No dia seguinte, antes de ligar, a pessoa abre seu Instagram. O perfil está parado há oito meses. O elogio do amigo, que parecia sólido na hora, dissolve-se em uma dúvida — e a dúvida raramente sobrevive até o telefone.',
    resolve: 'Publicações regulares, mesmo singelas, um link de agendamento à mão, depoimentos que se acumulam sem alarde. É sobre dar à indicação alheia uma superfície onde se apoiar — para que ela sobreviva o trajeto do jantar até a primeira consulta.',
    metricas: ['Seguidores e engajamento', 'Posts nos últimos 30 dias', 'Link de agendamento na bio'],
  },
  {
    n: '04',
    nome: 'SEO e site',
    peso: 20,
    desc: 'O ativo digital que trabalha em silêncio — rápido, móvel, seguro, com as palavras certas nas posições certas da busca orgânica.',
    dor: 'Um site lento no celular não falha de maneira ruidosa. Falha em silêncio — o paciente fecha a aba antes mesmo de saber que fechou. Cada segundo a mais no carregamento devora cerca de 7% das conversões; o consultório não percebe, porque a hemorragia escorre num lugar invisível.',
    resolve: 'Mobile-first, performance acima de oitenta, SSL ativo e as palavras da sua especialidade bem postas onde precisam estar: o site passa a trabalhar enquanto você dorme, sem cobrar mais por paciente atendido. É o único pilar que rende juros compostos.',
    metricas: ['Performance e mobile score', 'Posição em busca orgânica', 'SSL e domínio próprio'],
  },
  {
    n: '05',
    nome: 'Operacional',
    peso: 15,
    desc: 'O marketing que começa depois do clique — NPS, tempo de resposta, taxa de confirmação. A parte que ninguém vê e que decide quase tudo.',
    dor: 'Há clínicas que gastam dois mil reais para serem encontradas, e perdem quase tudo por demorar quatro horas para responder. O marketing entregou cem cliques; a operação entregou doze pacientes. A diferença entre os dois números é o que o consultório nunca soube que possuía.',
    resolve: 'Responder em menos de quinze minutos, manter o NPS acima de setenta, ter um processo de confirmação simples — três disciplinas pequenas que transformam atenção em agenda preenchida. E mais: começam o boca-a-boca que, anos depois, dispensa anúncio.',
    metricas: ['NPS médio', 'Taxa de agendamento', 'Tempo médio de resposta', 'Recorrência'],
  },
];

const KPIS = [
  {
    n: '01',
    nome: 'Impressões no Google',
    desc: 'O número de vezes em que o seu nome se tornou, ainda que por um instante, uma possibilidade no celular de alguém.',
    exemplo: '4.812 impressões / mês',
  },
  {
    n: '02',
    nome: 'Cliques úteis',
    desc: 'Quantos saíram do Google indo na sua direção — pedindo o telefone, traçando a rota, abrindo o site.',
    exemplo: '127 cliques úteis · +18% MoM',
  },
  {
    n: '03',
    nome: 'Brand search',
    desc: 'Quantos digitaram, no Google, exatamente o seu nome. É a métrica mais íntima da sua reputação.',
    exemplo: '210 buscas pelo nome / mês',
  },
  {
    n: '04',
    nome: 'Taxa de agendamento',
    desc: 'De cada cem que iniciaram uma conversa, quantos chegaram à agenda. Mede a operação tanto quanto mede o marketing.',
    exemplo: '47% de conversão',
  },
  {
    n: '05',
    nome: 'NPS',
    desc: 'A medida da disposição alheia em recomendar você. Com o tempo, prediz o tamanho do seu orgânico.',
    exemplo: 'NPS 72 · promotor',
  },
  {
    n: '06',
    nome: 'Score Singulare',
    desc: 'A média ponderada dos cinco pilares condensada em um número. Onde você está hoje, sem necessidade de interpretação.',
    exemplo: '68 / 100 · classe B',
  },
];

function Atmosphere({ subtle = false }: { subtle?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -top-40 left-1/4 h-[640px] w-[640px] rounded-full blur-3xl"
        style={{
          opacity: subtle ? 0.35 : 0.6,
          background:
            'radial-gradient(circle at center, rgba(110,86,207,0.18), rgba(110,86,207,0) 60%)',
        }}
      />
      <div
        className="absolute -bottom-40 right-1/4 h-[520px] w-[520px] rounded-full blur-3xl"
        style={{
          opacity: subtle ? 0.3 : 0.5,
          background:
            'radial-gradient(circle at center, rgba(244,114,182,0.10), rgba(244,114,182,0) 60%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(10,10,10,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage:
            'radial-gradient(ellipse 80% 60% at 50% 40%, #000 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 40%, #000 40%, transparent 100%)',
        }}
      />
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-5"
      style={{ color: ACCENT_DEEP }}
    >
      {children}
    </p>
  );
}

function PageShell({
  children,
  withAtmosphere = false,
}: {
  children: React.ReactNode;
  withAtmosphere?: boolean;
}) {
  return (
    <section className="ebook-page relative bg-[#FAFAF7] text-zinc-900">
      {withAtmosphere && <Atmosphere />}
      <div className="relative max-w-[820px] mx-auto px-10 sm:px-14 py-16 sm:py-20">
        {children}
      </div>
    </section>
  );
}

export default function EbookVisibilidadeDigital() {
  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: #FAFAF7 !important; }
          .ebook-page {
            page-break-after: always;
            break-after: page;
            min-height: 100vh;
          }
          .ebook-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .no-print { display: none !important; }
        }
        @media screen {
          .ebook-page {
            min-height: 100vh;
            border-bottom: 1px solid rgba(0,0,0,0.06);
          }
        }
      `}</style>

      <article className="bg-[#FAFAF7] text-zinc-900 selection:bg-zinc-900 selection:text-white">
        {/* ============================================================
            PÁGINA 1 — CAPA
            ============================================================ */}
        <PageShell withAtmosphere>
          <div className="flex flex-col h-full min-h-[calc(100vh-160px)]">
            {/* Top brand bar */}
            <div className="flex items-center justify-between mb-20">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-[14px]"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                >
                  S
                </div>
                <span className="text-[13px] font-medium tracking-tight text-zinc-900">
                  Singulare
                </span>
              </div>
              <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-medium">
                Guia 01 · 2026
              </span>
            </div>

            {/* Hero */}
            <div className="flex-1 flex flex-col justify-center">
              <p
                className="text-[12px] uppercase tracking-[0.18em] font-semibold mb-7"
                style={{ color: ACCENT_DEEP }}
              >
                Edição 01 · Visibilidade
              </p>
              <h1 className="text-[56px] sm:text-[68px] leading-[0.95] tracking-[-0.035em] font-medium text-zinc-900 mb-8">
                Visibilidade
                <br />
                <span className="font-serif italic font-normal text-zinc-700">digital</span>{' '}
                pra clínicas.
              </h1>
              <p className="text-[20px] leading-[1.5] text-zinc-600 max-w-[520px] mb-10">
                Cinco páginas sobre o caminho silencioso que conduz o paciente até a sua porta.
                O que decide a escolha. E o que, com método e sem fé, se pode fazer a respeito.
              </p>

              <div className="flex items-center gap-6 text-[13px] text-zinc-500">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-400" />
                  5 capítulos
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-400" />
                  6 minutos de leitura
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-400" />
                  Compartilhe à vontade
                </span>
              </div>
            </div>

            {/* Bottom meta */}
            <div className="mt-20 pt-8 border-t border-black/[0.07] flex items-end justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400 font-medium mb-2">
                  Para
                </p>
                <p className="text-[14px] text-zinc-700 leading-relaxed max-w-[300px]">
                  Quem cuida de uma clínica e cansou de marketing vago.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400 font-medium mb-2">
                  Por
                </p>
                <p className="text-[14px] font-medium text-zinc-900">singulare.org</p>
              </div>
            </div>
          </div>
        </PageShell>

        {/* ============================================================
            PÁGINA 2 — OS CINCO PILARES
            ============================================================ */}
        <PageShell>
          <Eyebrow>01 · Conceito</Eyebrow>
          <h2 className="text-[40px] sm:text-[44px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900 mb-6">
            Cinco pilares decidem se o paciente{' '}
            <span className="font-serif italic font-normal text-zinc-700">te encontra.</span>
          </h2>
          <p className="text-[16px] leading-[1.6] text-zinc-600 max-w-[640px] mb-10">
            Visibilidade digital não é uma vitrine — é uma somatória, quase invisível ao olho de
            quem está dentro do consultório, de tudo o que o mundo encontra quando procura por
            aquilo que você faz. Cada pilar carrega seu peso na decisão silenciosa que o paciente
            toma antes mesmo de fazer a primeira ligação. Quem mede sabe onde está. Quem não mede,
            acredita.
          </p>

          <div className="space-y-3 mb-10">
            {PILARES.map(p => (
              <div
                key={p.n}
                className="rounded-xl border border-black/[0.07] bg-white p-5 sm:p-6"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
              >
                <div className="flex items-start justify-between gap-6 mb-3">
                  <div className="flex items-baseline gap-3">
                    <span
                      className="text-[11px] uppercase tracking-[0.12em] font-semibold"
                      style={{ color: ACCENT_DEEP }}
                    >
                      {p.n}
                    </span>
                    <h3 className="text-[18px] font-semibold text-zinc-900 tracking-tight">
                      {p.nome}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-32 h-[6px] rounded-full bg-black/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(p.peso / 30) * 100}%`,
                          background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DEEP})`,
                        }}
                      />
                    </div>
                    <span className="text-[14px] font-semibold text-zinc-900 tabular-nums">
                      {p.peso}%
                    </span>
                  </div>
                </div>
                <p className="text-[14px] text-zinc-600 leading-relaxed mb-4">{p.desc}</p>
                <div className="space-y-3 mb-4">
                  <div className="flex gap-3">
                    <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500 pt-[3px] shrink-0 w-[58px]">
                      Dor
                    </span>
                    <p className="text-[13px] text-zinc-700 leading-[1.55] flex-1">{p.dor}</p>
                  </div>
                  <div className="flex gap-3">
                    <span
                      className="text-[10px] uppercase tracking-[0.14em] font-semibold pt-[3px] shrink-0 w-[58px]"
                      style={{ color: ACCENT_DEEP }}
                    >
                      Resolve
                    </span>
                    <p className="text-[13px] text-zinc-700 leading-[1.55] flex-1">{p.resolve}</p>
                  </div>
                </div>
                <p className="text-[12px] text-zinc-400 pt-3 border-t border-black/[0.05]">
                  {p.metricas.join(' · ')}
                </p>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl p-6 border"
            style={{ background: ACCENT_SOFT, borderColor: 'rgba(110,86,207,0.18)' }}
          >
            <p className="text-[15px] leading-[1.6]" style={{ color: ACCENT_DEEP }}>
              <span className="font-serif italic">Insight.</span>{' '}
              <span className="font-medium">Um score 65 sobre 100 não é nota de prova</span> — é a
              fração da sua presença digital que efetivamente vira paciente. Tudo o que sobra
              (seguidores que não comparecem, posts que ninguém clicou, indicações que não chegaram)
              é vaidade vestida de métrica.
            </p>
          </div>
        </PageShell>

        {/* ============================================================
            PÁGINA 3 — TRÁFEGO ORGÂNICO VS PAGO
            ============================================================ */}
        <PageShell>
          <Eyebrow>02 · Os dois caminhos</Eyebrow>
          <h2 className="text-[40px] sm:text-[44px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900 mb-6">
            Orgânico planta.{' '}
            <span className="font-serif italic font-normal text-zinc-700">Pago colhe.</span>
          </h2>
          <p className="text-[16px] leading-[1.6] text-zinc-600 max-w-[640px] mb-10">
            Todo paciente novo chegou por um de dois caminhos — e esses caminhos operam em ritmos
            quase opostos. O orgânico é lento como árvore: leva estação inteira para frutificar,
            mas, frutificando, alimenta por anos. O pago é veloz como fogo: aquece o ambiente no
            instante em que se acende, e se extingue assim que falta combustível. Quem mistura os
            dois sem compreender seus tempos espera frutos do fogo, ou calor da árvore, e desiste
            antes da hora.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
            {/* Orgânico */}
            <div
              className="rounded-2xl border border-black/[0.07] bg-white p-7"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
            >
              <div className="flex items-baseline gap-3 mb-4">
                <span
                  className="text-[10px] uppercase tracking-[0.14em] font-bold px-2.5 py-1 rounded-full text-white"
                  style={{ background: ACCENT_DEEP }}
                >
                  Orgânico
                </span>
              </div>
              <h3 className="text-[22px] font-semibold text-zinc-900 tracking-tight mb-3">
                O paciente te encontra sozinho.
              </h3>
              <p className="text-[14px] text-zinc-600 leading-relaxed mb-5">
                Você aparece, em silêncio, no caminho de quem te procurava sem saber seu nome.
                Google Meu Negócio, SEO, Doctoralia, redes sociais com conteúdo: o paciente chega
                até você porque o algoritmo, ao longo do tempo, concluiu que faz sentido. Você não
                pagou a fila — esperou ser convocado.
              </p>
              <div className="space-y-2.5 text-[13px]">
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-zinc-700">Custo marginal por paciente baixo</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-zinc-700">Compõe ao longo do tempo</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-zinc-700">Leva 3 a 6 meses pra primeiro retorno</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-zinc-700">Difícil de acelerar com dinheiro</span>
                </div>
              </div>
            </div>

            {/* Pago */}
            <div
              className="rounded-2xl border border-black/[0.07] bg-white p-7"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
            >
              <div className="flex items-baseline gap-3 mb-4">
                <span
                  className="text-[10px] uppercase tracking-[0.14em] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: '#18181b', color: 'white' }}
                >
                  Pago
                </span>
              </div>
              <h3 className="text-[22px] font-semibold text-zinc-900 tracking-tight mb-3">
                Você compra a posição.
              </h3>
              <p className="text-[14px] text-zinc-600 leading-relaxed mb-5">
                Você abre uma janela de visibilidade pagando por ela. Google Ads, Instagram Ads,
                Meta Ads: o lance é seu, a posição também, e cada clique tem um preço que se pode
                anotar no caderno. É a forma mais honesta de saber, em reais, quanto custa um
                paciente novo.
              </p>
              <div className="space-y-2.5 text-[13px]">
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-zinc-700">Resultado em 24h se bem feito</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-zinc-700">CPA mensurável até o agendamento</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-zinc-700">Para de aparecer quando o budget acaba</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-zinc-700">Concorrência sobe, CPC sobe</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mini stat */}
          <div className="rounded-xl border border-black/[0.07] bg-white p-6">
            <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400 font-medium mb-3">
              Realidade do mercado brasileiro
            </p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p
                  className="text-[28px] font-medium tracking-[-0.02em] tabular-nums"
                  style={{ color: ACCENT_DEEP }}
                >
                  R$ 4–12
                </p>
                <p className="text-[12px] text-zinc-500 leading-tight mt-1">
                  CPC médio em<br />especialidades de saúde
                </p>
              </div>
              <div>
                <p
                  className="text-[28px] font-medium tracking-[-0.02em] tabular-nums"
                  style={{ color: ACCENT_DEEP }}
                >
                  4–8%
                </p>
                <p className="text-[12px] text-zinc-500 leading-tight mt-1">
                  Taxa de conversão<br />de clique a agendamento
                </p>
              </div>
              <div>
                <p
                  className="text-[28px] font-medium tracking-[-0.02em] tabular-nums"
                  style={{ color: ACCENT_DEEP }}
                >
                  R$ 80–280
                </p>
                <p className="text-[12px] text-zinc-500 leading-tight mt-1">
                  CPA típico<br />por paciente novo
                </p>
              </div>
            </div>
            <p className="text-[12px] text-zinc-400 mt-4 leading-relaxed">
              Um CPA vale o que vale o paciente que ele compra. Sem saber o ticket médio nem o
              quanto esse paciente voltará nos próximos anos, qualquer número parece caro — e
              qualquer barato esconde um prejuízo lento.
            </p>
          </div>
        </PageShell>

        {/* ============================================================
            PÁGINA 4 — KPIs
            ============================================================ */}
        <PageShell>
          <Eyebrow>03 · O que medir</Eyebrow>
          <h2 className="text-[40px] sm:text-[44px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900 mb-6">
            Seis números bastam para virar o caos em{' '}
            <span className="font-serif italic font-normal text-zinc-700">estratégia.</span>
          </h2>
          <p className="text-[16px] leading-[1.6] text-zinc-600 max-w-[640px] mb-10">
            Painéis com quarenta métricas não dão clareza — dão sensação de controle. Bastam seis,
            atualizados sem esforço, lidos com alguma regularidade. Estes seis a Singulare extrai
            sozinha do Google, do Doctoralia, do Instagram e da sua própria operação, e os entrega
            prontos a cada semana, como quem entrega um boletim simples sobre o estado da clínica.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {KPIS.map(k => (
              <div
                key={k.n}
                className="rounded-xl border border-black/[0.07] bg-white p-5"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
              >
                <div className="flex items-baseline gap-3 mb-2">
                  <span
                    className="text-[10px] uppercase tracking-[0.14em] font-semibold"
                    style={{ color: ACCENT_DEEP }}
                  >
                    {k.n}
                  </span>
                  <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight">
                    {k.nome}
                  </h3>
                </div>
                <p className="text-[13px] text-zinc-600 leading-[1.55] mb-3">{k.desc}</p>
                <div
                  className="rounded-lg px-3 py-2 inline-flex items-center"
                  style={{ background: ACCENT_SOFT }}
                >
                  <span
                    className="text-[12px] font-mono tabular-nums"
                    style={{ color: ACCENT_DEEP }}
                  >
                    {k.exemplo}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl p-6 border"
            style={{ background: ACCENT_SOFT, borderColor: 'rgba(110,86,207,0.18)' }}
          >
            <p className="text-[15px] leading-[1.6]" style={{ color: ACCENT_DEEP }}>
              <span className="font-serif italic">Sem medir, há apenas fé.</span>{' '}
              <span className="font-medium">Com medir, começa a haver estratégia.</span> O que
              separa a clínica que cresce da clínica que apenas ocupa um endereço é, quase sempre,
              esses seis números — e a disciplina pequena, semanal, de voltar a eles.
            </p>
          </div>
        </PageShell>

        {/* ============================================================
            PÁGINA 5 — CTA
            ============================================================ */}
        <PageShell withAtmosphere>
          <div className="flex flex-col h-full min-h-[calc(100vh-160px)]">
            <Eyebrow>Pra você</Eyebrow>
            <h2 className="text-[44px] sm:text-[52px] leading-[1.02] tracking-[-0.03em] font-medium text-zinc-900 mb-6">
              O painel que enxerga isso{' '}
              <span className="font-serif italic font-normal text-zinc-700">por você.</span>
            </h2>
            <p className="text-[18px] leading-[1.55] text-zinc-600 max-w-[560px] mb-12">
              Saber o que medir é a metade fácil. A metade difícil é fazer isso toda semana, sem
              esquecer, sem precisar se tornar analista. A Singulare cuida da parte difícil — para
              que sobre tempo de cuidar do paciente.
            </p>

            <div className="grid grid-cols-3 gap-4 mb-12">
              <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-white text-[16px] font-semibold"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
                    boxShadow: '0 8px 24px -8px rgba(110,86,207,0.6)',
                  }}
                >
                  1
                </div>
                <h3 className="text-[16px] font-semibold text-zinc-900 tracking-tight mb-2">
                  Conecta
                </h3>
                <p className="text-[13px] text-zinc-600 leading-relaxed">
                  Google, Instagram e Doctoralia em quatro minutos, via OAuth. Nada para instalar,
                  nada para configurar.
                </p>
              </div>

              <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-white text-[16px] font-semibold"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
                    boxShadow: '0 8px 24px -8px rgba(110,86,207,0.6)',
                  }}
                >
                  2
                </div>
                <h3 className="text-[16px] font-semibold text-zinc-900 tracking-tight mb-2">
                  Mede
                </h3>
                <p className="text-[13px] text-zinc-600 leading-relaxed">
                  Dezessete métricas reais, atualizadas a cada vinte e quatro horas. Histórico,
                  tendência e um score de zero a cem.
                </p>
              </div>

              <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-white text-[16px] font-semibold"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
                    boxShadow: '0 8px 24px -8px rgba(110,86,207,0.6)',
                  }}
                >
                  3
                </div>
                <h3 className="text-[16px] font-semibold text-zinc-900 tracking-tight mb-2">
                  Aciona
                </h3>
                <p className="text-[13px] text-zinc-600 leading-relaxed">
                  Avisa, em linguagem direta, quando se abre uma janela — uma lacuna de conteúdo,
                  um leilão barato, pacientes prontos para deixar uma review.
                </p>
              </div>
            </div>

            <div
              className="rounded-2xl p-8 border relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="absolute -top-20 -right-20 h-[300px] w-[300px] rounded-full blur-3xl opacity-50"
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
                <p className="text-[14px] leading-relaxed text-zinc-400 mb-6 max-w-[480px]">
                  Conecte seu Google Meu Negócio, receba seu score e descubra em quais pilares está
                  saudável e onde está sangrando sem perceber. Sem cartão. Sem compromisso.
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <div
                    className="px-5 py-3 rounded-xl text-[14px] font-medium text-white"
                    style={{
                      background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
                      boxShadow: '0 8px 24px -8px rgba(110,86,207,0.7)',
                    }}
                  >
                    singulare.org
                  </div>
                  <span className="text-[13px] text-zinc-500">
                    ou compartilhe este guia com quem precisa ler.
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-black/[0.07] flex items-center justify-between text-[12px] text-zinc-400">
              <span>Guia Singulare · Edição 01 · 2026</span>
              <span>singulare.org</span>
            </div>
          </div>
        </PageShell>

        {/* No-print — botão de download/imprimir só na tela */}
        <div className="no-print bg-zinc-50 border-t border-black/[0.07] py-10 px-6">
          <div className="max-w-[820px] mx-auto flex items-center justify-between gap-6 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-400 mb-1">
                Para compartilhar
              </p>
              <p className="text-[14px] text-zinc-700 leading-relaxed">
                Salve como PDF (Cmd/Ctrl + P, depois Salvar como PDF) ou compartilhe esta página direto.
              </p>
            </div>
            <PrintButton />
          </div>
        </div>
      </article>
    </>
  );
}
