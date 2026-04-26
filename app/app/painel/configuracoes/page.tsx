'use client';

import { useEffect, useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Sparkles, Save, Loader2, Building2, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { useMe } from '@/lib/painel-context';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface Tenant {
  tenant_id: string;
  clinic_name: string;
  admin_email: string;
  real_phone: string;
  assistant_prompt: string | null;
  rendered_prompt: string | null;
  payment_info: Record<string, unknown> | null;
}

function ConfigInner() {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [clinicName, setClinicName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [realPhone, setRealPhone] = useState('');
  const [assistantPrompt, setAssistantPrompt] = useState('');

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
          setTenant(json.tenant);
          setClinicName(json.tenant.clinic_name ?? '');
          setAdminEmail(json.tenant.admin_email ?? '');
          setRealPhone(json.tenant.real_phone ?? '');
          setAssistantPrompt(json.tenant.assistant_prompt ?? '');
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
        body: JSON.stringify({
          clinic_name: clinicName,
          admin_email: adminEmail,
          real_phone: realPhone,
          assistant_prompt: assistantPrompt,
        }),
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
          Edite as informações que o agente IA usa pra atender seus pacientes.
        </p>
      </div>

      {/* Personalização da IA — destaque */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6"
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="h-8 w-8 rounded-md flex items-center justify-center"
            style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
          >
            <Sparkles className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-900">Personalize sua IA</h2>
            <p className="text-[12px] text-zinc-500">Direcione o tom, regras e limites</p>
          </div>
        </div>
        <textarea
          value={assistantPrompt}
          onChange={(e) => setAssistantPrompt(e.target.value)}
          placeholder="Ex: Sempre cumprimente o paciente pelo primeiro nome. Não responda perguntas clínicas — encaminhe para agendar consulta. Use linguagem informal e seja muito atenciosa."
          rows={8}
          className="w-full px-3.5 py-3 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all resize-none"
        />
        <p className="text-[11px] text-zinc-400 mt-2">
          O texto aqui é injetado no system prompt do agente em tempo real. Mudanças refletem na próxima conversa.
        </p>
      </motion.div>

      {/* Preview do prompt completo */}
      {tenant?.rendered_prompt && <PromptPreview rendered={tenant.rendered_prompt} />}

      {/* Dados da clínica */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6"
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-8 w-8 rounded-md flex items-center justify-center bg-zinc-100 text-zinc-600">
            <Building2 className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-900">Dados da clínica</h2>
            <p className="text-[12px] text-zinc-500">Informações públicas e contato</p>
          </div>
        </div>
        <div className="space-y-3">
          <Field label="Nome da clínica">
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className={inputClasses()}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Email administrativo">
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className={inputClasses()}
              />
            </Field>
            <Field label="Telefone">
              <input
                type="tel"
                value={realPhone}
                onChange={(e) => setRealPhone(e.target.value)}
                className={inputClasses()}
              />
            </Field>
          </div>
        </div>
      </motion.div>

      {/* Save action */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="h-11 px-5 rounded-lg text-white text-[14px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-70"
          style={{
            background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
            boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 6px 18px -6px rgba(110,86,207,0.55)',
          }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar alterações
        </button>
      </div>

      {/* Zona perigosa: cancelar assinatura */}
      <SubscriptionDangerZone />
    </div>
  );
}

function PromptPreview({ rendered }: { rendered: string }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
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
            O agente lê esse texto antes de cada conversa no WhatsApp.
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
        Encerra a renovação automática. Você mantém acesso até o fim do ciclo
        já pago. Não há reembolso proporcional.
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-zinc-900">{label}</label>
      {children}
    </div>
  );
}

const inputClasses = () =>
  'w-full h-11 px-3.5 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all';

export default function ConfigPage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <ConfigInner />
    </Suspense>
  );
}
