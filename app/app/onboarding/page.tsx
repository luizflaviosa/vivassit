'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useRouter } from 'next/navigation';
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
  Star,
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
} from 'lucide-react';
import {
  OnboardingData,
  ValueBlock,
  QualificationOption,
  WizardStep,
  ESTABLISHMENT_TYPES,
  PLAN_TYPES,
  SPECIALITIES,
} from '@/lib/types';

// ──────────────────────────────────────────────────────────────────────────────
// Design tokens (inline so this file is self-contained)
// ──────────────────────────────────────────────────────────────────────────────

const ACCENT = '#6E56CF';        // primary violet (refined)
const ACCENT_DEEP = '#5746AF';   // text-on-light accent
const ACCENT_SOFT = '#F5F3FF';   // tinted surface

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const PLAN_DETAILS: Record<string, { label: string; desc: string; highlight?: boolean }> = {
  basic:        { label: 'Básico',       desc: 'Para início de carreira' },
  professional: { label: 'Profissional', desc: 'Mais escolhido pelos médicos', highlight: true },
  premium:      { label: 'Premium',      desc: 'Recursos avançados de gestão' },
  enterprise:   { label: 'Corporativo',  desc: 'Para grandes volumes' },
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
      'Agendamento inteligente e lembretes automáticos. Você foca no paciente, a Vivassit cuida da burocracia.',
  },
  {
    icon: 'heart',
    title: 'Uma ponte direta com o paciente',
    description:
      'Comunicação fluida via WhatsApp e histórico 100% digital com cada detalhe centralizado.',
  },
  {
    icon: 'trending-up',
    title: 'Sua prática, mais lucrativa',
    description:
      'Reduza faltas em até 60% e receba pagamentos seguros, com relatórios que mostram o crescimento.',
  },
];

const INITIAL_QUALIFICATIONS: QualificationOption[] = [
  { id: 'telemedicine', label: 'Telemedicina', selected: false },
  { id: 'agenda', label: 'Gestão de Agenda', selected: true },
  { id: 'billing', label: 'Faturamento', selected: false },
  { id: 'patients', label: 'Cadastro de Pacientes', selected: true },
  { id: 'reports', label: 'Relatórios Médicos', selected: false },
  { id: 'integration', label: 'Integração com Planos', selected: true },
];

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    title: 'Profissional',
    description: 'Quem é você como profissional de saúde',
    fields: ['doctor_name', 'doctor_crm', 'speciality'],
  },
  {
    id: 2,
    title: 'Clínica',
    description: 'Informações do seu estabelecimento',
    fields: ['clinic_name', 'admin_email', 'real_phone'],
  },
  {
    id: 3,
    title: 'Preferências',
    description: 'Configure o atendimento do seu jeito',
    fields: ['consultation_duration', 'establishment_type', 'plan_type'],
  },
  {
    id: 4,
    title: 'Confirmar',
    description: 'Revise as informações e finalize',
    fields: [],
  },
];

const INITIAL_DATA: OnboardingData = {
  real_phone: '',
  clinic_name: '',
  admin_email: '',
  doctor_name: '',
  doctor_crm: '',
  speciality: '',
  consultation_duration: '30',
  establishment_type: 'small_clinic',
  plan_type: 'professional',
};

const DRAFT_KEY = 'vivassit_onboarding_draft';

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
        <label className="text-[13px] font-medium text-zinc-900 tracking-tight">{label}</label>
        {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
      </div>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            className="text-[12px] text-rose-600 flex items-center gap-1.5"
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
  'w-full h-11 px-3.5 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 ' +
  'rounded-lg border transition-all duration-150 ' +
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

      <div className="relative max-w-xl mx-auto px-6 pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center mb-8">
            <Image
              src="https://cdn.abacus.ai/images/904c7894-74de-41eb-a89d-950fb291aeda.png"
              alt="Vivassit"
              width={120}
              height={40}
              className="h-9 w-auto"
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

          <h1 className="text-[40px] leading-[1.05] tracking-[-0.03em] font-medium text-zinc-900 mb-3">
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

        {/* Access links */}
        {(data.calendar_link || data.telegram_link || data.whatsapp_pairing_code || data.drive_link) && (
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
              {data.whatsapp_pairing_code && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="h-7 w-7 rounded-md flex items-center justify-center text-emerald-700 flex-shrink-0"
                    style={{ background: '#ECFDF5' }}
                  >
                    <Phone className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div className="text-[14px] text-zinc-700">
                    Código WhatsApp:{' '}
                    <code className="font-mono font-semibold text-emerald-700">
                      {data.whatsapp_pairing_code}
                    </code>
                  </div>
                </div>
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
          Verifique <span className="text-zinc-900 font-medium">{data.admin_email}</span> nos
          próximos minutos para acessar o painel.
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

export default function OnboardingPage() {
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

  const handleInputChange = (field: keyof OnboardingData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

      stepFields.forEach(field => {
        const value = formData[field as keyof OnboardingData];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          newErrors[field] = 'Este campo é obrigatório';
        }
      });

      if (stepFields.includes('admin_email') && formData.admin_email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
          newErrors.admin_email = 'Email inválido';
        }
      }

      if (stepFields.includes('real_phone') && formData.real_phone) {
        const normalized = normalizePhoneToE164(formData.real_phone);
        if (!/^\+\d{10,15}$/.test(normalized)) {
          newErrors.real_phone = 'Telefone inválido. Informe DDD + número (ex: 11 99999-9999)';
        }
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [formData]
  );

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
        source: 'vivassit-onboarding-wizard',
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
      case 0:
        return (
          <div className="space-y-5">
            <Field label="Nome completo" error={errors.doctor_name}>
              <input
                type="text"
                value={formData.doctor_name}
                onChange={e => handleInputChange('doctor_name', e.target.value)}
                placeholder="Dr. João Silva"
                autoComplete="name"
                className={inputClasses(!!errors.doctor_name)}
              />
            </Field>

            <Field label="CRM" hint="Conselho Regional de Medicina" error={errors.doctor_crm}>
              <input
                type="text"
                value={formData.doctor_crm}
                onChange={e => handleInputChange('doctor_crm', e.target.value)}
                placeholder="CRM/SP 123456"
                className={inputClasses(!!errors.doctor_crm)}
              />
            </Field>

            <Field label="Especialidade" error={errors.speciality}>
              <div className="relative">
                <select
                  value={formData.speciality}
                  onChange={e => handleInputChange('speciality', e.target.value)}
                  className={`${inputClasses(!!errors.speciality)} appearance-none pr-10 cursor-pointer`}
                >
                  <option value="">Selecione sua especialidade</option>
                  {SPECIALITIES.map(spec => (
                    <option key={spec} value={spec}>
                      {spec.charAt(0).toUpperCase() + spec.slice(1)}
                    </option>
                  ))}
                </select>
                <ChevronRight className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 rotate-90" />
              </div>
            </Field>
          </div>
        );

      // ── Step 1: Clínica ────────────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-5">
            <Field label="Nome da clínica" error={errors.clinic_name}>
              <input
                type="text"
                value={formData.clinic_name}
                onChange={e => handleInputChange('clinic_name', e.target.value)}
                placeholder="Clínica Saúde & Vida"
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
              label="WhatsApp / Telefone"
              hint="DDD + número"
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
                <p className="text-[11px] text-zinc-400 mt-1.5 flex items-center gap-1.5">
                  <span className="font-mono" style={{ color: ACCENT_DEEP }}>
                    {normalizePhoneToE164(formData.real_phone)}
                  </span>
                  <span>· formato internacional</span>
                </p>
              )}
            </Field>
          </div>
        );

      // ── Step 2: Preferências ───────────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-7">
            <Field label="Duração da consulta">
              <div className="grid grid-cols-5 gap-1.5">
                {['15', '20', '30', '45', '60'].map(min => {
                  const selected = formData.consultation_duration === min;
                  return (
                    <button
                      key={min}
                      type="button"
                      onClick={() => handleInputChange('consultation_duration', min)}
                      className={`h-10 rounded-md text-[13px] font-medium transition-all ${
                        selected
                          ? 'bg-zinc-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                          : 'bg-white border border-black/[0.08] text-zinc-700 hover:border-black/20'
                      }`}
                    >
                      {min}<span className={selected ? 'text-white/60' : 'text-zinc-400'}> min</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Tipo de estabelecimento">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(ESTABLISHMENT_TYPES).map(([key, label]) => {
                  const selected = formData.establishment_type === key;
                  return (
                    <Tilt key={key} max={4} scale={1.01}>
                      <button
                        type="button"
                        onClick={() => handleInputChange('establishment_type', key)}
                        className={`group relative w-full p-3 rounded-lg text-left transition-all ${
                          selected
                            ? 'bg-white border border-transparent ring-1'
                            : 'bg-white border border-black/[0.08] hover:border-black/20'
                        }`}
                        style={selected ? { boxShadow: `0 0 0 1px ${ACCENT}` } : undefined}
                      >
                        <div
                          className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                            selected ? '' : 'bg-zinc-100 text-zinc-500'
                          }`}
                          style={selected ? { background: ACCENT_SOFT, color: ACCENT_DEEP } : undefined}
                        >
                          {ESTABLISHMENT_ICONS[key]}
                        </div>
                        <div className="text-[12px] font-medium text-zinc-900 leading-tight">
                          {label}
                        </div>
                      </button>
                    </Tilt>
                  );
                })}
              </div>
            </Field>

            <Field label="Plano">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PLAN_DETAILS).map(([key, plan]) => {
                  const selected = formData.plan_type === key;
                  return (
                    <Tilt key={key} max={5} scale={1.01} glare>
                      <button
                        type="button"
                        onClick={() => handleInputChange('plan_type', key)}
                        className={`group relative w-full p-3.5 rounded-lg text-left transition-all overflow-hidden ${
                          selected
                            ? 'bg-white border border-transparent'
                            : 'bg-white border border-black/[0.08] hover:border-black/20'
                        }`}
                        style={selected ? { boxShadow: `0 0 0 1px ${ACCENT}` } : undefined}
                      >
                        {plan.highlight && (
                          <span
                            className="absolute top-2 right-2 text-[9px] uppercase tracking-[0.08em] font-semibold px-1.5 py-0.5 rounded text-white"
                            style={{ background: ACCENT_DEEP }}
                          >
                            Popular
                          </span>
                        )}
                        <div
                          className="text-[13px] font-semibold mb-0.5"
                          style={{ color: selected ? ACCENT_DEEP : '#18181B' }}
                        >
                          {plan.label}
                        </div>
                        <div className="text-[11px] text-zinc-500 leading-snug">
                          {plan.desc}
                        </div>
                      </button>
                    </Tilt>
                  );
                })}
              </div>
            </Field>

            <div className="pt-2">
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-[13px] font-medium text-zinc-900 tracking-tight">
                  Funcionalidades de interesse
                </label>
                <span className="text-[11px] text-zinc-400">Selecione as relevantes</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {qualifications.map(q => {
                  const selected = q.selected;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleQualificationToggle(q.id)}
                      className={`group flex items-center gap-2.5 rounded-md p-2.5 text-left transition-all ${
                        selected
                          ? 'bg-white border border-transparent'
                          : 'bg-white border border-black/[0.08] hover:border-black/20'
                      }`}
                      style={selected ? { boxShadow: `0 0 0 1px ${ACCENT}` } : undefined}
                    >
                      <div
                        className={`relative h-4 w-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                          selected ? '' : 'border border-zinc-300'
                        }`}
                        style={selected ? { background: ACCENT_DEEP } : undefined}
                      >
                        {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />}
                      </div>
                      <span className="text-[13px] font-medium text-zinc-800 truncate">
                        {q.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      // ── Step 3: Confirmação ────────────────────────────────────────────────
      case 3:
        return (
          <div className="space-y-3">
            <ReviewBlock
              icon={<User className="w-3.5 h-3.5" strokeWidth={1.75} />}
              title="Profissional"
              rows={[
                ['Nome', formData.doctor_name],
                ['CRM', formData.doctor_crm],
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
              title="Preferências"
              rows={[
                ['Consulta', `${formData.consultation_duration} min`],
                [
                  'Tipo',
                  ESTABLISHMENT_TYPES[
                    formData.establishment_type as keyof typeof ESTABLISHMENT_TYPES
                  ],
                ],
                [
                  'Plano',
                  PLAN_TYPES[formData.plan_type as keyof typeof PLAN_TYPES],
                  true,
                ],
              ]}
            />
            <div className="rounded-xl border border-black/[0.07] bg-white p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div
                  className="h-6 w-6 rounded-md flex items-center justify-center"
                  style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
                >
                  <Star className="w-3.5 h-3.5" strokeWidth={1.75} />
                </div>
                <h3 className="text-[12px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
                  Funcionalidades
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {qualifications.filter(q => q.selected).map(q => (
                  <span
                    key={q.id}
                    className="text-[12px] font-medium px-2 py-1 rounded-md border border-black/[0.07] bg-zinc-50 text-zinc-700 inline-flex items-center gap-1"
                  >
                    <Check className="w-3 h-3 text-emerald-600" strokeWidth={3} />
                    {q.label}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-[12px] text-zinc-500 text-center pt-3 leading-relaxed">
              Ao finalizar, sua conta será criada e nossas integrações serão ativadas
              automaticamente.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const step = WIZARD_STEPS[currentStep];

  return (
    <div className="relative min-h-screen bg-[#FAFAF7] text-zinc-900 selection:bg-zinc-900 selection:text-white">
      <Atmosphere />

      {/* Top bar */}
      <header className="relative border-b border-black/[0.06] bg-white/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
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
          <div className="flex items-center gap-5 text-[12px] text-zinc-500">
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <Lock className="w-3 h-3" strokeWidth={2} />
              Conexão segura
            </span>
            <span className="font-medium text-zinc-900">
              <span>{currentStep + 1}</span>
              <span className="text-zinc-400 font-normal"> / {WIZARD_STEPS.length}</span>
            </span>
          </div>
        </div>
      </header>

      <main className="relative max-w-xl mx-auto px-5 sm:px-6 pt-12 sm:pt-16 pb-24">
        {/* Step pill row */}
        <div className="flex items-center gap-1.5 mb-10">
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
          className="mb-8"
        >
          <p
            className="text-[11px] uppercase tracking-[0.1em] font-semibold mb-2"
            style={{ color: ACCENT_DEEP }}
          >
            Etapa {currentStep + 1} de {WIZARD_STEPS.length}
          </p>
          <h1 className="text-[32px] sm:text-[36px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            {currentStep === 0 ? (
              <>
                <span className="font-serif italic font-normal text-zinc-700">Vamos</span>{' '}
                conhecer você.
              </>
            ) : currentStep === 1 ? (
              <>
                Sua <span className="font-serif italic font-normal text-zinc-700">clínica</span>,
                em poucos campos.
              </>
            ) : currentStep === 2 ? (
              <>
                Como você prefere{' '}
                <span className="font-serif italic font-normal text-zinc-700">atender?</span>
              </>
            ) : (
              <>
                Tudo certo.{' '}
                <span className="font-serif italic font-normal text-zinc-700">Confirme</span>{' '}
                e finalize.
              </>
            )}
          </h1>
          <p className="mt-3 text-[15px] text-zinc-500 leading-relaxed">{step?.description}</p>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.10)] overflow-hidden"
        >
          <div className="p-5 sm:p-7">
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

          <Hairline />

          {/* Footer nav */}
          <div className="flex items-center justify-between px-5 sm:px-7 py-4 bg-zinc-50/60">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="h-9 px-3 -ml-2 rounded-md text-[13px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.03] inline-flex items-center gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </button>

            {currentStep < WIZARD_STEPS.length - 1 ? (
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
                    Configurando…
                  </>
                ) : (
                  <>
                    Criar conta
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </motion.button>
            )}
          </div>
        </motion.div>

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
                  Por que Vivassit
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
                      className="rounded-xl border border-black/[0.07] bg-white/80 backdrop-blur-sm p-4 h-full"
                    >
                      <div
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md mb-3"
                        style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
                      >
                        {getValueIcon(block.icon)}
                      </div>
                      <h3 className="text-[13px] font-semibold text-zinc-900 leading-snug mb-1.5">
                        {block.title}
                      </h3>
                      <p className="text-[12px] leading-relaxed text-zinc-500">
                        {block.description}
                      </p>
                    </motion.div>
                  </Tilt>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Footer trust strip */}
        <div className="mt-16 flex items-center justify-center gap-5 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Shield className="w-3 h-3" strokeWidth={2} />
            Dados criptografados
          </span>
          <span className="h-1 w-1 rounded-full bg-zinc-300" />
          <span className="inline-flex items-center gap-1.5">
            <Star className="w-3 h-3 fill-current text-amber-400" />
            5.000+ profissionais
          </span>
          <span className="h-1 w-1 rounded-full bg-zinc-300" />
          <span>~5 min</span>
        </div>
      </main>
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
          <div key={k} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <dt className="text-[12px] text-zinc-500">{k}</dt>
            <dd
              className="text-[13px] font-medium text-right truncate capitalize"
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
