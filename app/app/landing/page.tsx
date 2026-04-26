'use client';

import { useState, useEffect } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowRight,
  Check,
  Star,
  Shield,
  Lock,
  X,
  Calendar,
  MessageCircle,
  CreditCard,
  BarChart3,
  Smartphone,
  User,
  Sparkles,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────────
// Design tokens
// ──────────────────────────────────────────────────────────────────────────────

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

// ──────────────────────────────────────────────────────────────────────────────
// Content
// ──────────────────────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    name: 'Dra. Ana Carolina',
    specialty: 'Psicologia',
    clinic: 'Consultório próprio',
    rating: 5,
    text: 'Atendo 100% pelo WhatsApp. A IA cuida de agenda e cobrança, eu foco nas sessões.',
  },
  {
    name: 'Dr. Roberto Silva',
    specialty: 'Odontologia',
    clinic: 'Clínica OrtoSorriso',
    rating: 5,
    text: 'Minhas consultas aumentaram 60% e diminuí faltas em 70%. Singulare virou parte do time.',
  },
  {
    name: 'Mariana Costa',
    specialty: 'Nutrição',
    clinic: 'Nutri & Movimento',
    rating: 5,
    text: 'A melhor decisão que tomei pro consultório. ROI em menos de 30 dias.',
  },
];

const FEATURES = [
  {
    icon: MessageCircle,
    title: 'Agente IA no WhatsApp',
    description: 'Atende, agenda, confirma e responde dúvidas dos seus pacientes 24/7.',
    benefit: 'Atendimento sempre on',
  },
  {
    icon: User,
    title: 'Assistente humana de plantão',
    description: 'Quando a IA detecta um caso delicado, escala pra uma pessoa real assumir.',
    benefit: 'Toque humano garantido',
  },
  {
    icon: Calendar,
    title: 'Agenda inteligente',
    description: 'IA otimiza horários e reduz faltas em até 60% com lembretes automáticos.',
    benefit: 'Mais consultas',
  },
  {
    icon: BarChart3,
    title: 'CRM completo',
    description: 'Histórico, preferências, retornos, NPS — tudo do paciente num lugar só.',
    benefit: 'Relacionamento em alto nível',
  },
  {
    icon: CreditCard,
    title: 'Pagamentos no fluxo',
    description: 'PIX, cartão e boleto enviados via WhatsApp e processados na mesma conversa.',
    benefit: 'Mais receita, menos atrito',
  },
  {
    icon: Shield,
    title: 'Seguro e em conformidade',
    description: 'LGPD, criptografia ponta-a-ponta, backups diários e auditoria completa.',
    benefit: 'Tranquilidade total',
  },
];

const PRICING_PLANS = [
  {
    name: 'Starter',
    slug: 'basic',
    price: 97,
    tagline: 'Consultório solo, começo de jornada',
    popular: false,
    features: [
      'Até 100 pacientes',
      'Agenda inteligente',
      'WhatsApp + IA básica',
      'Suporte por email',
    ],
  },
  {
    name: 'Professional',
    slug: 'professional',
    price: 197,
    tagline: 'O mais escolhido pelos profissionais',
    popular: true,
    features: [
      'Pacientes ilimitados',
      'IA completa + assistente humana',
      'WhatsApp Business',
      'Marketplace de cobranças',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    price: 397,
    tagline: 'Clínica até 5 profissionais',
    popular: false,
    features: [
      'Multi-profissional',
      'CRM completo',
      'NF automática',
      'API personalizada',
      'Treinamento exclusivo',
      'Suporte 24/7',
    ],
  },
  {
    name: 'Clínica+',
    slug: 'enterprise_plus',
    price: 597,
    tagline: 'Clínica com 6+ profissionais',
    popular: false,
    features: [
      'Profissionais ilimitados',
      'Multi-unidades',
      'Painel BI dedicado',
      'Gerente de conta dedicado',
      'SLA garantido',
      'Onboarding white-glove',
    ],
  },
];

const STATS = [
  { value: '+5.247', label: 'Profissionais ativos' },
  { value: '98%',    label: 'Satisfação' },
  { value: '4.9',    label: 'Avaliação média', star: true },
  { value: '60%',    label: 'Menos faltas' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Atmosphere
// ──────────────────────────────────────────────────────────────────────────────

function Atmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -top-40 left-1/4 h-[720px] w-[720px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            'radial-gradient(circle at center, rgba(110,86,207,0.20), rgba(110,86,207,0) 60%)',
        }}
      />
      <div
        className="absolute top-[420px] -right-40 h-[560px] w-[560px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            'radial-gradient(circle at center, rgba(244,114,182,0.10), rgba(244,114,182,0) 60%)',
        }}
      />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[520px] w-[1000px] opacity-40 blur-3xl"
        style={{
          background:
            'radial-gradient(circle at center, rgba(255,180,120,0.10), rgba(255,180,120,0) 60%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(10,10,10,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage:
            'radial-gradient(ellipse 90% 70% at 50% 30%, #000 30%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 90% 70% at 50% 30%, #000 30%, transparent 100%)',
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tilt — lightweight 3D parallax (framer-motion only)
// ──────────────────────────────────────────────────────────────────────────────

interface TiltProps {
  children: React.ReactNode;
  className?: string;
  max?: number;
  scale?: number;
  glare?: boolean;
}

function Tilt({ children, className, max = 5, scale = 1.01, glare = false }: TiltProps) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rX = useSpring(useTransform(my, [0, 1], [max, -max]), { stiffness: 220, damping: 22 });
  const rY = useSpring(useTransform(mx, [0, 1], [-max, max]), { stiffness: 220, damping: 22 });
  const s  = useSpring(1, { stiffness: 220, damping: 22 });

  const glareGradient = useTransform<number, string>(
    [mx, my] as unknown as MotionValue<number>,
    (latest) => {
      const [x, y] = latest as unknown as [number, number];
      return `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.55), transparent 55%)`;
    }
  );
  const glareOpacity = useSpring(0, { stiffness: 220, damping: 22 });

  return (
    <motion.div
      onMouseMove={(e) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        mx.set((e.clientX - rect.left) / rect.width);
        my.set((e.clientY - rect.top) / rect.height);
      }}
      onMouseEnter={() => { s.set(scale); glareOpacity.set(glare ? 1 : 0); }}
      onMouseLeave={() => { mx.set(0.5); my.set(0.5); s.set(1); glareOpacity.set(0); }}
      style={{
        rotateX: rX,
        rotateY: rY,
        scale: s,
        transformStyle: 'preserve-3d',
        transformPerspective: 1200,
      }}
      className={`relative ${className ?? ''}`}
    >
      {children}
      {glare && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay"
          style={{ background: glareGradient, opacity: glareOpacity }}
        />
      )}
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Primitives
// ──────────────────────────────────────────────────────────────────────────────

function PrimaryButton({
  children,
  onClick,
  size = 'md',
  fullWidth = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  size?: 'md' | 'lg';
  fullWidth?: boolean;
}) {
  const sizes =
    size === 'lg'
      ? 'h-14 sm:h-12 px-7 sm:px-6 text-[16px] sm:text-[14px] rounded-xl sm:rounded-lg'
      : 'h-11 sm:h-10 px-4 sm:px-5 text-[14px] sm:text-[13px] rounded-lg';
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`group inline-flex items-center justify-center gap-2 sm:gap-1.5 text-white font-semibold transition-all hover:brightness-110 ${sizes} ${fullWidth ? 'w-full' : ''}`}
      style={{
        background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
        boxShadow:
          '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 8px 24px -8px rgba(110,86,207,0.6)',
      }}
    >
      {children}
      <ArrowRight className="w-4 h-4 sm:w-3.5 sm:h-3.5 transition-transform group-hover:translate-x-0.5" />
    </motion.button>
  );
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 sm:h-9 px-3.5 rounded-md text-[14px] sm:text-[13px] font-medium text-zinc-700 hover:text-zinc-900 hover:bg-black/[0.04] transition-colors"
    >
      {children}
    </button>
  );
}

function Hairline({ className = '' }: { className?: string }) {
  return <div className={`h-px w-full bg-black/[0.07] ${className}`} />;
}

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successTenantId, setSuccessTenantId] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setShowSuccessMessage(true);
      setSuccessTenantId(urlParams.get('tenant') || '');
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleStartTrial = (plan?: string) => {
    const url = plan ? `/onboarding?plan=${encodeURIComponent(plan)}` : '/onboarding';
    router.push(url);
  };

  return (
    <div className="relative min-h-screen bg-[#FAFAF7] text-zinc-900 overflow-hidden selection:bg-zinc-900 selection:text-white pb-24 md:pb-0">
      <Atmosphere />

      {/* Sticky bottom CTA — mobile only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/85 backdrop-blur-xl border-t border-black/[0.07]">
        <PrimaryButton onClick={() => handleStartTrial()} size="lg" fullWidth>
          Começar grátis
        </PrimaryButton>
      </div>

      {/* Success toast */}
      <AnimatePresence>
        {showSuccessMessage && (
          <motion.div
            className="fixed inset-x-4 top-4 z-50 mx-auto max-w-xl"
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="rounded-xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-12px_rgba(0,0,0,0.18)] p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-md bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-zinc-900">
                    Cadastro realizado com sucesso
                  </p>
                  <p className="text-[13px] text-zinc-500 mt-0.5 leading-relaxed">
                    Sua conta foi criada e a configuração da clínica já foi iniciada.
                    Verifique seu email nos próximos minutos.
                  </p>
                  {successTenantId && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[11px]">
                      <span className="text-zinc-400">ID:</span>
                      <code className="font-mono text-zinc-700">{successTenantId}</code>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowSuccessMessage(false)}
                  className="p-1 -mr-1 -mt-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-black/[0.04] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Topbar */}
      <header className="relative border-b border-black/[0.06] bg-white/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logos/singulare-a.svg"
              alt="Singulare"
              width={120}
              height={40}
              className="h-7 w-auto"
              priority
            />
          </div>
          <nav className="hidden md:flex items-center gap-1 text-[13px] text-zinc-600">
            <a href="#features" className="px-3 py-1.5 rounded-md hover:text-zinc-900 hover:bg-black/[0.03] transition-colors">Funcionalidades</a>
            <a href="#pricing" className="px-3 py-1.5 rounded-md hover:text-zinc-900 hover:bg-black/[0.03] transition-colors">Planos</a>
            <a href="#testimonials" className="px-3 py-1.5 rounded-md hover:text-zinc-900 hover:bg-black/[0.03] transition-colors">Depoimentos</a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-zinc-500 mr-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              5.247 profissionais online
            </span>
            <div className="hidden sm:block">
              <GhostButton onClick={() => router.push('/login')}>Entrar</GhostButton>
            </div>
            <PrimaryButton onClick={() => handleStartTrial()}>Começar</PrimaryButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-14 sm:pt-20 md:pt-28 pb-14 sm:pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/80 backdrop-blur-sm px-3.5 py-2 sm:py-1 text-[13px] sm:text-[11px] font-medium text-zinc-700 mb-8 sm:mb-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <Sparkles className="w-3.5 h-3.5 sm:w-3 sm:h-3" style={{ color: ACCENT_DEEP }} />
            <span>Workflow N8N v4 ao vivo</span>
            <span className="hidden sm:inline text-zinc-300">·</span>
            <span className="hidden sm:inline text-zinc-500">5.247 profissionais</span>
          </div>

          <h1 className="text-[52px] sm:text-[64px] md:text-[80px] leading-[0.95] sm:leading-[0.98] tracking-[-0.04em] sm:tracking-[-0.035em] font-medium text-zinc-900 mb-6 sm:mb-6">
            Seu consultório,
            <br />
            <span className="font-serif italic font-normal text-zinc-700">
              no piloto automático.
            </span>
          </h1>

          <p className="text-[18px] sm:text-[19px] text-zinc-500 leading-[1.5] sm:leading-relaxed max-w-2xl mx-auto mb-10 sm:mb-10 px-2 sm:px-0">
            Para dentistas, médicos, psicólogos, fisios, nutris e mais.
            Uma IA atende no WhatsApp, agenda, organiza pagamentos e mantém
            seu CRM em dia. Quando o caso pede toque humano, uma assistente real assume.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center px-2 sm:px-0">
            <PrimaryButton onClick={() => handleStartTrial()} size="lg" fullWidth>
              Começar grátis
            </PrimaryButton>
            <a
              href="#features"
              className="text-[15px] sm:text-[13px] font-medium text-zinc-700 hover:text-zinc-900 transition-colors inline-flex items-center justify-center gap-1.5 h-12 sm:h-12 px-2"
            >
              Ver funcionalidades
              <ArrowRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-5 gap-y-2 mt-7 sm:mt-6 text-[13px] sm:text-[12px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-emerald-600" strokeWidth={3} />
              7 dias grátis
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-emerald-600" strokeWidth={3} />
              Sem cartão
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600" strokeWidth={3} />
              Cancele quando quiser
            </span>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mt-14 sm:mt-16 mx-auto max-w-3xl rounded-2xl sm:rounded-2xl border border-black/[0.07] bg-white/80 backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-black/[0.06]">
            {STATS.map((stat) => (
              <div key={stat.label} className="px-5 py-5 sm:py-5 text-left">
                <div className="text-[32px] sm:text-[26px] font-medium tracking-[-0.025em] text-zinc-900 inline-flex items-baseline gap-1 leading-none">
                  {stat.value}
                  {stat.star && (
                    <Star className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400 fill-current self-center" />
                  )}
                </div>
                <div className="text-[13px] sm:text-[12px] text-zinc-500 mt-1.5 sm:mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-20 sm:pt-20 pb-16 sm:pb-20">
        <div className="mb-12 sm:mb-12 max-w-2xl">
          <p
            className="text-[12px] sm:text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.12em] font-semibold mb-4 sm:mb-3"
            style={{ color: ACCENT_DEEP }}
          >
            Funcionalidades
          </p>
          <h2 className="text-[36px] sm:text-[44px] leading-[1.05] sm:leading-[1.05] tracking-[-0.03em] sm:tracking-[-0.025em] font-medium text-zinc-900 mb-5 sm:mb-4">
            Tudo que seu atendimento precisa,{' '}
            <span className="font-serif italic font-normal text-zinc-700">
              em um só lugar.
            </span>
          </h2>
          <p className="text-[17px] sm:text-[16px] text-zinc-500 leading-[1.5] sm:leading-relaxed">
            Pare de usar 10 sistemas. Singulare unifica agenda, pagamentos,
            comunicação e prontuário pra qualquer profissional de saúde.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <Tilt key={f.title} max={4} scale={1.012}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-2xl sm:rounded-xl border border-black/[0.07] bg-white p-6 sm:p-5 group hover:border-black/[0.12] transition-colors"
                >
                  <div
                    className="inline-flex h-12 w-12 sm:h-9 sm:w-9 items-center justify-center rounded-xl sm:rounded-lg mb-5 sm:mb-4"
                    style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
                  >
                    <Icon className="w-[22px] h-[22px] sm:w-4 sm:h-4" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-[18px] sm:text-[15px] font-semibold text-zinc-900 leading-tight mb-2 sm:mb-1.5">
                    {f.title}
                  </h3>
                  <p className="text-[15px] sm:text-[13px] leading-[1.5] sm:leading-relaxed text-zinc-500 mb-5 sm:mb-4">
                    {f.description}
                  </p>
                  <div className="inline-flex items-center gap-2 sm:gap-1.5 text-[13px] sm:text-[11px] font-medium text-zinc-700">
                    <span
                      className="inline-block h-1.5 w-1.5 sm:h-1 sm:w-1 rounded-full"
                      style={{ background: ACCENT }}
                    />
                    {f.benefit}
                  </div>
                </motion.div>
              </Tilt>
            );
          })}
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative max-w-3xl mx-auto px-5 sm:px-6 pt-12 sm:pt-12 pb-16 sm:pb-20">
        <div className="mb-10 sm:mb-10 text-center">
          <p
            className="text-[12px] sm:text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.12em] font-semibold mb-4 sm:mb-3"
            style={{ color: ACCENT_DEEP }}
          >
            Profissionais
          </p>
          <h2 className="text-[32px] sm:text-[38px] leading-[1.05] sm:leading-[1.05] tracking-[-0.03em] sm:tracking-[-0.025em] font-medium text-zinc-900">
            Atendimentos que se{' '}
            <span className="font-serif italic font-normal text-zinc-700">
              transformaram.
            </span>
          </h2>
        </div>

        <div className="rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-16px_rgba(0,0,0,0.12)] overflow-hidden">
          <div className="p-7 sm:p-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTestimonial}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex gap-1 sm:gap-0.5 mb-5 sm:mb-5">
                  {Array.from({ length: TESTIMONIALS[currentTestimonial].rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400 fill-current"
                    />
                  ))}
                </div>
                <p className="text-[22px] sm:text-[24px] leading-[1.35] sm:leading-[1.35] tracking-[-0.02em] sm:tracking-[-0.015em] text-zinc-900 font-medium mb-7 sm:mb-7">
                  &ldquo;{TESTIMONIALS[currentTestimonial].text}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="h-12 w-12 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                  >
                    <User className="w-5 h-5 sm:w-4 sm:h-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] sm:text-[13px] font-semibold text-zinc-900 truncate">
                      {TESTIMONIALS[currentTestimonial].name}
                    </div>
                    <div className="text-[13px] sm:text-[12px] text-zinc-500 truncate">
                      {TESTIMONIALS[currentTestimonial].specialty} ·{' '}
                      {TESTIMONIALS[currentTestimonial].clinic}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <Hairline />
          <div className="flex items-center justify-between px-5 py-3.5 sm:py-3 bg-zinc-50/60">
            <div className="flex gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentTestimonial(i)}
                  aria-label={`Ver depoimento ${i + 1}`}
                  className="group relative py-3 -my-3"
                >
                  <span className="block h-2 w-8 sm:h-1.5 sm:w-6 rounded-full overflow-hidden bg-black/[0.07]">
                    <span
                      className="block h-full origin-left rounded-full transition-transform duration-300"
                      style={{
                        background: ACCENT_DEEP,
                        transform: i === currentTestimonial ? 'scaleX(1)' : 'scaleX(0)',
                      }}
                    />
                  </span>
                </button>
              ))}
            </div>
            <span className="text-[13px] sm:text-[11px] text-zinc-400 font-medium">
              {currentTestimonial + 1} / {TESTIMONIALS.length}
            </span>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-12 sm:pt-12 pb-20 sm:pb-20">
        <div className="mb-12 sm:mb-12 text-center">
          <p
            className="text-[12px] sm:text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.12em] font-semibold mb-4 sm:mb-3"
            style={{ color: ACCENT_DEEP }}
          >
            Planos
          </p>
          <h2 className="text-[36px] sm:text-[44px] leading-[1.05] sm:leading-[1.05] tracking-[-0.03em] sm:tracking-[-0.025em] font-medium text-zinc-900 mb-5 sm:mb-4">
            Escolha o ideal para{' '}
            <span className="font-serif italic font-normal text-zinc-700">
              o seu atendimento.
            </span>
          </h2>
          <p className="text-[17px] sm:text-[16px] text-zinc-500 leading-[1.5] sm:leading-relaxed max-w-xl mx-auto px-2 sm:px-0">
            7 dias grátis em qualquer plano. Sem compromisso, sem burocracia.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-3">
          {PRICING_PLANS.map((plan, i) => (
            <Tilt key={plan.name} max={3} scale={1.008} glare={plan.popular}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className={`relative h-full rounded-2xl bg-white p-7 sm:p-6 flex flex-col ${
                  plan.popular ? '' : 'border border-black/[0.07]'
                }`}
                style={
                  plan.popular
                    ? {
                        boxShadow:
                          `0 0 0 2px ${ACCENT}, 0 1px 2px rgba(0,0,0,0.04), 0 24px 48px -16px rgba(110,86,207,0.4)`,
                      }
                    : undefined
                }
              >
                {plan.popular && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] sm:text-[10px] uppercase tracking-[0.1em] font-semibold px-3 py-1.5 sm:py-1 rounded-md text-white whitespace-nowrap"
                    style={{
                      background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                      boxShadow: '0 6px 16px -4px rgba(110,86,207,0.6)',
                    }}
                  >
                    Mais popular
                  </span>
                )}

                <div className="mb-6 sm:mb-5">
                  <h3 className="text-[17px] sm:text-[14px] font-semibold text-zinc-900 mb-1.5 sm:mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-[14px] sm:text-[12px] text-zinc-500">{plan.tagline}</p>
                </div>

                <div className="mb-7 sm:mb-6 flex items-baseline gap-1">
                  <span className="text-[14px] sm:text-[12px] text-zinc-400">R$</span>
                  <span className="text-[52px] sm:text-[36px] font-medium tracking-[-0.03em] sm:tracking-[-0.025em] text-zinc-900 leading-none">
                    {plan.price}
                  </span>
                  <span className="text-[14px] sm:text-[12px] text-zinc-500 ml-1">/mês</span>
                </div>

                <Hairline className="mb-6 sm:mb-5" />

                <ul className="space-y-3.5 sm:space-y-2.5 mb-8 sm:mb-7 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 sm:gap-2.5">
                      <div
                        className="mt-0.5 h-5 w-5 sm:h-4 sm:w-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: ACCENT_SOFT }}
                      >
                        <Check className="w-3 h-3 sm:w-2.5 sm:h-2.5" strokeWidth={3} style={{ color: ACCENT_DEEP }} />
                      </div>
                      <span className="text-[15px] sm:text-[13px] text-zinc-700 leading-[1.45] sm:leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.popular ? (
                  <button
                    onClick={() => handleStartTrial(plan.slug)}
                    className="group h-[52px] sm:h-10 rounded-xl sm:rounded-lg text-white text-[15px] sm:text-[13px] font-semibold inline-flex items-center justify-center gap-2 sm:gap-1.5 transition-all hover:brightness-110"
                    style={{
                      background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                      boxShadow:
                        '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 8px 22px -6px rgba(110,86,207,0.6)',
                    }}
                  >
                    Começar grátis
                    <ArrowRight className="w-4 h-4 sm:w-3.5 sm:h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleStartTrial(plan.slug)}
                    className="group h-[52px] sm:h-10 rounded-xl sm:rounded-lg border border-black/[0.10] text-zinc-900 text-[15px] sm:text-[13px] font-semibold inline-flex items-center justify-center gap-2 sm:gap-1.5 transition-all hover:border-black/30 hover:bg-black/[0.02]"
                  >
                    Começar grátis
                    <ArrowRight className="w-4 h-4 sm:w-3.5 sm:h-3.5 transition-transform group-hover:translate-x-0.5 text-zinc-500" />
                  </button>
                )}
              </motion.div>
            </Tilt>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative max-w-4xl mx-auto px-5 sm:px-6 pt-12 sm:pt-12 pb-20 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl sm:rounded-2xl border border-black/[0.08] bg-white p-9 sm:p-12 text-center"
        >
          <div
            className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full opacity-60 blur-3xl"
            style={{
              background:
                'radial-gradient(circle at center, rgba(110,86,207,0.28), rgba(110,86,207,0) 60%)',
            }}
          />
          <div className="relative">
            <h2 className="text-[34px] sm:text-[44px] leading-[1.05] sm:leading-[1.05] tracking-[-0.03em] sm:tracking-[-0.025em] font-medium text-zinc-900 mb-5 sm:mb-4">
              Pronto para{' '}
              <span className="font-serif italic font-normal text-zinc-700">
                transformar
              </span>{' '}
              seu atendimento?
            </h2>
            <p className="text-[17px] sm:text-[16px] text-zinc-500 leading-[1.5] sm:leading-relaxed max-w-lg mx-auto mb-8 sm:mb-8">
              Junte-se a mais de 5.000 profissionais de saúde que automatizaram
              o atendimento e aumentaram a receita.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <PrimaryButton onClick={() => handleStartTrial()} size="lg" fullWidth>
                Começar agora
              </PrimaryButton>
            </div>

            <div className="mt-7 sm:mt-6 flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-5 gap-y-2 text-[13px] sm:text-[12px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 sm:w-3 sm:h-3" strokeWidth={2} />
                Criptografado
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-emerald-600" strokeWidth={3} />
                Sem cartão
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-emerald-600" strokeWidth={3} />
                7 dias grátis
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-black/[0.06] bg-white/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-7 sm:py-8 flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-4">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logos/singulare-a.svg"
              alt="Singulare"
              width={120}
              height={40}
              className="h-6 w-auto opacity-80"
            />
            <span className="text-[12px] text-zinc-400">
              © {new Date().getFullYear()} Singulare
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-5 gap-y-2 text-[13px] sm:text-[12px] text-zinc-500">
            <a href="#features" className="hover:text-zinc-900 transition-colors">Funcionalidades</a>
            <a href="#pricing" className="hover:text-zinc-900 transition-colors">Planos</a>
            <a href="/termos" className="hover:text-zinc-900 transition-colors">Termos</a>
            <a href="/privacidade" className="hover:text-zinc-900 transition-colors">Privacidade</a>
            <span className="inline-flex items-center gap-1.5 text-zinc-400">
              <Shield className="w-3 h-3" strokeWidth={2} />
              LGPD
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
