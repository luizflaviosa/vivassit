'use client';

import { useEffect, useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Sparkles, Save, Loader2, Building2, Bot, ChevronDown, ChevronUp,
  Phone, MapPin, Receipt, MessageCircle, Music,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface Tenant {
  tenant_id: string;
  clinic_name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  real_phone: string | null;
  admin_email: string;
  accountant_email: string | null;
  address: string | null;
  doctor_name: string | null;
  doctor_crm: string | null;
  speciality: string | null;
  consultation_duration: number | null;
  establishment_type: string | null;
  evolution_phone_number: string | null;
  evolution_status: string | null;
  asaas_account_status: string | null;
  telegram_chat_id: string | null;
  elevenlabs_voice_id: string | null;
  assistant_prompt: string | null;
  rendered_prompt: string | null;
}

interface FormData {
  clinic_name: string;
  cnpj: string;
  email: string;
  phone: string;
  real_phone: string;
  admin_email: string;
  accountant_email: string;
  address: string;
  doctor_name: string;
  doctor_crm: string;
  speciality: string;
  evolution_phone_number: string;
  assistant_prompt: string;
}

const EMPTY: FormData = {
  clinic_name: '', cnpj: '', email: '', phone: '', real_phone: '',
  admin_email: '', accountant_email: '', address: '',
  doctor_name: '', doctor_crm: '', speciality: '',
  evolution_phone_number: '', assistant_prompt: '',
};

function ConfigInner() {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY);

  const setField = <K extends keyof FormData>(key: K, v: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: v }));

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/painel/tenant');
        const json = await res.json();
        if (json.success) {
          const t = json.tenant as Tenant;
          setTenant(t);
          setForm({
            clinic_name: t.clinic_name ?? '',
            cnpj: t.cnpj ?? '',
            email: t.email ?? '',
            phone: t.phone ?? '',
            real_phone: t.real_phone ?? '',
            admin_email: t.admin_email ?? '',
            accountant_email: t.accountant_email ?? '',
            address: t.address ?? '',
            doctor_name: t.doctor_name ?? '',
            doctor_crm: t.doctor_crm ?? '',
            speciality: t.speciality ?? '',
            evolution_phone_number: t.evolution_phone_number ?? '',
            assistant_prompt: t.assistant_prompt ?? '',
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/painel/tenant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Erro ao salvar');
        return;
      }
      toast.success('Configurações salvas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSaving(false);
    }
  };

  if (!tenantId) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  const isClinic = tenant?.establishment_type !== 'individual';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
          Configurações
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
          Sua clínica e sua{' '}
          <span className="font-serif italic font-normal text-zinc-700">IA.</span>
        </h1>
        <p className="text-[14px] text-zinc-500 mt-1.5">
          Edite tudo que o agente IA usa pra atender. Mudanças refletem na próxima conversa.
        </p>
      </div>

      {/* Personalização da IA */}
      <Card icon={<Sparkles className="w-4 h-4" />} accent="violet" title="Personalize sua IA" subtitle="Direcione o tom, regras e limites">
        <textarea
          value={form.assistant_prompt}
          onChange={(e) => setField('assistant_prompt', e.target.value)}
          placeholder="Ex: Sempre cumprimente o paciente pelo primeiro nome. Não responda perguntas clínicas — encaminhe para agendar consulta. Use linguagem informal e seja muito atenciosa."
          rows={6}
          className="w-full px-3.5 py-3 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all resize-none"
        />
        <p className="text-[11px] text-zinc-400 mt-2">
          Esse texto vai pro system prompt do agente. Mudanças refletem na próxima conversa.
        </p>
      </Card>

      {/* Preview do prompt completo */}
      {tenant?.rendered_prompt && <PromptPreview rendered={tenant.rendered_prompt} />}

      {/* Identidade da clínica */}
      <Card icon={<Building2 className="w-4 h-4" />} title="Identidade" subtitle={isClinic ? 'Dados públicos da clínica' : 'Dados públicos do consultório'}>
        <div className="space-y-3">
          <Field label={isClinic ? 'Nome da clínica' : 'Nome do consultório'}>
            <input value={form.clinic_name} onChange={(e) => setField('clinic_name', e.target.value)} className={inputClasses()} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="CNPJ (se houver)">
              <input value={form.cnpj} onChange={(e) => setField('cnpj', e.target.value)} placeholder="00.000.000/0000-00" className={inputClasses()} />
            </Field>
            <Field label="Tipo">
              <select
                value={tenant?.establishment_type ?? ''}
                disabled
                className={inputClasses() + ' bg-zinc-50 text-zinc-500'}
              >
                <option value="individual">Profissional individual</option>
                <option value="small_clinic">Clínica pequena</option>
                <option value="medium_clinic">Clínica média</option>
                <option value="large_clinic">Clínica grande</option>
                <option value="">Não definido</option>
              </select>
            </Field>
          </div>
          <Field label="Endereço">
            <input value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Rua, número, cidade — UF, CEP" className={inputClasses()} />
          </Field>
        </div>
      </Card>

      {/* Profissional principal (apenas se individual) */}
      {!isClinic && (
        <Card icon={<Bot className="w-4 h-4" />} title="Você (profissional)" subtitle="Quem está atendendo">
          <div className="space-y-3">
            <Field label="Seu nome">
              <input value={form.doctor_name} onChange={(e) => setField('doctor_name', e.target.value)} className={inputClasses()} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Registro (CRM/CRO/CRP/CRN/CREFITO...)">
                <input value={form.doctor_crm} onChange={(e) => setField('doctor_crm', e.target.value)} className={inputClasses()} />
              </Field>
              <Field label="Especialidade">
                <input value={form.speciality} onChange={(e) => setField('speciality', e.target.value)} className={inputClasses()} />
              </Field>
            </div>
            <p className="text-[11px] text-zinc-400">
              Como você é solo, esses campos servem de fallback se você não cadastrar em /painel/profissionais.
            </p>
          </div>
        </Card>
      )}

      {/* Contato e canais */}
      <Card icon={<Phone className="w-4 h-4" />} title="Contato e canais" subtitle="Como pacientes e o agente se comunicam">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Email administrativo">
              <input type="email" value={form.admin_email} onChange={(e) => setField('admin_email', e.target.value)} className={inputClasses()} />
            </Field>
            <Field label="Email da clínica (público)">
              <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputClasses()} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Telefone WhatsApp (real)" hint="Onde a IA atende">
              <input type="tel" value={form.real_phone} onChange={(e) => setField('real_phone', e.target.value)} placeholder="+5511999999999" className={inputClasses()} />
            </Field>
            <Field label="Telefone alternativo" hint="Pra exibir publicamente, se diferente">
              <input type="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={inputClasses()} />
            </Field>
          </div>
          <Field label="Email do contador" hint="Pra envio de NFe e relatórios fiscais">
            <input type="email" value={form.accountant_email} onChange={(e) => setField('accountant_email', e.target.value)} className={inputClasses()} />
          </Field>
        </div>
      </Card>

      {/* Status só leitura: integrações ativas */}
      <Card icon={<MessageCircle className="w-4 h-4" />} title="Integrações ativas" subtitle="Status dos canais conectados">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ReadOnlyField
            label="WhatsApp (Evolution)"
            value={tenant?.evolution_phone_number ?? '—'}
            status={tenant?.evolution_status === 'connected' ? 'ok' : (tenant?.evolution_status ? 'warn' : 'off')}
            statusLabel={tenant?.evolution_status === 'connected' ? 'conectado' : (tenant?.evolution_status ?? 'não conectado')}
          />
          <ReadOnlyField
            label="Telegram (interno)"
            value={tenant?.telegram_chat_id ?? '—'}
            status={tenant?.telegram_chat_id ? 'ok' : 'off'}
            statusLabel={tenant?.telegram_chat_id ? 'ativo' : 'não vinculado'}
          />
          <ReadOnlyField
            label="Asaas (pagamentos)"
            value={tenant?.asaas_account_status ?? '—'}
            status={tenant?.asaas_account_status === 'APPROVED' || tenant?.asaas_account_status === 'active' ? 'ok' : (tenant?.asaas_account_status ? 'warn' : 'off')}
            statusLabel={tenant?.asaas_account_status ?? 'não ativado'}
          />
          <ReadOnlyField
            label="Voz da IA (ElevenLabs)"
            value={tenant?.elevenlabs_voice_id ?? '—'}
            status={tenant?.elevenlabs_voice_id ? 'ok' : 'off'}
            statusLabel={tenant?.elevenlabs_voice_id ? 'configurada' : 'padrão'}
            icon={<Music className="w-3 h-3" />}
          />
        </div>
        <p className="text-[11px] text-zinc-400 mt-3">
          Pra ativar/reconfigurar essas integrações, vá em /painel/pagamentos/ativar e nas suas configs N8N.
        </p>
      </Card>

      {/* Save action */}
      <div className="flex items-center justify-end gap-2 sticky bottom-4 z-10">
        <button
          onClick={save}
          disabled={saving}
          className="h-12 px-6 rounded-xl text-white text-[14px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-70 shadow-[0_8px_24px_-8px_rgba(110,86,207,0.6)]"
          style={{
            background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
          }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar alterações
        </button>
      </div>

      {/* Zona perigosa */}
      <SubscriptionDangerZone />
    </div>
  );
}

function Card({ icon, accent, title, subtitle, children }: { icon: React.ReactNode; accent?: 'violet'; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center"
          style={accent === 'violet' ? { background: ACCENT_SOFT, color: ACCENT_DEEP } : undefined}
        >
          {accent !== 'violet' && <span className="bg-zinc-100 text-zinc-600 h-full w-full rounded-md flex items-center justify-center">{icon}</span>}
          {accent === 'violet' && icon}
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
          {subtitle && <p className="text-[12px] text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function PromptPreview({ rendered }: { rendered: string }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-black/[0.07] bg-zinc-50/40 overflow-hidden"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md flex items-center justify-center bg-zinc-100 text-zinc-600">
            <Bot className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-zinc-900">O que sua IA sabe</h3>
            <p className="text-[12px] text-zinc-500">Bloco gerado automaticamente do banco</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>
      {open && (
        <div className="border-t border-black/[0.06] bg-white p-4 sm:p-5">
          <pre className="text-[12px] font-mono text-zinc-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
            {rendered}
          </pre>
          <p className="text-[11px] text-zinc-400 mt-3">
            Atualizado automaticamente quando você edita profissionais ou personalização da IA.
          </p>
        </div>
      )}
    </motion.div>
  );
}

function SubscriptionDangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const cancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch('/api/painel/subscription', { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Erro ao cancelar');
        return;
      }
      toast.success(json.message || 'Assinatura cancelada');
      setConfirming(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 sm:p-6 mt-8"
    >
      <h2 className="text-[15px] font-semibold text-rose-900 mb-1">Cancelar assinatura</h2>
      <p className="text-[13px] text-rose-700 leading-relaxed mb-4">
        Encerra a renovação automática. Você mantém acesso até o fim do ciclo já pago. Não há reembolso proporcional.
      </p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="h-10 px-4 rounded-lg border border-rose-300 text-rose-700 text-[13px] font-semibold hover:bg-rose-100 transition-colors"
        >
          Cancelar assinatura
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={cancel}
            disabled={cancelling}
            className="h-10 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-semibold transition-colors disabled:opacity-70"
          >
            {cancelling ? 'Cancelando…' : 'Confirmar cancelamento'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={cancelling}
            className="h-10 px-4 rounded-lg text-zinc-600 text-[13px] font-medium hover:bg-black/[0.04]"
          >
            Voltar
          </button>
        </div>
      )}
    </motion.div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-zinc-900 flex items-center gap-1.5">
        {label}
        {hint && <span className="text-[11px] font-normal text-zinc-400">· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value, status, statusLabel, icon }: {
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'off';
  statusLabel: string;
  icon?: React.ReactNode;
}) {
  const colors = {
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    off: 'bg-zinc-50 text-zinc-500 border-zinc-200',
  }[status];
  return (
    <div className="rounded-lg border border-black/[0.07] bg-zinc-50/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[12px] font-semibold text-zinc-700 inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className={`text-[10px] uppercase tracking-[0.08em] font-bold px-1.5 py-0.5 rounded border ${colors}`}>
          {statusLabel}
        </span>
      </div>
      <p className="text-[12px] text-zinc-500 truncate font-mono">{value}</p>
    </div>
  );
}

const inputClasses = () =>
  'w-full h-11 px-3.5 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all';

void Receipt; void MapPin;

export default function ConfigPage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <ConfigInner />
    </Suspense>
  );
}
