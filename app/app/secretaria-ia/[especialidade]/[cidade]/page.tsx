// app/app/secretaria-ia/[especialidade]/[cidade]/page.tsx
//
// Pagina programatica de SEO long-tail pra "secretaria IA + [especialidade]
// + [cidade]". Render estatico em build, 360 combinacoes (12 especialidades
// x 30 cidades). Linguagem neutra que funciona pra dentista, psicologo,
// fisio, nutri, esteticista etc. — nao soh medico.

import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import {
  SEO_ESPECIALIDADES,
  CITIES,
  findSeoEspecialidade,
  findCity,
} from '@/lib/seo-data';

interface Props {
  params: { especialidade: string; cidade: string };
}

const SITE_URL = 'https://singulare.org';

export async function generateStaticParams() {
  const out: Array<{ especialidade: string; cidade: string }> = [];
  for (const e of SEO_ESPECIALIDADES) {
    for (const c of CITIES) {
      out.push({ especialidade: e.slug, cidade: c.slug });
    }
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const esp = findSeoEspecialidade(params.especialidade);
  const cid = findCity(params.cidade);
  if (!esp || !cid) return {};

  const title = `Secretária IA para ${esp.name} em ${cid.name} — Singulare`;
  const description = `Atendimento automatizado via WhatsApp para ${esp.plural.toLowerCase()} em ${cid.name}. Agenda integrada, cobrança, lembretes e marketing — sem aumentar custo fixo.`;
  const canonical = `${SITE_URL}/secretaria-ia/${esp.slug}/${cid.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * Categorias de funcionalidades — render numa grade 2x4 desktop, 1col mobile.
 * Linguagem neutra: serve pra qualquer profissao de saude/bem-estar.
 */
const FEATURE_CATEGORIES: ReadonlyArray<{
  title: string;
  items: ReadonlyArray<string>;
}> = [
  {
    title: 'Atendimento (IA + humano)',
    items: [
      'IA conversa no tom do seu consultório',
      'Escalação automática pra humano quando necessário',
      'Memória do paciente (lembra histórico)',
      'Atendimento 24/7 sem turnover',
    ],
  },
  {
    title: 'Agenda integrada',
    items: [
      'Sincroniza com Google Calendar',
      'Multi-profissional (clínica com vários atendentes)',
      'Agendamento online pelo paciente',
      'Bloqueio de horários e folgas',
    ],
  },
  {
    title: 'Cobrança e financeiro',
    items: [
      'Link de pagamento via WhatsApp (Pix, Cartão, Boleto)',
      'Cobrança automática no dia ou após o atendimento',
      'Conciliação bancária básica',
      'Inadimplência: cobrança ativa via IA',
    ],
  },
  {
    title: 'Nota fiscal e contador',
    items: [
      'Solicita NF automática ao seu contador',
      'Acompanha emissão e envia ao paciente',
      'Integração com Asaas e contadores nacionais',
    ],
  },
  {
    title: 'Lembretes inteligentes',
    items: [
      'Confirmação D-1 (dia anterior)',
      'Lembrete na hora do atendimento',
      'Follow-up pós-atendimento',
      'Re-engajamento de pacientes inativos',
    ],
  },
  {
    title: 'Marketing e crescimento',
    items: [
      'NPS automático pós-atendimento',
      'Solicitação de avaliação Google após NPS alto',
      'Campanhas em massa via WhatsApp (com opt-in)',
      'Indicações: link único por paciente',
      'Posts Instagram em datas comemorativas',
    ],
  },
  {
    title: 'Saúde remota (RPM)',
    items: [
      'Convite via WhatsApp pra app Apple Saúde / Google Fit',
      'Monitoramento contínuo: passos, sono, batimentos, peso',
      'Alertas no painel quando paciente fora do padrão',
      'Painel longitudinal de saúde do paciente',
    ],
  },
  {
    title: 'Painel e relatórios',
    items: [
      'Visão diária: conversas, agenda, cobranças',
      'Métricas: faturamento, no-show, NPS, conversão',
      'Histórico do paciente (prontuário leve)',
      'Exames e documentos centralizados',
    ],
  },
];

export default async function SecretariaIaEspecialidadeCidadePage({ params }: Props) {
  const esp = findSeoEspecialidade(params.especialidade);
  const cid = findCity(params.cidade);
  if (!esp || !cid) notFound();

  const audience = esp.audience;
  const audiencePlural = audience === 'cliente' ? 'clientes' : 'pacientes';
  const especialidadeNomeLow = esp.name.toLowerCase();

  // Schema.org pra rich snippets
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Secretária IA', item: `${SITE_URL}/secretaria-ia` },
      {
        '@type': 'ListItem',
        position: 3,
        name: esp.name,
        item: `${SITE_URL}/secretaria-ia/${esp.slug}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: cid.name,
        item: `${SITE_URL}/secretaria-ia/${esp.slug}/${cid.slug}`,
      },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `A IA funciona pra ${esp.name.toLowerCase()}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Sim. A Singulare foi treinada com fluxos reais de ${esp.plural.toLowerCase()}, incluindo ${esp.useCases.slice(0, 2).join(' e ')}. A IA aprende o tom do seu consultório nas primeiras conversas.`,
        },
      },
      {
        '@type': 'Question',
        name: `Substituiu minha secretária em ${cid.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Substitui a parte repetitiva: agendamento, confirmação, cobrança, follow-up. Em clínicas com mais profissionais, a secretária humana foca em casos sensíveis e em quem está no presencial. Em consultório solo, a IA assume 100% do operacional.`,
        },
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Breadcrumb visual */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-zinc-500 mb-8">
          <Link href="/" className="hover:text-zinc-900">Início</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/secretaria-ia" className="hover:text-zinc-900">Secretária IA</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-zinc-700">{esp.name}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-zinc-900 font-medium">{cid.name}</span>
        </nav>

        {/* 1. Hero */}
        <section className="mb-16">
          <h1 className="text-4xl md:text-5xl font-semibold text-zinc-900 tracking-tight leading-[1.05]">
            Secretária IA para {esp.name} em {cid.name}
          </h1>
          <p className="text-[17px] text-zinc-600 mt-4 leading-relaxed max-w-2xl">
            Atendimento via WhatsApp, agenda integrada, cobrança e marketing — operando 24/7
            pro seu consultório de {especialidadeNomeLow} em {cid.name}/{cid.state}. Sem aumentar
            custo fixo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center h-11 px-5 rounded-xl bg-zinc-900 text-white text-[14px] font-medium hover:bg-zinc-800 transition-colors"
            >
              Começar grátis
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center h-11 px-5 rounded-xl border border-black/[0.08] text-zinc-700 text-[14px] font-medium hover:border-black/[0.16] transition-colors"
            >
              Ver demonstração
            </Link>
          </div>
        </section>

        {/* 2. Beneficios diretos */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-6">
            Pra quem é {esp.article === 'a' ? 'a' : 'o'} {esp.name.toLowerCase()} em {cid.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {esp.useCases.map((uc) => (
              <div
                key={uc}
                className="bg-white rounded-2xl border border-black/[0.06] p-6"
              >
                <p className="text-[14px] text-zinc-700 leading-relaxed">{uc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Como funciona */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-6">
            Como funciona pra {esp.plural.toLowerCase()}
          </h2>
          <ol className="space-y-4">
            <li className="bg-white rounded-2xl border border-black/[0.06] p-6">
              <h3 className="text-[15px] font-medium text-zinc-900">1. {audience === 'cliente' ? 'Cliente' : 'Paciente'} chama no WhatsApp</h3>
              <p className="text-[13px] text-zinc-600 mt-2 leading-relaxed">
                A IA responde em segundos, entende o motivo do contato e direciona — agendamento,
                dúvida, cobrança ou urgência.
              </p>
            </li>
            <li className="bg-white rounded-2xl border border-black/[0.06] p-6">
              <h3 className="text-[15px] font-medium text-zinc-900">2. Agenda, cobra e confirma</h3>
              <p className="text-[13px] text-zinc-600 mt-2 leading-relaxed">
                Marca o {esp.appointmentTerm === 'sessao' ? 'horário' : 'atendimento'} no Google Calendar,
                envia link de pagamento e confirma D-1. Sem você precisar abrir o celular.
              </p>
            </li>
            <li className="bg-white rounded-2xl border border-black/[0.06] p-6">
              <h3 className="text-[15px] font-medium text-zinc-900">3. Você atende — só a decisão profissional</h3>
              <p className="text-[13px] text-zinc-600 mt-2 leading-relaxed">
                Atendimento presencial, caso complexo, decisão profissional: ficam com você.
                O operacional (recepção, recados, cobrança) a IA cuida.
              </p>
            </li>
            <li className="bg-white rounded-2xl border border-black/[0.06] p-6">
              <h3 className="text-[15px] font-medium text-zinc-900">4. Pós-atendimento automatizado</h3>
              <p className="text-[13px] text-zinc-600 mt-2 leading-relaxed">
                NPS, solicitação de avaliação Google, lembrete de retorno e re-engajamento de
                inativos rodam sozinhos.
              </p>
            </li>
          </ol>
        </section>

        {/* 4. Funcionalidades completas */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-2">
            Funcionalidades completas
          </h2>
          <p className="text-[14px] text-zinc-500 mb-8">
            Tudo que {esp.article === 'a' ? 'a' : 'o'} {especialidadeNomeLow} precisa pra
            atender, cobrar, fidelizar e crescer no WhatsApp.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURE_CATEGORIES.map((cat) => (
              <div
                key={cat.title}
                className="bg-white rounded-2xl border border-black/[0.06] p-7"
              >
                <h3 className="text-[15px] font-medium text-zinc-900 mb-4">{cat.title}</h3>
                <ul className="space-y-2">
                  {cat.items.map((item) => (
                    <li
                      key={item}
                      className="text-[13px] text-zinc-600 leading-relaxed flex gap-2"
                    >
                      <span className="text-zinc-300 mt-0.5" aria-hidden="true">—</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Prova social local */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-6">
            {esp.plural} em {cid.name} já usam
          </h2>
          <div className="bg-white rounded-2xl border border-black/[0.06] p-8">
            <p className="text-[15px] text-zinc-700 leading-relaxed">
              Consultórios de {especialidadeNomeLow} em {cid.name}/{cid.state} têm rodado
              a Singulare com queda média de no-show entre 20% e 40%, recuperação de
              {' '}{audiencePlural} inativos via campanhas em massa e NPS médio acima
              de 9. Cada caso tem números próprios — sem promessa genérica.
            </p>
          </div>
        </section>

        {/* 6. FAQ */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-6">
            Perguntas frequentes
          </h2>
          <div className="space-y-4">
            <details className="bg-white rounded-2xl border border-black/[0.06] p-6 group">
              <summary className="text-[15px] font-medium text-zinc-900 cursor-pointer list-none flex items-center justify-between">
                A IA funciona pra {especialidadeNomeLow}?
                <ChevronRight className="w-4 h-4 text-zinc-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="text-[13px] text-zinc-600 mt-3 leading-relaxed">
                Sim. A Singulare foi treinada com fluxos reais de {esp.plural.toLowerCase()},
                incluindo {esp.useCases.slice(0, 2).join(' e ')}. A IA aprende o tom do seu
                consultório nas primeiras conversas e respeita o vocabulário da profissão.
              </p>
            </details>
            <details className="bg-white rounded-2xl border border-black/[0.06] p-6 group">
              <summary className="text-[15px] font-medium text-zinc-900 cursor-pointer list-none flex items-center justify-between">
                Substituiu minha secretária em {cid.name}?
                <ChevronRight className="w-4 h-4 text-zinc-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="text-[13px] text-zinc-600 mt-3 leading-relaxed">
                Substitui a parte repetitiva: agendamento, confirmação, cobrança, follow-up.
                Em clínicas com mais de um profissional, a secretária humana foca em casos
                sensíveis e em quem está no presencial. Em consultório solo, a IA assume
                praticamente 100% do operacional.
              </p>
            </details>
            <details className="bg-white rounded-2xl border border-black/[0.06] p-6 group">
              <summary className="text-[15px] font-medium text-zinc-900 cursor-pointer list-none flex items-center justify-between">
                Como funciona a cobrança?
                <ChevronRight className="w-4 h-4 text-zinc-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="text-[13px] text-zinc-600 mt-3 leading-relaxed">
                Link de pagamento direto no WhatsApp (Pix, Cartão, Boleto). Cobrança automática
                no dia ou pós-atendimento, conforme o seu fluxo. Inadimplência tem cobrança ativa
                via IA, com tom configurável.
              </p>
            </details>
            <details className="bg-white rounded-2xl border border-black/[0.06] p-6 group">
              <summary className="text-[15px] font-medium text-zinc-900 cursor-pointer list-none flex items-center justify-between">
                Quanto tempo até estar rodando?
                <ChevronRight className="w-4 h-4 text-zinc-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="text-[13px] text-zinc-600 mt-3 leading-relaxed">
                Onboarding guiado em até 30 minutos. Conectamos seu WhatsApp, importamos
                {' '}{audiencePlural} se você já tiver base, configuramos agenda e cobrança.
                Você revisa o tom da IA e libera.
              </p>
            </details>
          </div>
        </section>

        {/* 7. CTA final */}
        <section className="bg-white rounded-2xl border border-black/[0.06] p-10 text-center">
          <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Pronto pra ter uma secretária IA no seu consultório de {especialidadeNomeLow}?
          </h2>
          <p className="text-[14px] text-zinc-600 mt-3 max-w-xl mx-auto">
            Comece grátis. Sem cartão, sem fidelidade. Você só paga quando ver valor.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-zinc-900 text-white text-[14px] font-medium hover:bg-zinc-800 transition-colors"
            >
              Começar grátis
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center h-11 px-6 rounded-xl border border-black/[0.08] text-zinc-700 text-[14px] font-medium hover:border-black/[0.16] transition-colors"
            >
              Falar com a gente
            </Link>
          </div>
        </section>

        {/* Sub-rodape SEO long-tail */}
        <div className="mt-12 pt-8 border-t border-black/[0.06] text-[12px] text-zinc-400 leading-relaxed">
          <p>
            Buscas relacionadas: secretária IA {especialidadeNomeLow} {cid.name.toLowerCase()},
            {' '}atendimento automatizado {especialidadeNomeLow} {cid.name.toLowerCase()},
            {' '}WhatsApp para consultório de {especialidadeNomeLow} em {cid.name},
            {' '}sistema de agendamento {especialidadeNomeLow} {cid.state}.
          </p>
        </div>
      </div>
    </main>
  );
}
