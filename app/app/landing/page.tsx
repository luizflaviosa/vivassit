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
    name: 'Dr. Ana Carolina',
    specialty: 'Cardiologia',
    clinic: 'CardioVida',
    rating: 5,
    text: 'Reduzi 40% do tempo administrativo. Agora foco 100% nos meus pacientes.',
  },
  {
    name: 'Dr. Roberto Silva',
    specialty: 'Ortopedia',
    clinic: 'Centro Ortopédico',
    rating: 5,
    text: 'Minhas consultas aumentaram 60% desde que comecei a usar a Vivassit.',
  },
  {
    name: 'Dra. Mariana Costa',
    specialty: 'Dermatologia',
    clinic: 'DermaCare',
    rating: 5,
    text: 'A melhor decisão que tomei para minha clínica. ROI em menos de 30 dias.',
  },
];

const FEATURES = [
  {
    icon: Calendar,
    title: 'Agenda inteligente',
    description: 'IA otimiza horários e reduz faltas em até 60%.',
    benefit: 'Mais consultas',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp integrado',
    description: 'Lembretes e confirmações automáticas, sem intervenção manual.',
    benefit: 'Zero stress',
  },
  {
    icon: CreditCard,
    title: 'Pagamentos seguros',
    description: 'PIX, cartão e parcelamento processados automaticamente.',
    benefit: 'Mais receita',
  },
  {
    icon: BarChart3,
    title: 'Relatórios claros',
    description: 'Insights sobre onde crescer, otimizar e investir.',
    benefit: 'Mais lucro',
  },
  {
    icon: Shield,
    title: 'Conformidade LGPD',
    description: 'Criptografia ponta-a-ponta e backups automáticos diários.',
    benefit: 'Tranquilidade',
  },
  {
    icon: Smartphone,
    title: 'Mobile-first',
    description: 'App nativo para você e portal completo para seus pacientes.',
    benefit: 'Praticidade',
  },
];

const PRICING_PLANS = [
  {
    name: 'Starter',
    price: 97,
    tagline: 'Para iniciar com leveza',
    popular: false,
    features: [
      'Até 100 pacientes',
      'Agenda básica',
      'WhatsApp simples',
      'Suporte por email',
    ],
  },
  {
    name: 'Professional',
    price: 197,
    tagline: 'O mais escolhido por clínicas',
    popular: true,
    features: [
      'Pacientes ilimitados',
      'IA completa',
      'WhatsApp Business',
      'Pagamentos integrados',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
  },
  {
    name: 'Enterprise',
    price: 397,
    tagline: 'Para múltiplas unidades',
    popular: false,
    features: [
      'Múltiplas clínicas',
      'API personalizada',
      'Integrações ilimitadas',
      'Gerente dedicado',
      'Treinamento exclusivo',
      'Suporte 24/7',
    ],
  },
];

const STATS = [
  { value: '+5.247', label: 'Médicos ativos' },
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  size?: 'md' | 'lg';
}) {
  const sizes = size === 'lg' ? 'h-12 px-6 text-[14px]' : 'h-10 px-5 text-[13px]';
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`group inline-flex items-center justify-center gap-1.5 rounded-lg text-white font-semibold transition-all hover:brightness-110 ${sizes}`}
      style={{
        background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
        boxShadow:
          '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 6px 20px -8px rgba(110,86,207,0.55)',
      }}
    >
      {children}
      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
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
      className="h-9 px-3.5 rounded-md text-[13px] font-medium text-zinc-700 hover:text-zinc-900 hover:bg-black/[0.04] transition-colors"
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

  const handleStartTrial = () => router.push('/onboarding');

  return (
    <div className="relative min-h-screen bg-[#FAFAF7] text-zinc-900 overflow-hidden selection:bg-zinc-900 selection:text-white">
      <Atmosphere />

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
              src="https://cdn.abacus.ai/images/904c7894-74de-41eb-a89d-950fb291aeda.png"
              alt="Vivassit"
              width={120}
              height={40}
              className="h-7 w-auto"
              priority
            />
          </div>
          <nav className="hidden md:flex items-center gap-1 text-[13px] text-zinc-600">
            <a href="#features" className="px-3 py-1.5 rounded-md hover:text-zinc-900 hover:bg-black/[0.03] transition-colors">Funcionalidades</a>
            <a href="#pricing" className="px-3 py-1.5 rounded-md hover:text-zinc-900 hover:bg-black/[0.03] transition-colors">Planos</a>
            <a href="#testimonials" className="px-3 py-1.5 rounded-md hover:text-zinc-900 hover:bg-black/[0.03] transition-colors">Médicos</a>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-zinc-500 mr-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              5.247 médicos online
            </span>
            <GhostButton onClick={handleStartTrial}>Entrar</GhostButton>
            <PrimaryButton onClick={handleStartTrial}>Começar grátis</PrimaryButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-20 sm:pt-28 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.07] bg-white/70 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-zinc-700 mb-8">
            <Sparkles className="w-3 h-3" style={{ color: ACCENT_DEEP }} />
            Novo · Workflow N8N v4 conectado
            <span className="text-zinc-300">·</span>
            <span className="text-zinc-500">5.247 clínicas ativas</span>
          </div>

          <h1 className="text-[44px] sm:text-[64px] md:text-[80px] leading-[0.98] tracking-[-0.035em] font-medium text-zinc-900 mb-6">
            Sua clínica,
            <br />
            <span className="font-serif italic font-normal text-zinc-700">
              automatizada
            </span>{' '}
            em 5 minutos.
          </h1>

          <p className="text-[17px] sm:text-[19px] text-zinc-500 leading-relaxed max-w-2xl mx-auto mb-10">
            A plataforma que transforma consultórios tradicionais em clínicas modernas,
            lucrativas e eficientes. Sem complicação.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <PrimaryButton onClick={handleStartTrial} size="lg">
              Começar grátis
            </PrimaryButton>
            <a
              href="#features"
              className="text-[13px] font-medium text-zinc-700 hover:text-zinc-900 transition-colors inline-flex items-center gap-1.5 h-12 px-2"
            >
              Ver funcionalidades
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-6 text-[12px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600" strokeWidth={3} />
              7 dias grátis
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600" strokeWidth={3} />
              Sem cartão
            </span>
            <span className="inline-flex items-center gap-1.5">
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
          className="mt-16 mx-auto max-w-3xl rounded-2xl border border-black/[0.07] bg-white/70 backdrop-blur-sm"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-black/[0.06]">
            {STATS.map((stat) => (
              <div key={stat.label} className="px-4 py-5 text-left">
                <div className="text-[26px] font-medium tracking-[-0.02em] text-zinc-900 inline-flex items-baseline gap-1">
                  {stat.value}
                  {stat.star && (
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-current self-center" />
                  )}
                </div>
                <div className="text-[12px] text-zinc-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-20 pb-20">
        <div className="mb-12 max-w-2xl">
          <p
            className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-3"
            style={{ color: ACCENT_DEEP }}
          >
            Funcionalidades
          </p>
          <h2 className="text-[34px] sm:text-[44px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900 mb-4">
            Tudo que sua clínica precisa,{' '}
            <span className="font-serif italic font-normal text-zinc-700">
              em um só lugar.
            </span>
          </h2>
          <p className="text-[16px] text-zinc-500 leading-relaxed">
            Pare de usar 10 sistemas diferentes. Vivassit unifica agenda, pagamentos,
            comunicação e relatórios.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <Tilt key={f.title} max={4} scale={1.012}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-xl border border-black/[0.07] bg-white p-5 group hover:border-black/[0.12] transition-colors"
                >
                  <div
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg mb-4"
                    style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-[15px] font-semibold text-zinc-900 leading-tight mb-1.5">
                    {f.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 mb-4">
                    {f.description}
                  </p>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700">
                    <span
                      className="inline-block h-1 w-1 rounded-full"
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
      <section id="testimonials" className="relative max-w-3xl mx-auto px-5 sm:px-6 pt-12 pb-20">
        <div className="mb-10 text-center">
          <p
            className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-3"
            style={{ color: ACCENT_DEEP }}
          >
            Médicos
          </p>
          <h2 className="text-[30px] sm:text-[38px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            Práticas que se{' '}
            <span className="font-serif italic font-normal text-zinc-700">
              transformaram.
            </span>
          </h2>
        </div>

        <div className="rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.10)] overflow-hidden">
          <div className="p-7 sm:p-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTestimonial}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: TESTIMONIALS[currentTestimonial].rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-3.5 h-3.5 text-amber-400 fill-current"
                    />
                  ))}
                </div>
                <p className="text-[20px] sm:text-[24px] leading-[1.35] tracking-[-0.015em] text-zinc-900 font-medium mb-7">
                  &ldquo;{TESTIMONIALS[currentTestimonial].text}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                  >
                    <User className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-zinc-900">
                      {TESTIMONIALS[currentTestimonial].name}
                    </div>
                    <div className="text-[12px] text-zinc-500">
                      {TESTIMONIALS[currentTestimonial].specialty} ·{' '}
                      {TESTIMONIALS[currentTestimonial].clinic}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <Hairline />
          <div className="flex items-center justify-between px-5 py-3 bg-zinc-50/60">
            <div className="flex gap-1.5">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentTestimonial(i)}
                  aria-label={`Ver depoimento ${i + 1}`}
                  className="group relative h-1.5 w-6 rounded-full overflow-hidden bg-black/[0.07]"
                >
                  <span
                    className="absolute inset-0 origin-left rounded-full transition-transform duration-300"
                    style={{
                      background: ACCENT_DEEP,
                      transform: i === currentTestimonial ? 'scaleX(1)' : 'scaleX(0)',
                    }}
                  />
                </button>
              ))}
            </div>
            <span className="text-[11px] text-zinc-400">
              {currentTestimonial + 1} / {TESTIMONIALS.length}
            </span>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-12 pb-20">
        <div className="mb-12 text-center">
          <p
            className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-3"
            style={{ color: ACCENT_DEEP }}
          >
            Planos
          </p>
          <h2 className="text-[34px] sm:text-[44px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900 mb-4">
            Escolha o ideal para{' '}
            <span className="font-serif italic font-normal text-zinc-700">
              sua clínica.
            </span>
          </h2>
          <p className="text-[16px] text-zinc-500 leading-relaxed max-w-xl mx-auto">
            7 dias grátis em qualquer plano. Sem compromisso, sem burocracia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PRICING_PLANS.map((plan, i) => (
            <Tilt key={plan.name} max={3} scale={1.008} glare={plan.popular}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className={`relative h-full rounded-2xl bg-white p-6 flex flex-col ${
                  plan.popular ? '' : 'border border-black/[0.07]'
                }`}
                style={
                  plan.popular
                    ? {
                        boxShadow:
                          `0 0 0 1.5px ${ACCENT}, 0 1px 2px rgba(0,0,0,0.04), 0 18px 40px -16px rgba(110,86,207,0.35)`,
                      }
                    : undefined
                }
              >
                {plan.popular && (
                  <span
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.1em] font-semibold px-2 py-1 rounded text-white whitespace-nowrap"
                    style={{
                      background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                      boxShadow: '0 4px 12px -4px rgba(110,86,207,0.5)',
                    }}
                  >
                    Mais popular
                  </span>
                )}

                <div className="mb-5">
                  <h3 className="text-[14px] font-semibold text-zinc-900 mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-[12px] text-zinc-500">{plan.tagline}</p>
                </div>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-[12px] text-zinc-400">R$</span>
                  <span className="text-[36px] font-medium tracking-[-0.025em] text-zinc-900 leading-none">
                    {plan.price}
                  </span>
                  <span className="text-[12px] text-zinc-500 ml-1">/mês</span>
                </div>

                <Hairline className="mb-5" />

                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <div
                        className="mt-0.5 h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: ACCENT_SOFT }}
                      >
                        <Check className="w-2.5 h-2.5" strokeWidth={3} style={{ color: ACCENT_DEEP }} />
                      </div>
                      <span className="text-[13px] text-zinc-700 leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.popular ? (
                  <button
                    onClick={handleStartTrial}
                    className="group h-10 rounded-lg text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all hover:brightness-110"
                    style={{
                      background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                      boxShadow:
                        '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 6px 18px -6px rgba(110,86,207,0.55)',
                    }}
                  >
                    Começar grátis
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleStartTrial}
                    className="group h-10 rounded-lg border border-black/[0.10] text-zinc-900 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all hover:border-black/30 hover:bg-black/[0.02]"
                  >
                    Começar grátis
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 text-zinc-500" />
                  </button>
                )}
              </motion.div>
            </Tilt>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative max-w-4xl mx-auto px-5 sm:px-6 pt-12 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-8 sm:p-12 text-center"
        >
          <div
            className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full opacity-50 blur-3xl"
            style={{
              background:
                'radial-gradient(circle at center, rgba(110,86,207,0.22), rgba(110,86,207,0) 60%)',
            }}
          />
          <div className="relative">
            <h2 className="text-[32px] sm:text-[44px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900 mb-4">
              Pronto para{' '}
              <span className="font-serif italic font-normal text-zinc-700">
                transformar
              </span>{' '}
              sua clínica?
            </h2>
            <p className="text-[16px] text-zinc-500 leading-relaxed max-w-lg mx-auto mb-8">
              Junte-se a mais de 5.000 médicos que já automatizaram suas práticas e
              aumentaram a receita.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <PrimaryButton onClick={handleStartTrial} size="lg">
                Começar agora — é grátis
              </PrimaryButton>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3 h-3" strokeWidth={2} />
                Dados criptografados
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-600" strokeWidth={3} />
                Sem cartão
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-600" strokeWidth={3} />
                7 dias grátis
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-black/[0.06] bg-white/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image
              src="https://cdn.abacus.ai/images/904c7894-74de-41eb-a89d-950fb291aeda.png"
              alt="Vivassit"
              width={120}
              height={40}
              className="h-6 w-auto opacity-80"
            />
            <span className="text-[12px] text-zinc-400">
              © {new Date().getFullYear()} Vivassit
            </span>
          </div>
          <div className="flex items-center gap-5 text-[12px] text-zinc-500">
            <a href="#features" className="hover:text-zinc-900 transition-colors">Funcionalidades</a>
            <a href="#pricing" className="hover:text-zinc-900 transition-colors">Planos</a>
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
