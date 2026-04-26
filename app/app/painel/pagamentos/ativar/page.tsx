'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Loader2, Check, CreditCard, Building2, MapPin,
  Sparkles, ShieldCheck,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

type PersonType = 'FISICA' | 'JURIDICA';
type CompanyType = 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION';

interface FormState {
  personType: PersonType;
  name: string;
  cpfCnpj: string;
  birthDate: string;
  companyType: CompanyType;
  email: string;
  mobilePhone: string;
  incomeValue: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  complement: string;
  province: string;
  city: string;
  state: string;
}

function maskCpfCnpj(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1-$2');
  }
  return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}
function maskCep(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length < 11) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}
function maskMoney(v: string): string {
  const d = v.replace(/\D/g, '');
  if (!d) return '';
  return (parseInt(d, 10) / 100).toFixed(2).replace('.', ',');
}

function ActivateInner() {
  const router = useRouter();
  const me = useMe();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [activated, setActivated] = useState(false);
  const [existing, setExisting] = useState<{ activated: boolean; status: string } | null>(null);

  const [form, setForm] = useState<FormState>({
    personType: 'JURIDICA',
    name: me?.clinic_name ?? '',
    cpfCnpj: '',
    birthDate: '',
    companyType: 'LIMITED',
    email: me?.admin_email ?? '',
    mobilePhone: '',
    incomeValue: '',
    postalCode: '',
    address: '',
    addressNumber: '',
    complement: '',
    province: '',
    city: '',
    state: '',
  });

  // Status atual
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/marketplace/activate');
        const json = await res.json();
        if (json.success) setExisting({ activated: json.activated, status: json.status });
      } catch {
        // ignore
      }
    })();
  }, []);

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // CEP autocomplete via ViaCEP
  const lookupCep = async (cep: string) => {
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (data?.erro) return;
      setForm((prev) => ({
        ...prev,
        address: data.logradouro || prev.address,
        province: data.bairro || prev.province,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    } catch {
      // ignore
    }
  };

  const STEPS = ['Empresa', 'Endereço', 'Contato', 'Revisão'];

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.name.trim()) return 'Nome / razão social obrigatório';
      if (form.cpfCnpj.replace(/\D/g, '').length < 11) return 'CPF/CNPJ inválido';
      if (form.personType === 'FISICA' && !form.birthDate) return 'Data de nascimento obrigatória';
    }
    if (step === 1) {
      if (form.postalCode.replace(/\D/g, '').length !== 8) return 'CEP inválido';
      if (!form.address.trim() || !form.addressNumber.trim() || !form.province.trim()) {
        return 'Endereço completo obrigatório';
      }
    }
    if (step === 2) {
      if (!form.email.trim()) return 'Email obrigatório';
      if (form.mobilePhone.replace(/\D/g, '').length < 10) return 'Telefone inválido';
      const income = parseFloat(form.incomeValue.replace(/\./g, '').replace(',', '.'));
      if (!income || income < 1) return 'Faturamento mensal estimado obrigatório';
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prev = () => {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const incomeValue = parseFloat(form.incomeValue.replace(/\./g, '').replace(',', '.'));
      const res = await fetch('/api/marketplace/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          incomeValue,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Erro ao ativar', {
          description: json.detail ? JSON.stringify(json.detail).slice(0, 200) : undefined,
        });
        return;
      }
      toast.success('Subconta criada!');
      setActivated(true);
      setTimeout(() => router.push('/painel'), 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  // Estado: ja ativada
  if (existing?.activated) {
    return (
      <div className="max-w-2xl">
        <div
          className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-5 text-white"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
        >
          <Check className="w-6 h-6" strokeWidth={3} />
        </div>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900 mb-2">
          Pagamentos já ativados
        </h1>
        <p className="text-[14px] text-zinc-500 mb-6">
          Status atual: <strong className="text-zinc-900">{existing.status}</strong>. Você já pode
          cobrar pacientes via WhatsApp.
        </p>
        <button
          onClick={() => router.push('/painel')}
          className="h-11 px-5 rounded-lg border border-black/[0.10] hover:border-black/30 hover:bg-black/[0.02] text-[14px] font-semibold text-zinc-900 inline-flex items-center gap-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao painel
        </button>
      </div>
    );
  }

  // Estado: sucesso recém-ativado
  if (activated) {
    return (
      <div className="max-w-md text-center mx-auto pt-12">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-6 text-white"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
        >
          <Check className="w-7 h-7" strokeWidth={3} />
        </motion.div>
        <h1 className="text-[30px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900 mb-3">
          <span className="font-serif italic font-normal text-zinc-700">Pronto.</span>{' '}
          Subconta criada.
        </h1>
        <p className="text-[15px] text-zinc-500">
          Asaas vai analisar seus dados (até 24h). Quando aprovado, você pode cobrar pacientes via
          WhatsApp diretamente do agente IA.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
          Marketplace
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
          Ativar <span className="font-serif italic font-normal text-zinc-700">recebimentos</span>
        </h1>
        <p className="text-[14px] text-zinc-500 mt-1.5 leading-relaxed">
          Cadastre seus dados pra que cobre pacientes via WhatsApp. O dinheiro cai diretamente
          na sua conta bancária — Vivassit não retém nada.
        </p>
      </div>

      {/* Progress pills */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className="h-[3px] rounded-full overflow-hidden bg-black/[0.06]"
            >
              <motion.div
                className="h-full origin-left rounded-full"
                style={{
                  background:
                    i <= step ? `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DEEP})` : 'transparent',
                }}
                initial={false}
                animate={{ scaleX: i <= step ? 1 : 0 }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <p
              className={`text-[11px] uppercase tracking-[0.08em] font-semibold mt-1.5 ${
                i === step ? '' : 'text-zinc-400'
              }`}
              style={i === step ? { color: ACCENT_DEEP } : undefined}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-16px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="p-5 sm:p-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
            >
              {step === 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2.5 mb-1">
                    <Building2 className="w-4 h-4 text-zinc-500" />
                    <h2 className="text-[15px] font-semibold text-zinc-900">Dados da empresa ou profissional</h2>
                  </div>

                  <div>
                    <label className="text-[13px] font-medium text-zinc-900 block mb-2">Você é</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ['JURIDICA', 'Empresa (CNPJ)'],
                        ['FISICA', 'Pessoa Física (CPF)'],
                      ] as [PersonType, string][]).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => update('personType', key)}
                          className={`h-12 rounded-lg text-[14px] font-semibold transition-all ${
                            form.personType === key
                              ? 'bg-zinc-900 text-white'
                              : 'bg-white border border-black/[0.10] text-zinc-700 hover:border-black/30'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Input label={form.personType === 'JURIDICA' ? 'Razão social' : 'Nome completo'} value={form.name} onChange={(v) => update('name', v)} />
                  <Input
                    label={form.personType === 'JURIDICA' ? 'CNPJ' : 'CPF'}
                    value={form.cpfCnpj}
                    onChange={(v) => update('cpfCnpj', maskCpfCnpj(v))}
                    inputMode="numeric"
                  />

                  {form.personType === 'FISICA' && (
                    <Input label="Data de nascimento" value={form.birthDate} onChange={(v) => update('birthDate', v)} type="date" />
                  )}
                  {form.personType === 'JURIDICA' && (
                    <div>
                      <label className="text-[13px] font-medium text-zinc-900 block mb-2">Tipo de empresa</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ['MEI', 'MEI'],
                          ['LIMITED', 'LTDA'],
                          ['INDIVIDUAL', 'EI'],
                          ['ASSOCIATION', 'Associação'],
                        ] as [CompanyType, string][]).map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => update('companyType', key)}
                            className={`h-11 rounded-lg text-[13px] font-semibold transition-all ${
                              form.companyType === key
                                ? 'bg-zinc-900 text-white'
                                : 'bg-white border border-black/[0.10] text-zinc-700 hover:border-black/30'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2.5 mb-1">
                    <MapPin className="w-4 h-4 text-zinc-500" />
                    <h2 className="text-[15px] font-semibold text-zinc-900">Endereço</h2>
                  </div>
                  <Input
                    label="CEP"
                    value={form.postalCode}
                    onChange={(v) => {
                      const masked = maskCep(v);
                      update('postalCode', masked);
                      if (masked.replace(/\D/g, '').length === 8) lookupCep(masked);
                    }}
                    inputMode="numeric"
                    hint="Auto-preenche o resto"
                  />
                  <Input label="Logradouro" value={form.address} onChange={(v) => update('address', v)} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Número" value={form.addressNumber} onChange={(v) => update('addressNumber', v)} />
                    <Input label="Complemento" value={form.complement} onChange={(v) => update('complement', v)} hint="Opcional" />
                  </div>
                  <Input label="Bairro" value={form.province} onChange={(v) => update('province', v)} />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Input label="Cidade" value={form.city} onChange={(v) => update('city', v)} />
                    </div>
                    <Input label="UF" value={form.state} onChange={(v) => update('state', v.toUpperCase().slice(0, 2))} />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2.5 mb-1">
                    <CreditCard className="w-4 h-4 text-zinc-500" />
                    <h2 className="text-[15px] font-semibold text-zinc-900">Contato e faturamento</h2>
                  </div>
                  <Input label="Email" value={form.email} onChange={(v) => update('email', v)} type="email" />
                  <Input
                    label="Telefone (WhatsApp)"
                    value={form.mobilePhone}
                    onChange={(v) => update('mobilePhone', maskPhone(v))}
                    type="tel"
                    inputMode="tel"
                  />
                  <Input
                    label="Faturamento mensal estimado (R$)"
                    value={form.incomeValue}
                    onChange={(v) => update('incomeValue', maskMoney(v))}
                    inputMode="decimal"
                    hint="Asaas usa pra análise de risco. Pode estimar."
                  />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Sparkles className="w-4 h-4" style={{ color: ACCENT_DEEP }} />
                    <h2 className="text-[15px] font-semibold text-zinc-900">Revisão</h2>
                  </div>
                  <ReviewRow label="Tipo" value={form.personType === 'JURIDICA' ? 'Empresa (CNPJ)' : 'Pessoa Física'} />
                  <ReviewRow label={form.personType === 'JURIDICA' ? 'Razão social' : 'Nome'} value={form.name} />
                  <ReviewRow label={form.personType === 'JURIDICA' ? 'CNPJ' : 'CPF'} value={form.cpfCnpj} />
                  {form.personType === 'JURIDICA' && <ReviewRow label="Tipo empresa" value={form.companyType} />}
                  {form.personType === 'FISICA' && form.birthDate && <ReviewRow label="Nascimento" value={form.birthDate} />}
                  <ReviewRow label="Email" value={form.email} />
                  <ReviewRow label="Telefone" value={form.mobilePhone} />
                  <ReviewRow label="CEP" value={form.postalCode} />
                  <ReviewRow label="Endereço" value={`${form.address}, ${form.addressNumber}${form.complement ? ` - ${form.complement}` : ''}`} />
                  <ReviewRow label="Cidade/UF" value={`${form.province}, ${form.city} - ${form.state}`} />
                  <ReviewRow label="Faturamento" value={`R$ ${form.incomeValue}/mês`} />

                  <div className="rounded-xl border border-black/[0.07] bg-zinc-50/60 p-4 mt-4 flex gap-3">
                    <ShieldCheck className="w-5 h-5 flex-shrink-0" style={{ color: ACCENT_DEEP }} />
                    <p className="text-[12px] text-zinc-600 leading-relaxed">
                      Asaas analisa os dados em até 24h. Você recebe email quando aprovado e poderá
                      cobrar pacientes imediatamente via WhatsApp.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-t border-black/[0.06] bg-zinc-50/60">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="h-10 px-3.5 rounded-md border border-black/[0.10] text-[13px] font-semibold text-zinc-900 hover:border-black/30 hover:bg-black/[0.02] inline-flex items-center gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="h-10 px-4 rounded-md text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110"
              style={{
                background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 4px 12px -4px rgba(110,86,207,0.5)',
              }}
            >
              Próximo
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="h-10 px-4 rounded-md text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-70"
              style={{
                background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 4px 12px -4px rgba(110,86,207,0.5)',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  Ativar marketplace
                  <Check className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal';
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[13px] font-medium text-zinc-900">{label}</label>
        {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        className="w-full h-12 px-3.5 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
      />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-black/[0.05]">
      <span className="text-[12px] text-zinc-500">{label}</span>
      <span className="text-[13px] font-medium text-right text-zinc-900 truncate">{value}</span>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <ActivateInner />
    </Suspense>
  );
}
