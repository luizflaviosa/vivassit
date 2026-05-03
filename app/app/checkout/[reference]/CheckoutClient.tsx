'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  CreditCard,
  Check,
  Lock,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { WhatsAppConnect } from '@/app/onboarding/components/WhatsAppConnect';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type Method = 'CREDIT_CARD' | 'PIX' | 'BOLETO';

interface Props {
  reference: string;
  tenantId: string | null;
  planType: string;
  clinicName: string;
  amount: number;
  planAmount?: number; // valor do plano isolado (sem addon)
  addonAmount?: number; // valor do add-on Singulare Atendimento (0 se não comprado)
  addonHumanSupport?: boolean;
  trialEndsAt: string | null;
  paymentStatus: string;
  defaultPayer: {
    name: string;
    email: string;
    phone: string;
  };
}

interface WaSetupData {
  evolution_pairing_code: string | null;
  evolution_qr_code: string | null;
  evolution_phone_number: string | null;
  doctor_name: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  basic: 'Starter',
  professional: 'Professional',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function maskCardNumber(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}
function maskCpfCnpj(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1-$2');
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
function maskCep(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}
function maskPhoneBR(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length < 11) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export default function CheckoutClient({
  reference,
  tenantId,
  planType,
  clinicName,
  amount,
  planAmount,
  addonAmount = 0,
  addonHumanSupport = false,
  trialEndsAt,
  paymentStatus,
  defaultPayer,
}: Props) {
  const router = useRouter();
  // SaaS: assinatura mensal so aceita cartao (PIX/Boleto nao auto-renovam)
  const method: Method = 'CREDIT_CARD';
  const [submitting, setSubmitting] = useState(false);
  const [paid, setPaid] = useState(paymentStatus === 'paid' || paymentStatus === 'subscribed');
  const [waSetup, setWaSetup] = useState<WaSetupData | null>(null);
  const [waConnected, setWaConnected] = useState(false);

  // Pos-pagamento: busca pair code / QR / nome do tenant pra setup do WhatsApp
  useEffect(() => {
    if (!paid || !tenantId) return;
    let cancelled = false;
    fetch(`/api/onboarding/status?tenant_id=${encodeURIComponent(tenantId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        setWaSetup({
          evolution_pairing_code: json.evolution_pairing_code ?? null,
          evolution_qr_code: json.evolution_qr_code ?? null,
          evolution_phone_number: json.evolution_phone_number ?? null,
          doctor_name: json.doctor_name ?? null,
        });
        if (json.evolution_status === 'open' || json.evolution_status === 'connected') {
          setWaConnected(true);
        }
      })
      .catch(() => { /* silent */ });
    return () => {
      cancelled = true;
    };
  }, [paid, tenantId]);

  // Payer
  const [payerName, setPayerName] = useState(defaultPayer.name);
  const [payerEmail, setPayerEmail] = useState(defaultPayer.email);
  const [payerPhone, setPayerPhone] = useState(maskPhoneBR(defaultPayer.phone || ''));
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [addressNumber, setAddressNumber] = useState('');

  // Card
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const planLabel = PLAN_LABELS[planType] ?? planType;
  const daysLeft = trialDaysLeft(trialEndsAt);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!payerName.trim()) return 'Informe o nome do pagador';
    if (!payerEmail.trim()) return 'Informe o email';
    if (!cpf.trim()) return 'Informe o CPF/CNPJ';
    if (cpf.replace(/\D/g, '').length < 11) return 'CPF/CNPJ inválido';
    if (method === 'CREDIT_CARD') {
      if (!cardNumber.trim() || cardNumber.replace(/\D/g, '').length < 13) return 'Número do cartão inválido';
      if (!cardName.trim()) return 'Nome no cartão obrigatório';
      if (!/^\d{2}$/.test(cardExpiry.split('/')[0] ?? '')) return 'Mês de validade inválido (MM)';
      if (!/^\d{2,4}$/.test(cardExpiry.split('/')[1] ?? '')) return 'Ano de validade inválido (AA ou AAAA)';
      if (!/^\d{3,4}$/.test(cardCvv)) return 'CVV inválido';
      if (!cep.trim() || cep.replace(/\D/g, '').length !== 8) return 'CEP obrigatório (8 dígitos)';
      if (!addressNumber.trim()) return 'Número do endereço obrigatório';
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    setSubmitting(true);
    try {
      const [mm, yyRaw] = cardExpiry.split('/').map((s) => s.trim());
      const yy = yyRaw && yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;

      const body = {
        external_reference: reference,
        method,
        payer: {
          name: payerName,
          email: payerEmail,
          cpfCnpj: cpf,
          phone: payerPhone,
          postalCode: cep || undefined,
          addressNumber: addressNumber || undefined,
        },
        ...(method === 'CREDIT_CARD'
          ? {
              card: {
                holderName: cardName,
                number: cardNumber,
                expiryMonth: mm,
                expiryYear: yy,
                ccv: cardCvv,
              },
            }
          : {}),
      };

      const res = await fetch('/api/checkout/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        toast.error(data?.message || 'Erro ao processar pagamento', {
          description: data?.detail ? JSON.stringify(data.detail).slice(0, 200) : undefined,
        });
        return;
      }

      // Subscription criada com sucesso (cartao validado)
      // Tenant entra em trial ate primeira cobranca; webhook confirma depois
      setPaid(true);
      toast.success(data.message || 'Cartão confirmado!');
      // Sem auto-redirect — deixa cliente conectar WhatsApp e clicar manual
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────

  if (paid) {
    const hasWaSetup = !!(waSetup?.evolution_pairing_code || waSetup?.evolution_qr_code);
    return (
      <div className="min-h-screen bg-[#FAFAF7] py-12 sm:py-20 px-5">
        <div className="max-w-xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-10 sm:mb-12"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 18 }}
              className="inline-flex h-14 w-14 items-center justify-center rounded-full text-white mb-6 shadow-[0_8px_24px_-8px_rgba(110,86,207,0.6)]"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
            >
              <Check className="w-7 h-7" strokeWidth={3} />
            </motion.div>
            <h1 className="text-[28px] sm:text-[36px] leading-[1.08] tracking-[-0.025em] font-medium text-zinc-900 mb-2">
              <span className="font-serif italic font-normal text-zinc-700">Pago.</span>{' '}
              {hasWaSetup ? 'Falta um passo.' : 'Bem-vindo(a) à Singulare.'}
            </h1>
            <p className="text-zinc-500 text-[14px] sm:text-[15px] leading-relaxed">
              {hasWaSetup
                ? 'Conecte seu WhatsApp pra ativar a secretária IA.'
                : 'Estamos preparando sua conta…'}
            </p>
          </motion.div>

          {tenantId && hasWaSetup && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <WhatsAppConnect
                tenantId={tenantId}
                qrCodeBase64={waSetup?.evolution_qr_code}
                pairingCode={waSetup?.evolution_pairing_code}
                phoneNumber={waSetup?.evolution_phone_number}
                onConnected={() => setWaConnected(true)}
              />
            </motion.div>
          )}

          {tenantId && !hasWaSetup && !waConnected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="rounded-2xl border border-black/[0.07] bg-white p-6 text-center"
            >
              <Loader2 className="w-5 h-5 mx-auto mb-3 animate-spin text-zinc-400" />
              <p className="text-[13px] text-zinc-500">
                Provisionando WhatsApp… isso leva alguns segundos.
              </p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="mt-8 text-center"
          >
            <button
              onClick={() => router.push('/painel')}
              className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors underline-offset-2 hover:underline"
            >
              {waConnected ? 'Ir pro painel' : 'Pular por enquanto'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#FAFAF7] text-zinc-900 pb-32 md:pb-12">
      {/* Topbar */}
      <header className="border-b border-black/[0.06] bg-white/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <Image
            src="/logos/singulare-a.svg"
            alt="Singulare"
            width={120}
            height={40}
            className="h-10 sm:h-11 w-auto"
            priority
          />
          <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500">
            <Lock className="w-3 h-3" strokeWidth={2} />
            Pagamento seguro
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 sm:px-6 pt-8 sm:pt-12">
        {/* Resumo do plano */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-3" style={{ color: ACCENT_DEEP }}>
            Pagamento
          </p>
          <h1 className="text-[30px] sm:text-[36px] leading-[1.05] tracking-[-0.03em] font-medium text-zinc-900 mb-3">
            Ativar plano <span className="font-serif italic font-normal text-zinc-700">{planLabel}</span>
          </h1>
          <p className="text-[15px] text-zinc-500 leading-relaxed">{clinicName}</p>
        </motion.div>

        {/* Trial badge */}
        {daysLeft !== null && daysLeft > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.5 }}
            className="mt-6 rounded-xl border border-black/[0.07] bg-white p-4 flex items-start gap-3"
          >
            <div
              className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
            >
              <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-zinc-900">
                Você tem {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'} de teste grátis
              </p>
              <p className="text-[13px] text-zinc-500 mt-0.5">
                Pague agora para garantir continuidade após o teste. A cobrança de{' '}
                <strong className="text-zinc-900">{formatBRL(amount)}</strong> só acontece quando o trial terminar.
              </p>
            </div>
          </motion.div>
        )}

        {/* Card principal */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-16px_rgba(0,0,0,0.10)] overflow-hidden"
        >
          {/* Resumo de valor — breakdown se há add-on */}
          <div className="px-6 sm:px-7 py-5 border-b border-black/[0.06]">
            {addonHumanSupport && addonAmount > 0 && planAmount ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between text-[13px] text-zinc-600">
                  <span>{planLabel}</span>
                  <span className="font-medium tabular-nums">{formatBRL(planAmount)}</span>
                </div>
                <div className="flex items-baseline justify-between text-[13px] text-zinc-600">
                  <span>Singulare Atendimento <span className="text-zinc-400">(add-on)</span></span>
                  <span className="font-medium tabular-nums">{formatBRL(addonAmount)}</span>
                </div>
                <div className="h-px bg-black/[0.07] my-2" />
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-zinc-500 font-medium">Total mensal</span>
                  <span className="text-[28px] font-medium tracking-[-0.02em] text-zinc-900 leading-none tabular-nums">
                    {formatBRL(amount)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-zinc-500 font-medium">Total mensal</span>
                <span className="text-[28px] font-medium tracking-[-0.02em] text-zinc-900 leading-none tabular-nums">
                  {formatBRL(amount)}
                </span>
              </div>
            )}
          </div>

          {/* Banner explicativo: assinatura mensal so via cartao */}
          <div className="px-6 sm:px-7 pt-6">
            <div className="flex items-start gap-3 rounded-xl border border-black/[0.07] bg-zinc-50/80 p-3.5">
              <div
                className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
              >
                <CreditCard className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-zinc-900">
                  Assinatura mensal — apenas cartão de crédito
                </p>
                <p className="text-[12px] text-zinc-500 leading-relaxed mt-0.5">
                  PIX e boleto não permitem renovação automática. Cartão garante continuidade
                  do serviço sem você precisar pagar mensalmente.
                </p>
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="px-6 sm:px-7 py-6 space-y-5">
            {/* Dados do pagador (sempre) */}
            <FieldGroup label="Dados do pagador">
              <Input placeholder="Nome completo" value={payerName} onChange={setPayerName} autoComplete="name" />
              <Input placeholder="Email" value={payerEmail} onChange={setPayerEmail} type="email" autoComplete="email" />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="CPF ou CNPJ" value={cpf} onChange={(v) => setCpf(maskCpfCnpj(v))} inputMode="numeric" />
                <Input placeholder="(11) 99999-9999" value={payerPhone} onChange={(v) => setPayerPhone(maskPhoneBR(v))} type="tel" inputMode="tel" />
              </div>
              {method === 'CREDIT_CARD' && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Input placeholder="CEP" value={cep} onChange={(v) => setCep(maskCep(v))} inputMode="numeric" />
                  </div>
                  <Input placeholder="Número" value={addressNumber} onChange={setAddressNumber} inputMode="numeric" />
                </div>
              )}
            </FieldGroup>

            {/* Cartão */}
            <AnimatePresence mode="wait">
              {method === 'CREDIT_CARD' && (
                <motion.div
                  key="card"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  <FieldGroup label="Dados do cartão">
                    <Input placeholder="Número do cartão" value={cardNumber} onChange={(v) => setCardNumber(maskCardNumber(v))} inputMode="numeric" autoComplete="cc-number" />
                    <Input placeholder="Nome impresso no cartão" value={cardName} onChange={(v) => setCardName(v.toUpperCase())} autoComplete="cc-name" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(v) => {
                          const d = v.replace(/\D/g, '').slice(0, 4);
                          setCardExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                        }}
                        inputMode="numeric"
                        autoComplete="cc-exp"
                      />
                      <Input placeholder="CVV" value={cardCvv} onChange={(v) => setCardCvv(v.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="cc-csc" />
                    </div>
                  </FieldGroup>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* CTA principal — desktop */}
          <div className="hidden md:flex px-7 pb-7 pt-2 items-center gap-3">
            <BackButton onClick={() => router.back()} />
            <div className="flex-1">
              <SubmitButton onClick={handleSubmit} submitting={submitting} method={method} amount={amount} />
            </div>
          </div>
        </motion.div>

        {/* Trust strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="w-3 h-3" strokeWidth={2} />
            Criptografia ponta-a-ponta
          </span>
          <span className="h-1 w-1 rounded-full bg-zinc-300" />
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" strokeWidth={2} />
            Processado por Asaas
          </span>
        </div>
      </main>

      {/* Sticky bottom CTA mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-xl border-t border-black/[0.07]">
        <div className="flex items-stretch gap-2">
          <BackButton onClick={() => router.back()} />
          <div className="flex-1">
            <SubmitButton onClick={handleSubmit} submitting={submitting} method={method} amount={amount} fullWidth />
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────────────────

function MethodTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 h-11 rounded-lg text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
        active
          ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
          : 'text-zinc-600 hover:text-zinc-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500 mb-2.5">{label}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Input({
  placeholder,
  value,
  onChange,
  type = 'text',
  inputMode,
  autoComplete,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'search' | 'url' | 'none' | 'decimal';
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={inputMode}
      autoComplete={autoComplete}
      className="w-full h-12 px-3.5 bg-white text-[16px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
    />
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.12] bg-white text-zinc-700 hover:text-zinc-900 hover:border-black/[0.25] transition-all h-14 px-4 text-[14px] font-semibold"
      aria-label="Voltar"
    >
      <ArrowLeft className="w-4 h-4" strokeWidth={2} />
      <span className="hidden sm:inline">Voltar</span>
    </button>
  );
}

function SubmitButton({
  onClick,
  submitting,
  method,
  amount,
  fullWidth,
}: {
  onClick: () => void;
  submitting: boolean;
  method: Method;
  amount: number;
  fullWidth?: boolean;
}) {
  const label =
    method === 'PIX'
      ? `Gerar PIX de ${formatBRL(amount)}`
      : method === 'BOLETO'
      ? `Gerar boleto de ${formatBRL(amount)}`
      : `Pagar ${formatBRL(amount)}`;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={submitting}
      whileTap={{ scale: 0.98 }}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl text-white font-semibold transition-all hover:brightness-110 disabled:opacity-70 disabled:cursor-wait h-14 px-6 text-[15px] ${
        fullWidth ? 'w-full' : ''
      }`}
      style={{
        background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 8px 24px -8px rgba(110,86,207,0.6)',
      }}
    >
      {submitting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Processando…
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </motion.button>
  );
}
