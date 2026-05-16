'use client';

// Wizard v3 — 3 etapas + revisao. Submit em POST /api/onboarding (mesma API
// usada pelo onboarding original). Mantem todos os campos obrigatorios:
// admin_phone (obrigatorio), doctor_phone (opcional). Progress 03/03 em gold
// tracking wide, inputs com border navy 1px, focus gold ring, CTA pill gold.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PROFESSIONAL_TYPES,
  COUNCIL_BY_PROFESSIONAL,
  SPECIALTIES_BY_PROFESSIONAL,
  ESTABLISHMENT_SIZES,
  type ProfessionalTypeKey,
  type EstablishmentSizeKey,
} from '@/lib/types';
import { BRAND_COLORS } from '../_components/tokens';
import { EyebrowDash } from '../_components/EyebrowDash';
import { CTAGoldPill } from '../_components/CTAGoldPill';
import { Logo3Squares } from '../_components/Logo3Squares';

interface FormState {
  professional_type: ProfessionalTypeKey;
  establishment_size: EstablishmentSizeKey;
  doctor_name: string;
  doctor_crm: string;
  speciality: string;
  clinic_name: string;
  admin_email: string;
  real_phone: string;
  admin_phone: string;
  doctor_phone: string;
  consultation_duration: string;
  plan_type: 'professional' | 'enterprise';
  lgpd_accepted: boolean;
}

const INITIAL_STATE: FormState = {
  professional_type: 'medico',
  establishment_size: 'private_practice',
  doctor_name: '',
  doctor_crm: '',
  speciality: '',
  clinic_name: '',
  admin_email: '',
  real_phone: '',
  admin_phone: '',
  doctor_phone: '',
  consultation_duration: '30',
  plan_type: 'professional',
  lgpd_accepted: false,
};

const STEPS = [
  { id: 1, title: 'Voce', desc: 'Profissao, nome e registro' },
  { id: 2, title: 'Negocio', desc: 'Clinica + contato' },
  { id: 3, title: 'Plano', desc: 'Escolha e confirme' },
];

function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('+')) return '+' + digits;
  if (digits.startsWith('55') && digits.length >= 12) return '+' + digits;
  return '+55' + digits;
}

const E164 = /^\+\d{10,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OnboardingClientV3() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { tenant_id: string; clinic_name: string; doctor_name: string; checkout_url?: string | null; magic_link_url?: string | null; is_sob_medida?: boolean }>(null);

  // Pre-seleciona plano da URL ?plan=enterprise
  useEffect(() => {
    const plan = searchParams?.get('plan');
    if (plan === 'enterprise' || plan === 'professional') {
      setForm((prev) => ({ ...prev, plan_type: plan }));
    }
  }, [searchParams]);

  const councilInfo = useMemo(
    () => COUNCIL_BY_PROFESSIONAL[form.professional_type],
    [form.professional_type],
  );

  const specialties = useMemo(
    () => SPECIALTIES_BY_PROFESSIONAL[form.professional_type] ?? [],
    [form.professional_type],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateStep = (idx: number): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (idx === 0) {
      if (!form.doctor_name.trim()) next.doctor_name = 'Obrigatorio';
      if (!form.doctor_crm.trim()) next.doctor_crm = 'Obrigatorio';
      if (!form.speciality.trim()) next.speciality = 'Obrigatorio';
    }
    if (idx === 1) {
      if (!form.clinic_name.trim()) next.clinic_name = 'Obrigatorio';
      if (!form.admin_email.trim()) next.admin_email = 'Obrigatorio';
      else if (!EMAIL.test(form.admin_email)) next.admin_email = 'Email invalido';
      if (!form.real_phone.trim()) next.real_phone = 'Obrigatorio';
      else if (!E164.test(normalizePhoneToE164(form.real_phone)))
        next.real_phone = 'Telefone invalido';
      if (!form.admin_phone.trim()) next.admin_phone = 'Obrigatorio';
      else if (!E164.test(normalizePhoneToE164(form.admin_phone)))
        next.admin_phone = 'WhatsApp invalido';
      if (form.doctor_phone.trim() && !E164.test(normalizePhoneToE164(form.doctor_phone)))
        next.doctor_phone = 'WhatsApp do medico invalido';
    }
    if (idx === 2) {
      if (!form.lgpd_accepted) next.lgpd_accepted = 'Aceite os termos pra continuar';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        professional_type: form.professional_type,
        establishment_type: form.establishment_size,
        doctor_name: form.doctor_name,
        doctor_crm: form.doctor_crm,
        speciality: form.speciality,
        clinic_name: form.clinic_name,
        admin_email: form.admin_email,
        real_phone: form.real_phone,
        admin_phone: form.admin_phone,
        doctor_phone: form.doctor_phone || '',
        consultation_duration: form.consultation_duration,
        plan_type: form.plan_type,
        lgpd_accepted: form.lgpd_accepted,
        source: 'v3-luxury-modular',
        user_timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          'America/Sao_Paulo',
      };
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setErrors({
          lgpd_accepted: json?.message || 'Erro ao cadastrar. Tente novamente.',
        });
        return;
      }
      setDone({
        tenant_id: json.data.tenant_id,
        clinic_name: json.data.clinic_name,
        doctor_name: json.data.doctor_name,
        checkout_url: json.data.checkout_url,
        magic_link_url: json.data.magic_link_url,
        is_sob_medida: json.data.is_sob_medida,
      });
    } catch (err) {
      setErrors({
        lgpd_accepted:
          err instanceof Error ? err.message : 'Erro de rede. Tente novamente.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return <DoneScreen data={done} onGotoPainel={() => router.push('/painel')} />;
  }

  return (
    <main
      style={{
        background: BRAND_COLORS.sand,
        minHeight: 'calc(100vh - 240px)',
        paddingTop: 56,
        paddingBottom: 96,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '0 clamp(20px, 5vw, 32px)',
        }}
      >
        <ProgressBar step={step} total={STEPS.length} stepInfo={STEPS[step]} />

        <div
          style={{
            marginTop: 32,
            background: '#fff',
            border: `1px solid rgba(15, 27, 51, 0.12)`,
            borderRadius: 8,
            padding: 'clamp(28px, 4vw, 44px)',
          }}
        >
          {step === 0 && (
            <StepYou
              form={form}
              update={update}
              errors={errors}
              council={councilInfo}
              specialties={specialties}
            />
          )}
          {step === 1 && (
            <StepBusiness form={form} update={update} errors={errors} />
          )}
          {step === 2 && <StepPlan form={form} update={update} errors={errors} />}
        </div>

        <div
          style={{
            marginTop: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={handlePrev}
            disabled={step === 0}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: step === 0 ? 'default' : 'pointer',
              color: step === 0 ? 'rgba(15, 27, 51, 0.3)' : BRAND_COLORS.navy,
              fontFamily: 'var(--font-poppins)',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              padding: '12px 0',
            }}
          >
            ← Voltar
          </button>

          <NextButton
            disabled={submitting}
            label={
              submitting
                ? 'Enviando...'
                : step === STEPS.length - 1
                  ? 'Confirmar cadastro'
                  : 'Proximo passo'
            }
            onClick={handleNext}
          />
        </div>

        <p
          style={{
            marginTop: 32,
            textAlign: 'center',
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 12,
            color: 'rgba(15, 27, 51, 0.55)',
          }}
        >
          Ja tem conta?{' '}
          <Link
            href="/login"
            style={{ color: BRAND_COLORS.navy, fontWeight: 600 }}
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}

function ProgressBar({
  step,
  total,
  stepInfo,
}: {
  step: number;
  total: number;
  stepInfo: { title: string; desc: string };
}) {
  const current = String(step + 1).padStart(2, '0');
  const totalStr = String(total).padStart(2, '0');
  const pct = ((step + 1) / total) * 100;
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: BRAND_COLORS.gold,
          }}
        >
          {current} / {totalStr} · {stepInfo.title}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 13,
            color: 'rgba(15, 27, 51, 0.55)',
          }}
        >
          {stepInfo.desc}
        </span>
      </div>
      <div
        style={{
          marginTop: 12,
          height: 2,
          width: '100%',
          background: 'rgba(15, 27, 51, 0.12)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: BRAND_COLORS.gold,
            transition: 'width 0.32s ease',
          }}
        />
      </div>
    </div>
  );
}

function StepYou({
  form,
  update,
  errors,
  council,
  specialties,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  errors: Partial<Record<keyof FormState, string>>;
  council: { label: string; placeholder: string };
  specialties: ReadonlyArray<string>;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader title="Voce" desc="Como devemos te tratar?" />

      <Field label="Profissao" error={errors.professional_type}>
        <select
          value={form.professional_type}
          onChange={(e) =>
            update('professional_type', e.target.value as ProfessionalTypeKey)
          }
          style={inputStyle()}
        >
          {Object.entries(PROFESSIONAL_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label as string}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Nome completo" error={errors.doctor_name}>
        <input
          type="text"
          autoComplete="name"
          placeholder="Dra. Paula Franzon"
          value={form.doctor_name}
          onChange={(e) => update('doctor_name', e.target.value)}
          style={inputStyle(!!errors.doctor_name)}
        />
      </Field>

      <Field label={`Registro (${council.label})`} error={errors.doctor_crm}>
        <input
          type="text"
          placeholder={council.placeholder}
          value={form.doctor_crm}
          onChange={(e) => update('doctor_crm', e.target.value)}
          style={inputStyle(!!errors.doctor_crm)}
        />
      </Field>

      <Field label="Especialidade" error={errors.speciality}>
        <select
          value={form.speciality}
          onChange={(e) => update('speciality', e.target.value)}
          style={inputStyle(!!errors.speciality)}
        >
          <option value="">Selecione...</option>
          {specialties.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function StepBusiness({
  form,
  update,
  errors,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader title="Seu negocio" desc="Solo ou clinica? Como te contactamos?" />

      <Field label="Tipo de estabelecimento">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 8,
          }}
        >
          {Object.entries(ESTABLISHMENT_SIZES).map(([key, info]) => {
            const isActive = form.establishment_size === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  update('establishment_size', key as EstablishmentSizeKey)
                }
                style={{
                  background: isActive ? BRAND_COLORS.navy : '#fff',
                  border: `1px solid ${isActive ? BRAND_COLORS.gold : 'rgba(15, 27, 51, 0.2)'}`,
                  borderRadius: 6,
                  padding: '14px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: isActive ? BRAND_COLORS.sand : BRAND_COLORS.navy,
                  fontFamily: 'var(--font-space-grotesk)',
                  transition: 'all 0.18s ease',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-poppins)',
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 4,
                  }}
                >
                  {info.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: isActive ? 'rgba(244, 239, 230, 0.7)' : 'rgba(15, 27, 51, 0.55)',
                  }}
                >
                  {info.desc}
                </div>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Nome da clinica" error={errors.clinic_name}>
        <input
          type="text"
          placeholder="Clinica Singulare"
          value={form.clinic_name}
          onChange={(e) => update('clinic_name', e.target.value)}
          style={inputStyle(!!errors.clinic_name)}
        />
      </Field>

      <Field label="Email do administrador" error={errors.admin_email}>
        <input
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          value={form.admin_email}
          onChange={(e) => update('admin_email', e.target.value)}
          style={inputStyle(!!errors.admin_email)}
        />
      </Field>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <Field
          label="WhatsApp da clinica"
          hint="Numero que recebera mensagens dos pacientes"
          error={errors.real_phone}
        >
          <input
            type="tel"
            placeholder="(11) 99999-9999"
            value={form.real_phone}
            onChange={(e) => update('real_phone', e.target.value)}
            style={inputStyle(!!errors.real_phone)}
          />
        </Field>

        <Field
          label="Seu WhatsApp pessoal"
          hint="Pra suporte direto da Singulare"
          error={errors.admin_phone}
        >
          <input
            type="tel"
            placeholder="(11) 99999-9999"
            value={form.admin_phone}
            onChange={(e) => update('admin_phone', e.target.value)}
            style={inputStyle(!!errors.admin_phone)}
          />
        </Field>
      </div>

      <Field
        label="WhatsApp do(a) profissional (opcional)"
        hint="Se diferente do admin. Deixe em branco se for o mesmo."
        error={errors.doctor_phone}
      >
        <input
          type="tel"
          placeholder="(11) 99999-9999"
          value={form.doctor_phone}
          onChange={(e) => update('doctor_phone', e.target.value)}
          style={inputStyle(!!errors.doctor_phone)}
        />
      </Field>

      <Field label="Duracao tipica do atendimento (min)">
        <select
          value={form.consultation_duration}
          onChange={(e) => update('consultation_duration', e.target.value)}
          style={inputStyle()}
        >
          {['15', '20', '30', '45', '60', '90'].map((d) => (
            <option key={d} value={d}>
              {d} minutos
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function StepPlan({
  form,
  update,
  errors,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  const plans = [
    {
      key: 'professional' as const,
      name: 'Profissional',
      price: 'R$ 197/mes',
      desc: '1 profissional · agenda + WhatsApp + cobranca.',
    },
    {
      key: 'enterprise' as const,
      name: 'Clinica',
      price: 'R$ 397/mes',
      desc: 'Ate 5 profissionais · multi-canal · suporte prioritario.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <SectionHeader title="Plano" desc="14 dias gratis, sem cartao de credito" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {plans.map((plan) => {
          const active = form.plan_type === plan.key;
          return (
            <button
              key={plan.key}
              type="button"
              onClick={() => update('plan_type', plan.key)}
              style={{
                background: active ? BRAND_COLORS.navy : '#fff',
                border: `1px solid ${active ? BRAND_COLORS.gold : 'rgba(15, 27, 51, 0.2)'}`,
                borderRadius: 8,
                padding: 22,
                textAlign: 'left',
                cursor: 'pointer',
                color: active ? BRAND_COLORS.sand : BRAND_COLORS.navy,
                transition: 'all 0.18s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: active ? BRAND_COLORS.gold : 'rgba(15, 27, 51, 0.55)',
                }}
              >
                {plan.name}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 700,
                  fontSize: 22,
                  letterSpacing: '-0.015em',
                }}
              >
                {plan.price}
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-space-grotesk)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  margin: 0,
                  color: active ? 'rgba(244, 239, 230, 0.75)' : 'rgba(15, 27, 51, 0.65)',
                }}
              >
                {plan.desc}
              </p>
            </button>
          );
        })}
      </div>

      <Summary form={form} />

      <div>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={form.lgpd_accepted}
            onChange={(e) => update('lgpd_accepted', e.target.checked)}
            style={{
              marginTop: 4,
              accentColor: BRAND_COLORS.gold,
              width: 18,
              height: 18,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-space-grotesk)',
              fontSize: 13,
              lineHeight: 1.55,
              color: 'rgba(15, 27, 51, 0.75)',
            }}
          >
            Li e aceito a{' '}
            <Link
              href="/privacidade"
              style={{ color: BRAND_COLORS.navy, fontWeight: 600 }}
            >
              Politica de Privacidade
            </Link>{' '}
            e os{' '}
            <Link
              href="/termos"
              style={{ color: BRAND_COLORS.navy, fontWeight: 600 }}
            >
              Termos de Uso
            </Link>{' '}
            da Singulare (LGPD).
          </span>
        </label>
        {errors.lgpd_accepted && (
          <p
            style={{
              fontFamily: 'var(--font-space-grotesk)',
              fontSize: 12,
              color: BRAND_COLORS.coral,
              marginTop: 8,
            }}
          >
            {errors.lgpd_accepted}
          </p>
        )}
      </div>
    </div>
  );
}

function Summary({ form }: { form: FormState }) {
  const rows = [
    { label: 'Profissao', value: PROFESSIONAL_TYPES[form.professional_type] },
    { label: 'Nome', value: form.doctor_name || '—' },
    { label: 'Registro', value: form.doctor_crm || '—' },
    { label: 'Especialidade', value: form.speciality || '—' },
    { label: 'Clinica', value: form.clinic_name || '—' },
    { label: 'Email', value: form.admin_email || '—' },
    { label: 'WhatsApp da clinica', value: form.real_phone || '—' },
  ];
  return (
    <div
      style={{
        background: BRAND_COLORS.sand,
        border: `1px solid rgba(15, 27, 51, 0.1)`,
        borderRadius: 6,
        padding: 24,
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-poppins)',
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: BRAND_COLORS.gold,
          marginBottom: 14,
        }}
      >
        Resumo
      </p>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '8px 16px',
          margin: 0,
        }}
      >
        {rows.map((row) => (
          <div key={row.label} style={{ display: 'contents' }}>
            <dt
              style={{
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 12,
                color: 'rgba(15, 27, 51, 0.55)',
              }}
            >
              {row.label}
            </dt>
            <dd
              style={{
                margin: 0,
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 13,
                color: BRAND_COLORS.navy,
              }}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <EyebrowDash>Etapa atual</EyebrowDash>
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-poppins)',
          fontWeight: 700,
          fontSize: 24,
          lineHeight: 1.2,
          color: BRAND_COLORS.navy,
          margin: 0,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-space-grotesk)',
          fontSize: 14,
          color: 'rgba(15, 27, 51, 0.6)',
          margin: '6px 0 0 0',
        }}
      >
        {desc}
      </p>
    </div>
  );
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
        }}
      >
        <label
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: BRAND_COLORS.navy,
          }}
        >
          {label}
        </label>
        {hint && (
          <span
            style={{
              fontFamily: 'var(--font-space-grotesk)',
              fontSize: 11,
              color: 'rgba(15, 27, 51, 0.5)',
            }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 12,
            color: BRAND_COLORS.coral,
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function inputStyle(hasError = false): React.CSSProperties {
  return {
    width: '100%',
    background: '#fff',
    border: `1px solid ${hasError ? BRAND_COLORS.coral : 'rgba(15, 27, 51, 0.2)'}`,
    borderRadius: 6,
    padding: '12px 14px',
    fontFamily: 'var(--font-space-grotesk)',
    fontSize: 15,
    color: BRAND_COLORS.navy,
    outline: 'none',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
  };
}

function NextButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: BRAND_COLORS.gold,
        color: BRAND_COLORS.navy,
        border: 'none',
        borderRadius: 999,
        padding: '14px 32px',
        fontFamily: 'var(--font-poppins)',
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        cursor: disabled ? 'wait' : 'pointer',
        boxShadow: '0 6px 20px rgba(255, 198, 47, 0.25)',
        opacity: disabled ? 0.6 : 1,
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
      }}
    >
      {label}
    </button>
  );
}

function DoneScreen({
  data,
  onGotoPainel,
}: {
  data: {
    tenant_id: string;
    clinic_name: string;
    doctor_name: string;
    checkout_url?: string | null;
    magic_link_url?: string | null;
    is_sob_medida?: boolean;
  };
  onGotoPainel: () => void;
}) {
  return (
    <main
      style={{
        background: BRAND_COLORS.sand,
        minHeight: 'calc(100vh - 240px)',
        paddingTop: 64,
        paddingBottom: 96,
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '0 clamp(20px, 5vw, 32px)',
        }}
      >
        <section
          style={{
            background: BRAND_COLORS.navy,
            color: BRAND_COLORS.sand,
            borderRadius: 8,
            padding: 'clamp(36px, 5vw, 56px)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: '-30%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 400,
              height: 400,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(255, 198, 47, 0.22), transparent 70%)',
              filter: 'blur(60px)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 28,
              }}
            >
              <Logo3Squares size={32} color={BRAND_COLORS.gold} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <EyebrowDash color={BRAND_COLORS.gold}>Recebido</EyebrowDash>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-poppins)',
                fontWeight: 700,
                fontSize: 'clamp(28px, 5vw, 44px)',
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
                color: BRAND_COLORS.sand,
                margin: 0,
                maxWidth: '22ch',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              Pronto, {data.doctor_name.split(' ')[0]}.{' '}
              <span style={{ color: BRAND_COLORS.gold }}>
                {data.clinic_name}
              </span>{' '}
              esta sendo configurada.
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 15,
                color: 'rgba(244, 239, 230, 0.7)',
                marginTop: 18,
                maxWidth: '46ch',
                marginLeft: 'auto',
                marginRight: 'auto',
                lineHeight: 1.6,
              }}
            >
              {data.is_sob_medida
                ? 'Recebemos seus dados. Nossa equipe entra em contato em ate 1 dia util pra apresentar a proposta.'
                : 'Estamos provisionando WhatsApp, Calendar e seu painel. Voce recebera um email assim que tudo estiver pronto.'}
            </p>
            <div
              style={{
                marginTop: 28,
                background: 'rgba(244, 239, 230, 0.06)',
                border: `1px solid rgba(244, 239, 230, 0.15)`,
                borderRadius: 6,
                padding: 16,
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 12,
                color: 'rgba(244, 239, 230, 0.7)',
                wordBreak: 'break-all',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  fontSize: 10,
                  color: BRAND_COLORS.gold,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                ID da conta
              </span>
              {data.tenant_id}
            </div>
            <div style={{ marginTop: 32 }}>
              {data.checkout_url ? (
                <CTAGoldPill
                  href={data.checkout_url}
                  label="Confirmar pagamento"
                  size="md"
                />
              ) : (
                <button
                  type="button"
                  onClick={onGotoPainel}
                  style={{
                    background: BRAND_COLORS.gold,
                    color: BRAND_COLORS.navy,
                    border: 'none',
                    borderRadius: 999,
                    padding: '14px 32px',
                    fontFamily: 'var(--font-poppins)',
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Ir pro painel
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
