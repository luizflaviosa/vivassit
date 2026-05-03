'use client';

import { useState, useEffect, useCallback, useRef, Fragment, Suspense } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  User,
  Building2,
  Settings,
  Shield,
  Phone,
  Clock,
  Heart,
  TrendingUp,
  Sparkles,
  Copy,
  ExternalLink,
  Calendar,
  MessageCircle,
  HardDrive,
  Loader2,
  Lock,
  ChevronRight,
  CreditCard,
  Plus,
  X,
} from 'lucide-react';
import { WhatsAppConnect } from './components/WhatsAppConnect';
import {
  OnboardingData,
  ValueBlock,
  QualificationOption,
  WizardStep,
  PROFESSIONAL_TYPES,
  COUNCIL_BY_PROFESSIONAL,
  SPECIALTIES_BY_PROFESSIONAL,
  ESTABLISHMENT_SIZES,
  COMMON_INSURANCES,
  type ProfessionalTypeKey,
  type EstablishmentSizeKey,
} from '@/lib/types';

// ──────────────────────────────────────────────────────────────────────────────
// Design tokens (inline so this file is self-contained)
// ──────────────────────────────────────────────────────────────────────────────

const ACCENT = '#6E56CF';        // primary violet (refined)
const ACCENT_DEEP = '#5746AF';   // text-on-light accent
const ACCENT_SOFT = '#F5F3FF';   // tinted surface

type DayInterval = { start: string; end: string };

function parseDayIntervals(raw: string | undefined | null): DayInterval[] {
  if (!raw || raw === 'fechado') return [];
  return raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [start = '', end = ''] = part.split('-');
      return { start: start.trim(), end: end.trim() };
    });
}

function serializeDayIntervals(intervals: DayInterval[]): string {
  if (intervals.length === 0) return 'fechado';
  return intervals.map(i => `${i.start || '00:00'}-${i.end || '00:00'}`).join(',');
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const PLAN_DETAILS: Record<string, {
  label: string;
  price: string;
  desc: string;
  features: string[];
  highlight?: boolean;
}> = {
  professional: {
    label: 'Profissional',
    price: 'R$ 197',
    desc: 'Para quem trabalha de forma independente.',
    features: [
      '1 profissional',
      'Agendamento via WhatsApp 24h',
      'Cobranças: Pix, Cartão e Boleto',
      'NF solicitada ao contador',
      'Documentos e exames via WhatsApp',
      'NPS e feedback',
    ],
  },
  enterprise: {
    label: 'Enterprise',
    price: 'R$ 397',
    desc: 'Para equipes de até 5 profissionais.',
    features: [
      'Tudo do Profissional',
      'Até 5 profissionais',
      'CRM de atendimento humano',
      'Multi-canal: WhatsApp + e-mail',
      'Relatórios por profissional',
      'Suporte prioritário',
    ],
    highlight: true,
  },
};

const ESTABLISHMENT_ICONS: Record<string, React.ReactNode> = {
  private_practice: <User className="w-4 h-4" strokeWidth={1.75} />,
  small_clinic:     <Building2 className="w-4 h-4" strokeWidth={1.75} />,
  medium_clinic:    <Building2 className="w-4 h-4" strokeWidth={1.75} />,
  large_clinic:     <Building2 className="w-4 h-4" strokeWidth={1.75} />,
  hospital:         <Shield className="w-4 h-4" strokeWidth={1.75} />,
};

const VALUE_BLOCKS: ValueBlock[] = [
  {
    icon: 'clock',
    title: 'Mais tempo para o que importa',
    description:
      'Agendamento inteligente, lembretes, NF ao contador e documentos organizados — tudo automático.',
  },
  {
    icon: 'heart',
    title: 'Respostas 24h, com o seu jeito',
    description:
      'Seus pacientes são atendidos via WhatsApp com a sua voz. Ninguém percebe que é uma IA.',
  },
  {
    icon: 'trending-up',
    title: 'Sua prática, mais lucrativa',
    description:
      'Cobranças automáticas por Pix, Cartão e Boleto. NPS que mostra o seu crescimento real.',
  },
];

const INITIAL_QUALIFICATIONS: QualificationOption[] = [
  { id: 'agenda', label: 'Gestão de Agenda', selected: true },
  { id: 'billing', label: 'Cobrança: Pix, Cartão e Boleto', selected: true },
  { id: 'nf', label: 'NF automática ao contador', selected: false },
  { id: 'documents', label: 'Recebimento de documentos e exames', selected: false },
  { id: 'patients', label: 'Cadastro de Pacientes', selected: true },
  { id: 'reports', label: 'Relatórios e indicadores', selected: false },
];

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    title: 'Você',
    description: 'Profissão, nome e registro',
    fields: ['professional_type', 'doctor_name', 'doctor_crm', 'speciality'],
  },
  {
    id: 2,
    title: 'Seu negócio',
    description: 'Solo ou clínica · contato',
    fields: ['establishment_type', 'clinic_name', 'admin_email', 'real_phone'],
  },
  {
    id: 3,
    title: 'Como atende',
    description: 'Duração, horários e convênios',
    fields: ['consultation_duration'], // working_hours/insurance optional, configurável depois
    optional: true,
  },
  {
    id: 4,
    title: 'Cobrança e IA',
    description: 'Valor, métodos, prompt da IA',
    fields: ['lgpd_accepted'],
    optional: true,
  },
  {
    id: 5,
    title: 'Plano e confirmação',
    description: 'Escolha o plano e revise',
    fields: ['plan_type'],
  },
];

const INITIAL_DATA: OnboardingData = {
  professional_type: 'medico',
  establishment_size: 'private_practice',
  real_phone: '',
  clinic_name: '',
  admin_email: '',
  doctor_name: '',
  doctor_crm: '',
  speciality: '',
  consultation_duration: '30',
  establishment_type: 'private_practice',
  plan_type: 'professional',
  // Atendimento (preenchidos depois quando ativados)
  consultation_value: '',
  payment_methods: [],
  charge_timing: 'after',
  partial_charge_pct: 100,
  accepts_insurance: false,
  insurance_list: [],
  insurance_other: '',
  address: '',
  followup_window_days: 30,
  working_hours: {},
  auto_emit_nf: false,
  // IA + LGPD
  assistant_prompt: '',
  lgpd_accepted: false,
};

const DRAFT_KEY = 'singulare_onboarding_draft';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const normalizePhoneToE164 = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('+')) return '+' + digits;
  if (digits.startsWith('55') && digits.length >= 12) return '+' + digits;
  return '+55' + digits;
};

// ──────────────────────────────────────────────────────────────────────────────
// Atmosphere — soft radial gradients + dot grid behind everything
// ──────────────────────────────────────────────────────────────────────────────

function Atmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -top-40 left-1/4 h-[640px] w-[640px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            'radial-gradient(circle at center, rgba(110,86,207,0.18), rgba(110,86,207,0) 60%)',
        }}
      />
      <div
        className="absolute -bottom-40 right-1/4 h-[520px] w-[520px] rounded-full opacity-50 blur-3xl"
        style={{
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

// ──────────────────────────────────────────────────────────────────────────────
// Tilt — lightweight 3D parallax (Vanilla-Tilt-style, no dep, framer-motion)
// ──────────────────────────────────────────────────────────────────────────────

interface TiltProps {
  children: React.ReactNode;
  className?: string;
  max?: number;
  scale?: number;
  glare?: boolean;
}

function Tilt({ children, className, max = 6, scale = 1.01, glare = false }: TiltProps) {
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
      onMouseLeave={() => {
        mx.set(0.5); my.set(0.5); s.set(1); glareOpacity.set(0);
      }}
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
// Tiny primitives
// ──────────────────────────────────────────────────────────────────────────────

function Hairline({ className = '' }: { className?: string }) {
  return <div className={`h-px w-full bg-black/[0.07] ${className}`} />;
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[14px] sm:text-[13px] font-medium text-zinc-900 tracking-tight">{label}</label>
        {hint && <span className="text-[12px] sm:text-[11px] text-zinc-400">{hint}</span>}
      </div>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            className="text-[13px] sm:text-[12px] text-rose-600 flex items-center gap-1.5"
          >
            <span className="inline-block w-1 h-1 rounded-full bg-rose-500" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputBase =
  'w-full h-14 sm:h-11 px-4 sm:px-3.5 bg-white text-[17px] sm:text-[15px] text-zinc-900 placeholder:text-zinc-400 ' +
  'rounded-xl sm:rounded-lg border transition-all duration-150 ' +
  'focus:outline-none focus:ring-4';

function inputClasses(hasError?: boolean) {
  return `${inputBase} ${
    hasError
      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10'
      : 'border-black/10 hover:border-black/20 focus:border-zinc-900 focus:ring-zinc-900/[0.06]'
  }`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Success screen
// ──────────────────────────────────────────────────────────────────────────────

interface SuccessData {
  tenant_id: string;
  clinic_name: string;
  doctor_name: string;
  admin_email: string;
  calendar_link?: string | null;
  telegram_link?: string | null;
  whatsapp_pairing_code?: string | null;
  evolution_qr_code?: string | null;
  evolution_qr_string?: string | null;
  evolution_phone_number?: string | null;
  evolution_instance_name?: string | null;
  drive_link?: string | null;
  automation_status?: string | null;
}

function SuccessScreen({ data }: { data: SuccessData }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const copyTenantId = () => {
    navigator.clipboard.writeText(data.tenant_id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const services = [
    { label: 'Conta criada', done: true },
    { label: 'Agenda médica configurada', done: !!data.calendar_link },
    { label: 'WhatsApp ativado', done: !!data.whatsapp_pairing_code },
    { label: 'Bot do Telegram configurado', done: !!data.telegram_link },
    { label: 'Google Drive criado', done: !!data.drive_link },
    { label: 'Email de boas-vindas enviado', done: true },
  ];

  return (
    <div className="relative min-h-screen bg-[#FAFAF7] text-zinc-900">
      <Atmosphere />

      <div className="relative max-w-xl mx-auto px-5 sm:px-6 pt-12 sm:pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center mb-8">
            <Image
              src="/logos/singulare-a.svg"
              alt="Singulare"
              width={120}
              height={40}
              className="h-10 sm:h-11 w-auto"
              priority
            />
          </div>

          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
            className="relative inline-flex mb-8"
          >
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-60"
              style={{ background: ACCENT }}
            />
            <div
              className="relative h-16 w-16 rounded-full flex items-center justify-center text-white shadow-[0_8px_24px_-8px_rgba(110,86,207,0.6)]"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
            >
              <Check className="w-7 h-7" strokeWidth={2.5} />
            </div>
          </motion.div>

          <h1 className="text-[30px] sm:text-[40px] leading-[1.1] sm:leading-[1.05] tracking-[-0.03em] font-medium text-zinc-900 mb-3">
            <span className="font-serif italic font-normal text-zinc-700">Pronto.</span>{' '}
            Sua clínica
            <br />
            está sendo configurada.
          </h1>
          <p className="text-[15px] text-zinc-500">
            Bem-vindo(a), <span className="text-zinc-900 font-medium">{data.doctor_name}</span>.
          </p>
        </motion.div>

        {/* Tenant ID */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 rounded-xl border border-black/[0.07] bg-white p-4 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-400 font-medium mb-1">
              ID único de acesso
            </p>
            <code className="font-mono text-[13px] text-zinc-900 truncate block">
              {data.tenant_id}
            </code>
          </div>
          <button
            onClick={copyTenantId}
            className="flex-shrink-0 h-9 w-9 rounded-md border border-black/[0.08] hover:border-black/20 hover:bg-black/[0.02] transition-colors flex items-center justify-center text-zinc-600"
            title="Copiar ID"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="ok"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  className="text-emerald-600"
                >
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </motion.div>

        {/* Services checklist */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8"
        >
          <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-400 font-medium mb-3">
            O que está sendo configurado
          </p>
          <ul className="rounded-xl border border-black/[0.07] bg-white overflow-hidden">
            {services.map((svc, i) => (
              <Fragment key={svc.label}>
                {i > 0 && <Hairline />}
                <motion.li
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.06 }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div
                    className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      svc.done ? '' : 'border border-dashed border-zinc-300'
                    }`}
                    style={svc.done ? { background: ACCENT_SOFT } : undefined}
                  >
                    {svc.done ? (
                      <Check className="w-3 h-3" strokeWidth={3} style={{ color: ACCENT_DEEP }} />
                    ) : (
                      <div className="h-1 w-1 rounded-full bg-zinc-300" />
                    )}
                  </div>
                  <span
                    className={`text-[14px] ${
                      svc.done ? 'text-zinc-900' : 'text-zinc-400'
                    }`}
                  >
                    {svc.label}
                  </span>
                  {!svc.done && (
                    <span className="ml-auto text-[11px] text-amber-600 font-medium">
                      Em andamento
                    </span>
                  )}
                </motion.li>
              </Fragment>
            ))}
          </ul>
        </motion.div>

        {/* WhatsApp connection (pair code default, QR fallback, polling) */}
        {(data.whatsapp_pairing_code || data.evolution_qr_code) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="mt-8"
          >
            <WhatsAppConnect
              tenantId={data.tenant_id}
              qrCodeBase64={data.evolution_qr_code}
              pairingCode={data.whatsapp_pairing_code}
              phoneNumber={data.evolution_phone_number}
            />
          </motion.div>
        )}

        {/* Access links */}
        {(data.calendar_link || data.telegram_link || data.drive_link) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-8"
          >
            <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-400 font-medium mb-3">
              Seus acessos
            </p>
            <div className="rounded-xl border border-black/[0.07] bg-white divide-y divide-black/[0.05]">
              {data.calendar_link && (
                <AccessRow
                  href={data.calendar_link}
                  icon={<Calendar className="w-4 h-4" strokeWidth={1.75} />}
                  label="Agenda médica"
                />
              )}
              {data.telegram_link && (
                <AccessRow
                  href={data.telegram_link}
                  icon={<MessageCircle className="w-4 h-4" strokeWidth={1.75} />}
                  label="Bot do Telegram"
                />
              )}
              {data.drive_link && (
                <AccessRow
                  href={data.drive_link}
                  icon={<HardDrive className="w-4 h-4" strokeWidth={1.75} />}
                  label="Google Drive da clínica"
                />
              )}
            </div>
          </motion.div>
        )}

        {/* Email reminder */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.5 }}
          className="mt-6 text-center text-[13px] text-zinc-500"
        >
          Em poucos minutos enviaremos o acesso para{' '}
          <span className="text-zinc-900 font-medium">{data.admin_email}</span>.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.5 }}
          className="mt-10"
        >
          <button
            onClick={() => router.push('/landing')}
            className="group w-full h-12 rounded-xl text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:brightness-110"
            style={{
              background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
              boxShadow:
                '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 8px 20px -8px rgba(110,86,207,0.55)',
            }}
          >
            Ir para o início
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function AccessRow({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] transition-colors"
    >
      <div
        className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
      >
        {icon}
      </div>
      <span className="text-[14px] text-zinc-900 font-medium flex-1">{label}</span>
      <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
    </a>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────────

function OnboardingPageInner() {
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingData>(() => {
    if (typeof window === 'undefined') return INITIAL_DATA;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? { ...INITIAL_DATA, ...JSON.parse(saved) } : INITIAL_DATA;
    } catch {
      return INITIAL_DATA;
    }
  });

  // Pre-seleciona plano vindo da URL (?plan=professional|enterprise)
  useEffect(() => {
    const planFromUrl = searchParams?.get('plan');
    if (planFromUrl && ['professional', 'enterprise'].includes(planFromUrl)) {
      setFormData(prev => ({ ...prev, plan_type: planFromUrl }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [qualifications, setQualifications] = useState<QualificationOption[]>(INITIAL_QUALIFICATIONS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formStartTime] = useState(() => new Date().toISOString());
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
      } catch {
        // ignore storage errors
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData]);

  // Ref pra evitar bug do duplo-clique: validateStep precisa do formData mais
  // recente, mas em React 18 onChange + onClick em eventos consecutivos podem
  // ser batched antes do re-render — fazendo validateStep usar formData antigo
  // do closure. Atualizando ref sincronicamente em handleInputChange resolve.
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const handleInputChange = (field: keyof OnboardingData, value: string) => {
    // Boolean fields handled via 'true'/'' string trick
    const booleanFields = ['accepts_insurance', 'auto_emit_nf', 'lgpd_accepted'];
    const numberFields = ['partial_charge_pct', 'followup_window_days'];

    let parsed: unknown = value;
    if (booleanFields.includes(field)) parsed = value === 'true';
    else if (numberFields.includes(field)) parsed = value === '' ? null : parseInt(value, 10);

    // Atualiza ref ANTES do setState pra que validateStep no mesmo tick veja o valor novo
    formDataRef.current = { ...formDataRef.current, [field]: parsed as never };
    setFormData(prev => ({ ...prev, [field]: parsed as never }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleQualificationToggle = (id: string) => {
    setQualifications(prev =>
      prev.map(q => (q.id === id ? { ...q, selected: !q.selected } : q))
    );
  };

  const validateStep = useCallback(
    (step: number): boolean => {
      const newErrors: Record<string, string> = {};
      const stepFields = WIZARD_STEPS[step]?.fields ?? [];
      // Lê SEMPRE o estado mais recente via ref (resolve duplo-clique)
      const data = formDataRef.current;

      stepFields.forEach(field => {
        const value = data[field as keyof OnboardingData];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          newErrors[field] = 'Este campo é obrigatório';
        }
      });

      if (stepFields.includes('admin_email') && data.admin_email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.admin_email)) {
          newErrors.admin_email = 'Email inválido';
        }
      }

      if (stepFields.includes('real_phone') && data.real_phone) {
        const normalized = normalizePhoneToE164(data.real_phone);
        if (!/^\+\d{10,15}$/.test(normalized)) {
          newErrors.real_phone = 'Telefone inválido. Informe DDD + número (ex: 11 99999-9999)';
        }
      }

      if (stepFields.includes('lgpd_accepted') && !data.lgpd_accepted) {
        newErrors.lgpd_accepted = 'Você precisa aceitar os termos para continuar';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [] // sem deps: usa formDataRef sempre atualizado
  );

  const handleNext = () => {
    // Defer pra próxima tick: garante que o React processou o último onChange
    // antes de validar. Resolve o duplo-clique residual em casos onde o user
    // clica "Próximo" muito rápido após preencher o último campo.
    requestAnimationFrame(() => {
      if (validateStep(currentStep)) {
        setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const selectedQualifications = qualifications.filter(q => q.selected).map(q => q.label);
      const formEndTime = new Date().toISOString();
      const formCompletionTime = Math.round(
        (new Date(formEndTime).getTime() - new Date(formStartTime).getTime()) / 1000
      );
      const normalizedPhone = normalizePhoneToE164(formData.real_phone);

      const payload = {
        ...formData,
        real_phone: normalizedPhone,
        qualifications: selectedQualifications,
        timestamp: formEndTime,
        source: 'singulare-onboarding-wizard',
        user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        form_start_time: formStartTime,
        form_end_time: formEndTime,
        form_completion_time: formCompletionTime,
        workflow_version: '4.0',
      };

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': '4.0.0',
          'X-Workflow-Target': 'n8n-v4',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        // Sob Medida: SEM checkout — mostra success "equipe vai contatar"
        if (result.data?.is_sob_medida || result.data?.next_step === 'awaiting_proposal') {
          setSuccessData(result.data as SuccessData);
          return;
        }
        // Demais planos: redireciona pro checkout
        const ref = result.data?.external_reference as string | undefined;
        if (ref) {
          window.location.href = `/checkout/${encodeURIComponent(ref)}`;
          return;
        }
        // Fallback (sem ref): success screen tradicional
        setSuccessData(result.data as SuccessData);
      } else {
        const msg = result.message || 'Erro desconhecido. Tente novamente.';
        toast.error(msg, { description: result.missing_fields?.join(', ') });
      }
    } catch (error) {
      const isNetworkError = error instanceof TypeError && error.message.includes('fetch');
      toast.error(
        isNetworkError
          ? 'Sem conexão. Verifique sua internet e tente novamente.'
          : 'Ocorreu um erro inesperado. Tente novamente em alguns instantes.',
        { description: error instanceof Error ? error.message : undefined }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getValueIcon = (iconName: string) => {
    const props = { className: 'w-4 h-4', strokeWidth: 1.75 };
    switch (iconName) {
      case 'clock':       return <Clock {...props} />;
      case 'heart':       return <Heart {...props} />;
      case 'trending-up': return <TrendingUp {...props} />;
      default:            return <Sparkles {...props} />;
    }
  };

  // Success
  if (successData) {
    return <SuccessScreen data={successData} />;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Step content
  // ────────────────────────────────────────────────────────────────────────────

  const renderStepContent = () => {
    switch (currentStep) {
      // ── Step 0: Profissional ───────────────────────────────────────────────
      case 0: {
        const profType = (formData.professional_type as ProfessionalTypeKey) || 'medico';
        const council = COUNCIL_BY_PROFESSIONAL[profType];
        const specialties = SPECIALTIES_BY_PROFESSIONAL[profType] ?? [];

        return (
          <div className="space-y-6">
            <Field label="Você é">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.entries(PROFESSIONAL_TYPES) as [ProfessionalTypeKey, string][]).map(([key, label]) => {
                  const selected = profType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        handleInputChange('professional_type', key);
                        // limpa especialidade ao trocar de tipo (lista muda)
                        if ((formData.professional_type as ProfessionalTypeKey) !== key) {
                          handleInputChange('speciality', '');
                        }
                      }}
                      className={`group relative w-full px-3 py-3 rounded-lg text-left transition-all ${
                        selected
                          ? 'bg-white border border-transparent'
                          : 'bg-white border border-black/[0.08] hover:border-black/20'
                      }`}
                      style={selected ? { boxShadow: `0 0 0 1px ${ACCENT}` } : undefined}
                    >
                      <span className={`text-[13px] font-medium ${selected ? '' : 'text-zinc-700'}`}
                            style={selected ? { color: ACCENT_DEEP } : undefined}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Nome completo" error={errors.doctor_name}>
              <input
                type="text"
                value={formData.doctor_name}
                onChange={e => handleInputChange('doctor_name', e.target.value)}
                placeholder="Ex: Ana Silva"
                autoComplete="name"
                className={inputClasses(!!errors.doctor_name)}
              />
            </Field>

            <Field label={council.label} hint="Registro profissional" error={errors.doctor_crm}>
              <input
                type="text"
                value={formData.doctor_crm}
                onChange={e => handleInputChange('doctor_crm', e.target.value)}
                placeholder={council.placeholder}
                className={inputClasses(!!errors.doctor_crm)}
              />
            </Field>

            <Field label="Especialidade / Área de atuação" error={errors.speciality}>
              <div className="relative">
                <select
                  value={formData.speciality}
                  onChange={e => handleInputChange('speciality', e.target.value)}
                  className={`${inputClasses(!!errors.speciality)} appearance-none pr-10 cursor-pointer`}
                >
                  <option value="">Selecione</option>
                  {specialties.map(spec => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
                <ChevronRight className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 rotate-90" />
              </div>
            </Field>
          </div>
        );
      }

      // ── Step 1: Clínica ────────────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-7">
            <Field label="Como você atende" hint="Solo, em consultório próprio, ou tem clínica com vários profissionais?">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(Object.entries(ESTABLISHMENT_SIZES) as [EstablishmentSizeKey, typeof ESTABLISHMENT_SIZES[EstablishmentSizeKey]][]).map(([key, info]) => {
                  const selected = formData.establishment_type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        handleInputChange('establishment_type', key);
                        // Auto-seleciona plano baseado no tipo de estabelecimento
                        const autoPlan = key === 'private_practice' ? 'professional'
                          : key === 'small_clinic' ? 'enterprise'
                          : 'sob_medida';
                        handleInputChange('plan_type', autoPlan);
                      }}
                      className={`group relative w-full p-4 sm:p-3.5 rounded-lg text-left transition-all min-h-[88px] ${
                        selected ? 'bg-white border border-transparent ring-1' : 'bg-white border border-black/[0.08] hover:border-black/20'
                      }`}
                      style={selected ? { boxShadow: `0 0 0 1px ${ACCENT}` } : undefined}
                    >
                      <div
                        className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${selected ? '' : 'bg-zinc-100 text-zinc-500'}`}
                        style={selected ? { background: ACCENT_SOFT, color: ACCENT_DEEP } : undefined}
                      >
                        {ESTABLISHMENT_ICONS[key]}
                      </div>
                      <div className="text-[14px] sm:text-[13px] font-semibold text-zinc-900 leading-tight">{info.label}</div>
                      <div className="text-[12px] text-zinc-500 mt-0.5">{info.desc}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label={formData.establishment_type === 'private_practice' ? 'Nome do consultório' : 'Nome da clínica'} error={errors.clinic_name}>
              <input
                type="text"
                value={formData.clinic_name}
                onChange={e => handleInputChange('clinic_name', e.target.value)}
                placeholder={formData.establishment_type === 'private_practice' ? 'Consultório Dr. Paulo' : 'Clínica Saúde & Vida'}
                autoComplete="organization"
                className={inputClasses(!!errors.clinic_name)}
              />
            </Field>

            <Field label="Email administrativo" error={errors.admin_email}>
              <input
                type="email"
                value={formData.admin_email}
                onChange={e => handleInputChange('admin_email', e.target.value)}
                placeholder="admin@clinica.com.br"
                autoComplete="email"
                className={inputClasses(!!errors.admin_email)}
              />
            </Field>

            <Field
              label="Número WhatsApp do canal de atendimento"
              hint="É o WhatsApp onde a IA vai atender pacientes (vira instância Evolution). Pode ser da clínica ou seu chip dedicado."
              error={errors.real_phone}
            >
              <input
                type="tel"
                value={formData.real_phone}
                onChange={e => handleInputChange('real_phone', e.target.value)}
                placeholder="11 99999-9999"
                autoComplete="tel"
                className={inputClasses(!!errors.real_phone)}
              />
              {formData.real_phone && !errors.real_phone && (
                <p className="text-[12px] sm:text-[11px] text-zinc-400 mt-1.5 flex items-center gap-1.5">
                  <span className="font-mono" style={{ color: ACCENT_DEEP }}>
                    {normalizePhoneToE164(formData.real_phone)}
                  </span>
                  <span>· formato internacional</span>
                </p>
              )}
            </Field>

            <Field
              label="Endereço da clínica"
              hint="Aparece no agente IA quando paciente perguntar onde fica. Pode editar depois."
            >
              <input
                type="text"
                value={(formData.address ?? '') as string}
                onChange={e => handleInputChange('address', e.target.value)}
                placeholder="Rua, número, bairro, cidade — UF"
                autoComplete="street-address"
                className={inputClasses(false)}
              />
            </Field>
          </div>
        );

      // ── Step 2: Como atende (duração — convênios e horários no próximo step)
      case 2:
        return (
          <div className="space-y-7">
            <Field label="Duração padrão da consulta" hint="Você pode ajustar caso a caso depois">
              <div className="grid grid-cols-2 gap-2">
                {['30', '60'].map(min => {
                  const selected = formData.consultation_duration === min;
                  return (
                    <button
                      key={min}
                      type="button"
                      onClick={() => handleInputChange('consultation_duration', min)}
                      className={`h-14 sm:h-12 rounded-lg text-[15px] font-medium transition-all ${
                        selected
                          ? 'bg-zinc-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                          : 'bg-white border border-black/[0.08] text-zinc-700 hover:border-black/20'
                      }`}
                    >
                      {min}<span className={selected ? 'text-white/60' : 'text-zinc-400'}> minutos</span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <p className="text-[13px] text-zinc-500 leading-relaxed">
              Próximo passo: você define dias e horários de trabalho, formas de cobrança e se atende convênios.
            </p>

            <div className="pt-2">
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-[14px] sm:text-[13px] font-medium text-zinc-900 tracking-tight">
                  Funcionalidades de interesse
                </label>
                <span className="text-[12px] sm:text-[11px] text-zinc-400">Selecione as relevantes</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {qualifications.map(q => {
                  const selected = q.selected;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleQualificationToggle(q.id)}
                      className={`group flex items-center gap-2.5 rounded-md p-3 sm:p-2.5 text-left transition-all min-h-[44px] sm:min-h-0 ${
                        selected
                          ? 'bg-white border border-transparent'
                          : 'bg-white border border-black/[0.08] hover:border-black/20'
                      }`}
                      style={selected ? { boxShadow: `0 0 0 1px ${ACCENT}` } : undefined}
                    >
                      <div
                        className={`relative h-5 w-5 sm:h-4 sm:w-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                          selected ? '' : 'border border-zinc-300'
                        }`}
                        style={selected ? { background: ACCENT_DEEP } : undefined}
                      >
                        {selected && <Check className="w-3 h-3 sm:w-2.5 sm:h-2.5 text-white" strokeWidth={3.5} />}
                      </div>
                      <span className="text-[14px] sm:text-[13px] font-medium text-zinc-800 truncate">
                        {q.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Equipe da clinica - aparece se clinica (nao private_practice) */}
            {formData.establishment_type !== 'private_practice' && (
              <ClinicTeamSection formData={formData} setFormData={setFormData} />
            )}
          </div>
        );

      // ── Step 3: Cobranca + IA + LGPD ───────────────────────────────────────
      case 3: {
        const isSolo = formData.establishment_type === 'private_practice';
        const acceptedMethods = (formData.payment_methods ?? []) as string[];
        const insuranceList = (formData.insurance_list ?? []) as string[];
        const workingHours = (formData.working_hours ?? {}) as Record<string, string>;
        const days: Array<{ key: string; label: string }> = [
          { key: 'seg', label: 'Seg' },
          { key: 'ter', label: 'Ter' },
          { key: 'qua', label: 'Qua' },
          { key: 'qui', label: 'Qui' },
          { key: 'sex', label: 'Sex' },
          { key: 'sab', label: 'Sáb' },
          { key: 'dom', label: 'Dom' },
        ];

        const toggleMethod = (m: string) => {
          const next = acceptedMethods.includes(m)
            ? acceptedMethods.filter(x => x !== m)
            : [...acceptedMethods, m];
          setFormData(prev => ({ ...prev, payment_methods: next as never }));
        };

        const toggleInsurance = (name: string) => {
          const next = insuranceList.includes(name)
            ? insuranceList.filter(x => x !== name)
            : [...insuranceList, name];
          setFormData(prev => ({ ...prev, insurance_list: next as never }));
        };

        const setWorkingHour = (day: string, value: string) => {
          setFormData(prev => ({
            ...prev,
            working_hours: { ...workingHours, [day]: value } as never,
          }));
        };

        return (
          <div className="space-y-7">
            {/* Valor consulta + métodos pagamento */}
            <div className="space-y-5">
              <Field label="Valor da consulta (R$)">
                <input
                  type="text"
                  value={formData.consultation_value ?? ''}
                  onChange={e => handleInputChange('consultation_value', e.target.value)}
                  placeholder="Ex: 250"
                  inputMode="decimal"
                  className={inputClasses(false)}
                />
              </Field>

              <div>
                <p className="text-[14px] sm:text-[13px] font-medium text-zinc-900 mb-2.5">Métodos de pagamento aceitos</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'pix',         label: 'PIX' },
                    { id: 'credit_card', label: 'Cartão' },
                    { id: 'boleto',      label: 'Boleto' },
                    { id: 'cash',        label: 'Dinheiro' },
                  ].map(m => {
                    const selected = acceptedMethods.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMethod(m.id)}
                        className={`flex items-center gap-2.5 rounded-md p-3 text-left transition-all min-h-[48px] ${
                          selected ? 'bg-white border border-transparent' : 'bg-white border border-black/[0.08] hover:border-black/20'
                        }`}
                        style={selected ? { boxShadow: `0 0 0 1px ${ACCENT}` } : undefined}
                      >
                        <div
                          className={`relative h-5 w-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                            selected ? '' : 'border border-zinc-300'
                          }`}
                          style={selected ? { background: ACCENT_DEEP } : undefined}
                        >
                          {selected && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                        </div>
                        <span className="text-[14px] font-medium text-zinc-800">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quando cobrar */}
            <Field label="Quando cobrar">
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'before', label: 'Antes da consulta', desc: 'Cobrança automática via WhatsApp' },
                  { id: 'after',  label: 'Após a consulta',   desc: 'Você ou o paciente confirma' },
                ].map(opt => {
                  const selected = formData.charge_timing === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleInputChange('charge_timing', opt.id)}
                      className={`p-3.5 rounded-lg text-left transition-all ${
                        selected ? 'bg-white border border-transparent' : 'bg-white border border-black/[0.08] hover:border-black/20'
                      }`}
                      style={selected ? { boxShadow: `0 0 0 1px ${ACCENT}` } : undefined}
                    >
                      <div className="text-[14px] font-semibold text-zinc-900">{opt.label}</div>
                      <div className="text-[12px] text-zinc-500 mt-0.5">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Parcial — só se "antes" */}
            {formData.charge_timing === 'before' && (
              <Field label="Cobrança antecipada">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 30,  label: '30% sinal' },
                    { value: 50,  label: '50%' },
                    { value: 100, label: '100%' },
                  ].map(opt => {
                    const selected = formData.partial_charge_pct === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleInputChange('partial_charge_pct', String(opt.value))}
                        className={`h-12 rounded-md text-[13px] font-semibold transition-all ${
                          selected ? 'bg-zinc-900 text-white' : 'bg-white border border-black/[0.08] text-zinc-700 hover:border-black/20'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[12px] text-zinc-500 mt-1.5">
                  {formData.partial_charge_pct !== 100
                    ? 'Saldo restante é cobrado automaticamente após a consulta.'
                    : 'Pagamento integral antes da consulta.'}
                </p>
              </Field>
            )}

            {/* Convênios */}
            <div>
              <button
                type="button"
                onClick={() => handleInputChange('accepts_insurance', formData.accepts_insurance ? '' : 'true')}
                className="flex items-center gap-3 w-full text-left"
              >
                <div
                  className={`h-5 w-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                    formData.accepts_insurance ? '' : 'border border-zinc-300'
                  }`}
                  style={formData.accepts_insurance ? { background: ACCENT_DEEP } : undefined}
                >
                  {formData.accepts_insurance && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-zinc-900">Aceito convênios</div>
                  <div className="text-[12px] text-zinc-500">Selecione os planos abaixo</div>
                </div>
              </button>

              {formData.accepts_insurance && (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {COMMON_INSURANCES.map(name => {
                      const selected = insuranceList.includes(name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleInsurance(name)}
                          className={`px-3 py-2 rounded-md text-left text-[13px] font-medium transition-all ${
                            selected ? 'bg-zinc-900 text-white' : 'bg-white border border-black/[0.08] text-zinc-700 hover:border-black/20'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3">
                    <input
                      type="text"
                      value={(formData.insurance_other ?? '') as string}
                      onChange={e => handleInputChange('insurance_other', e.target.value)}
                      placeholder="Outros planos (separe por vírgula)"
                      className={inputClasses(false)}
                    />
                    <p className="text-[11px] text-zinc-400 mt-1.5">
                      Ex: Cassi, Plan-Saúde, Mediservice…
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* NF automática */}
            <div>
              <button
                type="button"
                onClick={() => handleInputChange('auto_emit_nf', formData.auto_emit_nf ? '' : 'true')}
                className="flex items-center gap-3 w-full text-left"
              >
                <div
                  className={`h-5 w-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                    formData.auto_emit_nf ? '' : 'border border-zinc-300'
                  }`}
                  style={formData.auto_emit_nf ? { background: ACCENT_DEEP } : undefined}
                >
                  {formData.auto_emit_nf && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-zinc-900">Solicitar Nota Fiscal automaticamente</div>
                  <div className="text-[12px] text-zinc-500">Solicita NF ao contador e acompanha envio ao paciente</div>
                </div>
              </button>
              {formData.auto_emit_nf && (
                <input
                  type="email"
                  value={formData.accountant_email ?? ''}
                  onChange={e => handleInputChange('accountant_email', e.target.value)}
                  placeholder="email do contador"
                  className={`mt-3 ${inputClasses(false)}`}
                />
              )}
            </div>

            {/* Working hours — só se private_practice */}
            {isSolo && (
              <Field
                label="Dias e horários de atendimento"
                hint="Adicione mais de um intervalo se houver pausa pro almoço"
              >
                <div className="space-y-2">
                  {days.map(d => {
                    const raw = workingHours[d.key] ?? 'fechado';
                    const intervals = parseDayIntervals(raw);
                    const isClosed = intervals.length === 0;
                    return (
                      <div
                        key={d.key}
                        className={`rounded-lg border p-3 transition-colors ${
                          isClosed ? 'bg-zinc-50 border-black/[0.06]' : 'bg-white border-black/10'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => setWorkingHour(d.key, isClosed ? '08:00-18:00' : 'fechado')}
                            className={`flex-shrink-0 inline-flex items-center justify-center w-12 h-9 rounded-md text-[12px] font-semibold transition-all ${
                              isClosed
                                ? 'bg-white border border-black/[0.10] text-zinc-400'
                                : 'text-white'
                            }`}
                            style={!isClosed ? { background: ACCENT_DEEP } : undefined}
                            aria-label={isClosed ? `${d.label} fechado` : `${d.label} aberto`}
                          >
                            {d.label}
                          </button>
                          <div className="flex-1 min-w-0">
                            {isClosed ? (
                              <span className="text-[12px] text-zinc-400 italic block mt-2">fechado</span>
                            ) : (
                              <div className="space-y-1.5">
                                {intervals.map((iv, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5">
                                    <input
                                      type="time"
                                      value={iv.start}
                                      onChange={e => {
                                        const next = [...intervals];
                                        next[idx] = { ...next[idx], start: e.target.value };
                                        setWorkingHour(d.key, serializeDayIntervals(next));
                                      }}
                                      className="h-9 px-2 text-[13px] rounded-md border border-black/10 bg-white focus:outline-none focus:border-zinc-900"
                                    />
                                    <span className="text-[12px] text-zinc-400">–</span>
                                    <input
                                      type="time"
                                      value={iv.end}
                                      onChange={e => {
                                        const next = [...intervals];
                                        next[idx] = { ...next[idx], end: e.target.value };
                                        setWorkingHour(d.key, serializeDayIntervals(next));
                                      }}
                                      className="h-9 px-2 text-[13px] rounded-md border border-black/10 bg-white focus:outline-none focus:border-zinc-900"
                                    />
                                    {intervals.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => setWorkingHour(d.key, serializeDayIntervals(intervals.filter((_, i) => i !== idx)))}
                                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                        aria-label="Remover intervalo"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setWorkingHour(d.key, serializeDayIntervals([...intervals, { start: '14:00', end: '18:00' }]))}
                                  className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-700 hover:text-violet-900 transition-colors"
                                >
                                  <Plus className="w-3 h-3" /> intervalo
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1.5">
                  A IA usa esses horários pra propor encaixes aos pacientes via WhatsApp.
                </p>
              </Field>
            )}

            {/* Janela de retorno */}
            <Field
              label="Janela de retorno (dias)"
              hint="Retorno é gratuito"
            >
              <div className="grid grid-cols-2 gap-2">
                {[30, 45].map(days => {
                  const selected = (formData.followup_window_days ?? 30) === days;
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => handleInputChange('followup_window_days', String(days))}
                      className={`h-12 rounded-md text-[13px] font-semibold transition-all ${
                        selected
                          ? 'bg-zinc-900 text-white'
                          : 'bg-white border border-black/[0.08] text-zinc-700 hover:border-black/20'
                      }`}
                    >
                      {days} dias
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1.5">
                Período em que o paciente pode marcar retorno gratuito após a consulta.
              </p>
            </Field>

            {/* Personalize sua IA */}
            <Field label="Personalize sua IA" hint="Opcional">
              <textarea
                value={formData.assistant_prompt ?? ''}
                onChange={e => handleInputChange('assistant_prompt', e.target.value)}
                placeholder="Ex: Sempre cumprimente o paciente pelo primeiro nome. Não responda perguntas clínicas — encaminhe para agendar consulta. Use linguagem informal."
                rows={5}
                className="w-full px-3.5 py-3 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all resize-none"
              />
              <p className="text-[12px] text-zinc-500 mt-1.5">
                Direcione o tom, regras e limites do agente IA. Pode editar a qualquer momento depois.
              </p>
            </Field>

            {/* LGPD */}
            <div className="rounded-xl border border-black/[0.07] bg-zinc-50/60 p-4">
              <button
                type="button"
                onClick={() => handleInputChange('lgpd_accepted', formData.lgpd_accepted ? '' : 'true')}
                className="flex items-start gap-3 w-full text-left"
              >
                <div
                  className={`mt-0.5 h-5 w-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                    formData.lgpd_accepted ? '' : 'border border-zinc-300 bg-white'
                  }`}
                  style={formData.lgpd_accepted ? { background: ACCENT_DEEP } : undefined}
                >
                  {formData.lgpd_accepted && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                </div>
                <div className="text-[13px] text-zinc-700 leading-relaxed">
                  Li e aceito os{' '}
                  <a href="/termos" target="_blank" className="underline" style={{ color: ACCENT_DEEP }}>termos de uso</a>
                  {' '}e a{' '}
                  <a href="/privacidade" target="_blank" className="underline" style={{ color: ACCENT_DEEP }}>política de privacidade</a>
                  , autorizando o tratamento dos meus dados em conformidade com a LGPD.
                </div>
              </button>
              {errors.lgpd_accepted && (
                <p className="text-[12px] text-rose-600 mt-2 ml-8">{errors.lgpd_accepted}</p>
              )}
            </div>
          </div>
        );
      }

      // ── Step 4: Plano (auto) + Add-on + Confirmação ────────────────────────
      case 4: {
        const profType = (formData.professional_type as ProfessionalTypeKey) || 'medico';
        const council = COUNCIL_BY_PROFESSIONAL[profType];
        const acceptedMethods = (formData.payment_methods ?? []) as string[];
        const insuranceList = (formData.insurance_list ?? []) as string[];
        const isSobMedida = formData.establishment_type === 'large_clinic';
        const activePlan = isSobMedida ? null : PLAN_DETAILS[formData.plan_type];
        const addonSelected = !!formData.addon_human_support;

        return (
          <div className="space-y-6">
            {/* ── Plano determinado automaticamente ───────────────────── */}
            {activePlan && (
              <div
                className="rounded-xl border-2 p-5"
                style={{ borderColor: ACCENT, background: ACCENT_SOFT }}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold" style={{ color: ACCENT_DEEP }}>
                      {activePlan.label}
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full text-white"
                      style={{ background: ACCENT }}
                    >
                      Seu plano
                    </span>
                  </div>
                  <span className="text-[20px] font-bold text-zinc-900">
                    {activePlan.price}<span className="text-[12px] font-normal text-zinc-400">/mês</span>
                  </span>
                </div>
                <p className="text-[12px] text-zinc-500 mb-3">{activePlan.desc}</p>
                <ul className="space-y-1.5">
                  {activePlan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-[12px] text-zinc-700">
                      <div
                        className="h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: 'white' }}
                      >
                        <Check className="w-2.5 h-2.5" strokeWidth={3} style={{ color: ACCENT_DEEP }} />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-zinc-400 mt-3">7 dias grátis · Cadastro rápido</p>
              </div>
            )}

            {/* ── Sob Medida: coleta informações ──────────────────────── */}
            {isSobMedida && (
              <div className="space-y-4">
                <div
                  className="rounded-xl border-2 p-5"
                  style={{ borderColor: ACCENT, background: ACCENT_SOFT }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-semibold" style={{ color: ACCENT_DEEP }}>
                      Sob Medida
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full text-white"
                      style={{ background: ACCENT }}
                    >
                      Proposta personalizada
                    </span>
                  </div>
                  <p className="text-[13px] text-zinc-600 leading-relaxed">
                    Para clínicas com +5 profissionais, desenhamos uma solução sob medida.
                    Preencha abaixo para que nossa equipe prepare sua proposta.
                  </p>
                </div>

                <Field label="Quantos profissionais?" hint="Estimativa">
                  <input
                    type="text"
                    value={formData.sob_medida_num_profissionais ?? ''}
                    onChange={e => handleInputChange('sob_medida_num_profissionais', e.target.value)}
                    placeholder="Ex: 12"
                    inputMode="numeric"
                    className={inputClasses(false)}
                  />
                </Field>

                <Field label="Quantas unidades / filiais?" hint="Opcional">
                  <input
                    type="text"
                    value={formData.sob_medida_num_unidades ?? ''}
                    onChange={e => handleInputChange('sob_medida_num_unidades', e.target.value)}
                    placeholder="Ex: 3"
                    inputMode="numeric"
                    className={inputClasses(false)}
                  />
                </Field>

                <Field label="Necessidades específicas" hint="Integrações, fluxos, etc.">
                  <textarea
                    value={formData.sob_medida_necessidades ?? ''}
                    onChange={e => handleInputChange('sob_medida_necessidades', e.target.value)}
                    placeholder="Ex: Integração com sistema próprio de prontuário, múltiplas agendas por unidade..."
                    rows={3}
                    className="w-full px-3.5 py-3 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all resize-none"
                  />
                </Field>
              </div>
            )}

            {/* ── Add-on: Singulare Atendimento ───────────────────────── */}
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({
                  ...prev,
                  addon_human_support: !addonSelected as never,
                }));
              }}
              className={`w-full text-left rounded-xl p-5 transition-all ${
                addonSelected
                  ? 'bg-white border-2'
                  : 'bg-white border border-black/[0.08] hover:border-black/20'
              }`}
              style={addonSelected ? { borderColor: ACCENT } : undefined}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 h-5 w-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                    addonSelected ? '' : 'border border-zinc-300'
                  }`}
                  style={addonSelected ? { background: ACCENT_DEEP } : undefined}
                >
                  {addonSelected && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-semibold text-zinc-900">Singulare Atendimento</span>
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full text-white"
                      style={{ background: ACCENT }}
                    >
                      Add-on
                    </span>
                  </div>
                  <p className="text-[12px] text-zinc-500 leading-relaxed mb-2">
                    Quando a IA detecta que o paciente precisa de atendimento humano, nossa equipe assume a conversa no nome da sua clínica.
                    Você não contrata, não treina, não gerencia ninguém.
                  </p>
                  {isSobMedida ? (
                    <div className="text-[11px] text-zinc-400">
                      Valor incluído na proposta sob medida.
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[11px] text-zinc-400">A partir de</span>
                      <span className="text-[16px] font-bold text-zinc-900">R$ 297</span>
                      <span className="text-[11px] text-zinc-400">/mês · adicional ao plano</span>
                    </div>
                  )}
                </div>
              </div>
            </button>

            <Hairline />

            {/* ── Review blocks ────────────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-400 font-medium">
                Resumo
              </p>
              <ReviewBlock
                icon={<User className="w-3.5 h-3.5" strokeWidth={1.75} />}
                title="Profissional"
                rows={[
                  ['Tipo', PROFESSIONAL_TYPES[profType]],
                  ['Nome', formData.doctor_name],
                  [council.label, formData.doctor_crm],
                  ['Especialidade', formData.speciality],
                ]}
              />
              <ReviewBlock
                icon={<Building2 className="w-3.5 h-3.5" strokeWidth={1.75} />}
                title="Clínica"
                rows={[
                  ['Nome', formData.clinic_name],
                  ['Email', formData.admin_email],
                  ['Telefone', normalizePhoneToE164(formData.real_phone)],
                ]}
              />
              <ReviewBlock
                icon={<Settings className="w-3.5 h-3.5" strokeWidth={1.75} />}
                title="Configuração"
                rows={[
                  ['Consulta', `${formData.consultation_duration} min`],
                  [
                    'Estabelecimento',
                    ESTABLISHMENT_SIZES[formData.establishment_type as EstablishmentSizeKey]?.label
                      ?? formData.establishment_type,
                  ],
                  ['Plano', isSobMedida ? 'Sob Medida (proposta personalizada)' : (PLAN_DETAILS[formData.plan_type]?.label + ' — ' + PLAN_DETAILS[formData.plan_type]?.price + '/mês'), true],
                  ...(addonSelected ? [['Add-on', 'Singulare Atendimento'] as [string, string]] : []),
                ]}
              />
              {(formData.consultation_value || acceptedMethods.length > 0) && (
                <ReviewBlock
                  icon={<CreditCard className="w-3.5 h-3.5" strokeWidth={1.75} />}
                  title="Cobrança"
                  rows={[
                    ...(formData.consultation_value ? [['Valor', `R$ ${formData.consultation_value}`] as [string, string]] : []),
                    ...(acceptedMethods.length ? [['Métodos', acceptedMethods.join(', ').toUpperCase()] as [string, string]] : []),
                    ...(formData.charge_timing ? [['Quando', formData.charge_timing === 'before' ? `${formData.partial_charge_pct}% antes` : 'Após consulta'] as [string, string]] : []),
                    ...(formData.accepts_insurance ? [['Convênios', insuranceList.length ? insuranceList.join(', ') : 'Sim'] as [string, string]] : []),
                    ...(formData.auto_emit_nf ? [['NF auto', formData.accountant_email || 'Sim'] as [string, string]] : []),
                  ]}
                />
              )}
            </div>

            <p className="text-[12px] text-zinc-500 text-center pt-1 leading-relaxed">
              {isSobMedida
                ? 'Nossa equipe entrará em contato para desenhar a solução ideal para sua clínica.'
                : '7 dias grátis · Ao finalizar, sua conta será criada e as integrações ativadas automaticamente.'}
            </p>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const step = WIZARD_STEPS[currentStep];

  return (
    <div className="relative min-h-screen bg-[#FAFAF7] text-zinc-900 selection:bg-zinc-900 selection:text-white pb-28 md:pb-0">
      <Atmosphere />

      {/* Top bar */}
      <header className="relative border-b border-black/[0.06] bg-white/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-14 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logos/singulare-a.svg"
              alt="Singulare"
              width={120}
              height={40}
              className="h-10 sm:h-11 w-auto"
              priority
            />
          </div>
          <div className="flex items-center gap-4 sm:gap-5 text-[13px] sm:text-[12px] text-zinc-500">
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <Lock className="w-3 h-3" strokeWidth={2} />
              Conexão segura
            </span>
            <span className="font-semibold text-zinc-900">
              <span>{currentStep + 1}</span>
              <span className="text-zinc-400 font-normal"> / {WIZARD_STEPS.length}</span>
            </span>
          </div>
        </div>
        {/* Mobile inline progress bar — sits flush with topbar */}
        <div className="md:hidden flex items-center gap-1 px-5 pb-2 -mt-1">
          {WIZARD_STEPS.map((s, i) => (
            <div key={s.id} className="flex-1 h-[3px] rounded-full bg-black/[0.06] overflow-hidden">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{
                  background:
                    i <= currentStep
                      ? `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DEEP})`
                      : 'transparent',
                }}
                initial={false}
                animate={{ scaleX: i < currentStep ? 1 : i === currentStep ? 1 : 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          ))}
        </div>
      </header>

      <main className="relative max-w-xl mx-auto px-5 sm:px-6 pt-8 sm:pt-16 pb-12 sm:pb-24">
        {/* Step pill row — desktop only (mobile uses topbar progress) */}
        <div className="hidden md:flex items-center gap-1.5 mb-10">
          {WIZARD_STEPS.map((s, i) => (
            <div key={s.id} className="flex-1 h-[3px] rounded-full bg-black/[0.06] overflow-hidden">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{
                  background:
                    i <= currentStep
                      ? `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DEEP})`
                      : 'transparent',
                }}
                initial={false}
                animate={{
                  scaleX: i < currentStep ? 1 : i === currentStep ? 1 : 0,
                }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          ))}
        </div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-7 sm:mb-8"
        >
          <p
            className="text-[12px] sm:text-[11px] uppercase tracking-[0.12em] sm:tracking-[0.1em] font-semibold mb-3 sm:mb-2"
            style={{ color: ACCENT_DEEP }}
          >
            Etapa {currentStep + 1} de {WIZARD_STEPS.length}
          </p>
          <h1 className="text-[34px] sm:text-[32px] md:text-[36px] leading-[1.05] tracking-[-0.03em] sm:tracking-[-0.025em] font-medium text-zinc-900">
            {currentStep === 0 ? (
              <>
                <span className="font-serif italic font-normal text-zinc-700">Vamos</span>{' '}
                conhecer você.
              </>
            ) : currentStep === 1 ? (
              <>
                Seu <span className="font-serif italic font-normal text-zinc-700">consultório</span>,
                em poucos campos.
              </>
            ) : currentStep === 2 ? (
              <>
                Como você prefere{' '}
                <span className="font-serif italic font-normal text-zinc-700">atender?</span>
              </>
            ) : currentStep === 3 ? (
              <>
                Cobrança e{' '}
                <span className="font-serif italic font-normal text-zinc-700">sua IA.</span>
              </>
            ) : (
              <>
                Confirme{' '}
                <span className="font-serif italic font-normal text-zinc-700">e finalize.</span>
              </>
            )}
          </h1>
          <p className="mt-4 sm:mt-3 text-[16px] sm:text-[15px] text-zinc-500 leading-[1.5] sm:leading-relaxed">{step?.description}</p>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.10)] overflow-hidden"
        >
          <div className="p-6 sm:p-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Desktop footer nav — hidden on mobile */}
          <div className="hidden md:block">
            <Hairline />
            <div className="flex items-center justify-between px-7 py-4 bg-zinc-50/60">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="h-9 px-3.5 rounded-md text-[13px] font-semibold text-zinc-900 border border-black/[0.10] hover:border-black/30 hover:bg-black/[0.03] inline-flex items-center gap-1.5 transition-all disabled:opacity-30 disabled:border-black/[0.06] disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:text-zinc-400 disabled:font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar
              </button>

              {currentStep < WIZARD_STEPS.length - 1 ? (
                <div className="flex items-center gap-2">
                  {WIZARD_STEPS[currentStep]?.optional && (
                    <button
                      type="button"
                      onClick={() => { setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="h-9 px-3 rounded-md text-[12.5px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.04] transition-colors"
                      title="Pular esta etapa e configurar depois no painel"
                    >
                      Configurar depois →
                    </button>
                  )}
                  <motion.button
                    type="button"
                    onClick={handleNext}
                    whileTap={{ scale: 0.98 }}
                    className="group h-9 pl-4 pr-3.5 rounded-md text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110"
                    style={{
                      background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                      boxShadow:
                        '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 4px 12px -4px rgba(110,86,207,0.5)',
                    }}
                  >
                    Próximo
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </motion.button>
                </div>
              ) : (
                <motion.button
                  type="button"
                  onClick={handleSubmitOnboarding}
                  disabled={isSubmitting}
                  whileTap={{ scale: 0.98 }}
                  className="group h-9 pl-4 pr-3.5 rounded-md text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-70 disabled:cursor-wait"
                  style={{
                    background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                    boxShadow:
                      '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 4px 12px -4px rgba(110,86,207,0.5)',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {formData.establishment_type === 'large_clinic' ? 'Enviando…' : 'Configurando…'}
                    </>
                  ) : (
                    <>
                      {formData.establishment_type === 'large_clinic' ? 'Solicitar proposta' : 'Criar conta'}
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Mobile sticky bottom nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/90 backdrop-blur-xl border-t border-black/[0.07]">
          <div className="flex items-center gap-3 relative">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="flex-shrink-0 rounded-xl border border-black/[0.08] text-zinc-700 inline-flex items-center justify-center transition-all hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              aria-label="Voltar"
              style={{ height: '52px', width: '52px' }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {currentStep < WIZARD_STEPS.length - 1 ? (
              <>
                <motion.button
                  type="button"
                  onClick={handleNext}
                  whileTap={{ scale: 0.98 }}
                  className="group flex-1 rounded-xl text-white text-[16px] font-semibold inline-flex items-center justify-center gap-2 transition-all hover:brightness-110"
                  style={{
                    height: '52px',
                    background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                    boxShadow:
                      '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 8px 22px -6px rgba(110,86,207,0.6)',
                  }}
                >
                  Continuar
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </motion.button>
                {WIZARD_STEPS[currentStep]?.optional && (
                  <button
                    type="button"
                    onClick={() => { setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="absolute left-0 right-0 -top-7 text-center text-[12px] font-medium text-zinc-500 hover:text-zinc-900"
                  >
                    Configurar depois →
                  </button>
                )}
              </>
            ) : (
              <motion.button
                type="button"
                onClick={handleSubmitOnboarding}
                disabled={isSubmitting}
                whileTap={{ scale: 0.98 }}
                className="group flex-1 rounded-xl text-white text-[16px] font-semibold inline-flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-70 disabled:cursor-wait"
                style={{
                  height: '52px',
                  background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                  boxShadow:
                    '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 8px 22px -6px rgba(110,86,207,0.6)',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {formData.establishment_type === 'large_clinic' ? 'Enviando…' : 'Configurando…'}
                  </>
                ) : (
                  <>
                    {formData.establishment_type === 'large_clinic' ? 'Solicitar proposta' : 'Criar minha conta'}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>

        {/* Value blocks — only on step 0, restrained, with subtle tilt */}
        <AnimatePresence>
          {currentStep === 0 && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="mt-14"
            >
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="text-[10px] uppercase tracking-[0.12em] font-semibold"
                  style={{ color: ACCENT_DEEP }}
                >
                  Por que Singulare
                </div>
                <div className="flex-1 h-px bg-black/[0.07]" />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {VALUE_BLOCKS.map((block, i) => (
                  <Tilt key={block.title} max={4} scale={1.015}>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + i * 0.07, duration: 0.5 }}
                      className="rounded-xl border border-black/[0.07] bg-white/80 backdrop-blur-sm p-5 sm:p-4 h-full"
                    >
                      <div
                        className="inline-flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-md mb-3"
                        style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
                      >
                        {getValueIcon(block.icon)}
                      </div>
                      <h3 className="text-[14px] sm:text-[13px] font-semibold text-zinc-900 leading-snug mb-1.5">
                        {block.title}
                      </h3>
                      <p className="text-[13px] sm:text-[12px] leading-relaxed text-zinc-500">
                        {block.description}
                      </p>
                    </motion.div>
                  </Tilt>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Footer trust strip — desktop emphasis, condensed on mobile */}
        <div className="mt-10 sm:mt-16 flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-5 gap-y-1.5 text-[12px] sm:text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Shield className="w-3 h-3" strokeWidth={2} />
            Dados criptografados
          </span>
          <span className="h-1 w-1 rounded-full bg-zinc-300" />
          <span>7 dias grátis</span>
          <span className="h-1 w-1 rounded-full bg-zinc-300" />
          <span>Cancele quando quiser</span>
          <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-zinc-300" />
          <span className="hidden sm:inline">~5 min</span>
        </div>
      </main>
    </div>
  );
}

// useSearchParams() exige Suspense boundary no Next.js 14 App Router
export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />
      </div>
    }>
      <OnboardingPageInner />
    </Suspense>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Clinic Team — cadastro opcional de profissionais adicionais
// ──────────────────────────────────────────────────────────────────────────────

interface AdditionalDoctor {
  doctor_name: string;
  doctor_crm: string;
  specialty: string;
  professional_type: string;
}

function ClinicTeamSection({
  formData,
  setFormData,
}: {
  formData: OnboardingData;
  setFormData: React.Dispatch<React.SetStateAction<OnboardingData>>;
}) {
  type Mode = 'closed' | 'now' | 'later';
  const initialMode: Mode = (formData.additional_doctors?.length ?? 0) > 0 ? 'now' : 'closed';
  const [mode, setMode] = useState<Mode>(initialMode);

  const docs = (formData.additional_doctors ?? []) as AdditionalDoctor[];
  const isLargeClinic = formData.establishment_type === 'large_clinic';
  const maxAdditional = isLargeClinic ? 4 : 4; // ate 4 adicionais (5 total com o primario)

  const addDoctor = () => {
    if (docs.length >= maxAdditional) return;
    const next = [...docs, { doctor_name: '', doctor_crm: '', specialty: '', professional_type: formData.professional_type }];
    setFormData((prev) => ({ ...prev, additional_doctors: next as never }));
  };

  const removeDoctor = (idx: number) => {
    const next = docs.filter((_, i) => i !== idx);
    setFormData((prev) => ({ ...prev, additional_doctors: next as never }));
  };

  const updateDoctor = (idx: number, field: keyof AdditionalDoctor, value: string) => {
    const next = docs.map((d, i) => (i === idx ? { ...d, [field]: value } : d));
    setFormData((prev) => ({ ...prev, additional_doctors: next as never }));
  };

  const startNow = () => {
    setMode('now');
    if (docs.length === 0) addDoctor();
  };

  const startLater = () => {
    setMode('later');
    setFormData((prev) => ({ ...prev, additional_doctors: [] as never }));
  };

  return (
    <div className="rounded-2xl border border-black/[0.07] bg-zinc-50/40 p-5">
      <div className="flex items-start gap-3 mb-3">
        <div
          className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
        >
          <User className="w-4 h-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-zinc-900">Equipe da clínica</p>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            {isLargeClinic
              ? 'Cadastre até 5 profissionais. Os demais ficam pro painel após o login.'
              : 'Você pode cadastrar até 5 profissionais agora ou só pelo painel depois.'}
          </p>
        </div>
      </div>

      {mode === 'closed' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <button
            type="button"
            onClick={startNow}
            className="h-12 rounded-lg text-white text-[14px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all hover:brightness-110"
            style={{
              background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
              boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 6px 18px -6px rgba(110,86,207,0.55)',
            }}
          >
            Cadastrar agora
          </button>
          <button
            type="button"
            onClick={startLater}
            className="h-12 rounded-lg border border-black/[0.10] text-zinc-700 text-[14px] font-semibold hover:border-black/30 hover:bg-black/[0.02] transition-colors"
          >
            Configurar depois
          </button>
        </div>
      )}

      {mode === 'later' && (
        <p className="text-[13px] text-zinc-500 mt-2 italic">
          Você poderá cadastrar profissionais a qualquer momento em <strong>Painel → Profissionais</strong>.
          <button
            type="button"
            onClick={() => setMode('closed')}
            className="ml-2 text-[12px] underline"
            style={{ color: ACCENT_DEEP }}
          >
            Mudar de ideia
          </button>
        </p>
      )}

      {mode === 'now' && (
        <div className="space-y-3 mt-3">
          {docs.map((d, i) => (
            <div key={i} className="rounded-xl border border-black/[0.07] bg-white p-4 relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
                  Profissional {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeDoctor(i)}
                  className="text-[12px] text-rose-600 hover:underline"
                >
                  Remover
                </button>
              </div>
              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={d.doctor_name}
                  onChange={(e) => updateDoctor(i, 'doctor_name', e.target.value)}
                  className="w-full h-11 px-3.5 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Registro (CRM/CRO/CRP...)"
                    value={d.doctor_crm}
                    onChange={(e) => updateDoctor(i, 'doctor_crm', e.target.value)}
                    className="w-full h-11 px-3.5 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
                  />
                  <input
                    type="text"
                    placeholder="Especialidade"
                    value={d.specialty}
                    onChange={(e) => updateDoctor(i, 'specialty', e.target.value)}
                    className="w-full h-11 px-3.5 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {docs.length < maxAdditional && (
              <button
                type="button"
                onClick={addDoctor}
                className="h-11 px-4 rounded-lg border border-dashed border-black/[0.15] text-zinc-700 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 hover:border-black/30 hover:bg-black/[0.02] transition-all"
              >
                + Adicionar profissional
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMode('later');
                setFormData((prev) => ({ ...prev, additional_doctors: [] as never }));
              }}
              className="text-[12px] text-zinc-500 hover:text-zinc-900 underline sm:ml-auto"
            >
              Pular e configurar no painel
            </button>
          </div>

          {docs.length > 0 && (
            <p className="text-[11px] text-zinc-400 mt-2">
              Os dados completos (valor, horários, métodos pagamento) são preenchidos depois no painel.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Review block (step 3)
// ──────────────────────────────────────────────────────────────────────────────

function ReviewBlock({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  rows: Array<[string, string, boolean?]>;
}) {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <div
          className="h-6 w-6 rounded-md flex items-center justify-center"
          style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
        >
          {icon}
        </div>
        <h3 className="text-[12px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
          {title}
        </h3>
      </div>
      <Hairline />
      <dl className="divide-y divide-black/[0.05]">
        {rows.map(([k, v, accent]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 px-4 py-3 sm:py-2.5">
            <dt className="text-[13px] sm:text-[12px] text-zinc-500">{k}</dt>
            <dd
              className="text-[14px] sm:text-[13px] font-medium text-right truncate capitalize"
              style={accent ? { color: ACCENT_DEEP } : undefined}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
