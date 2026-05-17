'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Sparkles, Save, Loader2, Building2, Bot, ChevronDown, ChevronUp,
  Phone, MapPin, Receipt, MessageCircle, Music, Globe, Instagram,
  Search, CreditCard,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import BackToChecklist from '../components/back-to-checklist';

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
  internal_agent_capabilities: string | null;
  rendered_prompt: string | null;
  instagram_username: string | null;
  facebook_page_url: string | null;
  website_url: string | null;
  google_place_id: string | null;
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
  elevenlabs_voice_id: string;
  assistant_prompt: string;
  internal_agent_capabilities: string;
  instagram_username: string;
  facebook_page_url: string;
  website_url: string;
  google_place_id: string;
}

const EMPTY: FormData = {
  clinic_name: '', cnpj: '', email: '', phone: '', real_phone: '',
  admin_email: '', accountant_email: '', address: '',
  doctor_name: '', doctor_crm: '', speciality: '',
  evolution_phone_number: '', elevenlabs_voice_id: '', assistant_prompt: '',
  internal_agent_capabilities: '',
  instagram_username: '', facebook_page_url: '', website_url: '', google_place_id: '',
};

interface ConfigViewProps {
  initialTenant: Tenant | null;
}

function deriveFormFromTenant(t: Tenant): FormData {
  return {
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
    elevenlabs_voice_id: t.elevenlabs_voice_id ?? '',
    assistant_prompt: t.assistant_prompt ?? '',
    internal_agent_capabilities: t.internal_agent_capabilities ?? '',
    instagram_username: t.instagram_username ?? '',
    facebook_page_url: t.facebook_page_url ?? '',
    website_url: t.website_url ?? '',
    google_place_id: t.google_place_id ?? '',
  };
}

function ConfigInner({ initialTenant }: ConfigViewProps) {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';

  const [tenant, setTenant] = useState<Tenant | null>(initialTenant);
  const [loading, setLoading] = useState<boolean>(initialTenant === null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>(() =>
    initialTenant ? deriveFormFromTenant(initialTenant) : EMPTY
  );

  const setField = <K extends keyof FormData>(key: K, v: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: v }));

  // Type-ahead Google Place ID — usuario digita nome do negocio, Google sugere
  type Prediction = { place_id: string; description: string; main_text: string; secondary_text: string };
  const [placeQuery, setPlaceQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [predictionsOpen, setPredictionsOpen] = useState(false);
  const [placeApiError, setPlaceApiError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeBoxRef = useRef<HTMLDivElement | null>(null);

  const fetchPredictions = async (q: string) => {
    if (q.trim().length < 2) {
      setPredictions([]);
      return;
    }
    setPredictionsLoading(true);
    setPlaceApiError(null);
    try {
      const res = await fetch(`/api/painel/google-place/autocomplete?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setPlaceApiError(json.message ?? 'Erro ao buscar');
        setPredictions([]);
      } else {
        setPredictions(json.predictions ?? []);
      }
    } catch (e) {
      setPlaceApiError((e as Error).message);
      setPredictions([]);
    } finally {
      setPredictionsLoading(false);
    }
  };

  const onPlaceQueryChange = (v: string) => {
    setPlaceQuery(v);
    setPredictionsOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(v), 300);
  };

  const selectPrediction = (p: Prediction) => {
    setField('google_place_id', p.place_id);
    setPlaceQuery(p.description);
    setPredictions([]);
    setPredictionsOpen(false);
    toast.success('Place ID preenchido. Nao esqueca de salvar.');
  };

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (placeBoxRef.current && !placeBoxRef.current.contains(e.target as Node)) {
        setPredictionsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    // Pula refetch se Server ja entregou tenant.
    if (initialTenant !== null) return;
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
          setForm(deriveFormFromTenant(t));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <BackToChecklist />
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
      <div id="ai-prompt" className="scroll-mt-20" />
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

      {/* Capacidades do Assistente Interno (chat IA do painel + Telegram) */}
      <Card
        icon={<Sparkles className="w-4 h-4" />}
        title="Saudação do seu assistente interno"
        subtitle="O texto abaixo é o que aparece quando você abre o chat. Mantenha alinhado com as ferramentas do agente."
      >
        <textarea
          value={form.internal_agent_capabilities}
          onChange={(e) => setField('internal_agent_capabilities', e.target.value)}
          placeholder="Ex: Olá! Posso te ajudar com reagendar consultas, organizar tarefas e resumir e-mails."
          rows={8}
          className="w-full px-3.5 py-3 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all resize-none font-mono"
        />
        <p className="text-[11px] text-zinc-400 mt-2">
          Markdown leve: <code>**negrito**</code> e <code>•</code> ou <code>-</code> pra bullets. Atualiza a tela do chat na hora — basta salvar e reabrir.
        </p>
      </Card>

      {/* Identidade da clínica */}
      <div id="clinica" className="scroll-mt-20" />
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

      {/* Presença online */}
      <Card
        icon={<Globe className="w-4 h-4" />}
        title="Presença online"
        subtitle="Site, redes e perfil Google. Habilita SEO local + tracking de reviews."
      >
        <div className="space-y-3">
          <Field
            label="Site"
            hint="URL completa, ex: https://drapaulafranzon.com.br"
          >
            <input
              type="url"
              value={form.website_url}
              onChange={(e) => setField('website_url', e.target.value)}
              placeholder="https://..."
              className={inputClasses()}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Instagram"
              hint="Apenas o usuário, sem @. Ex: drapaulafranzon"
            >
              <input
                value={form.instagram_username}
                onChange={(e) => setField('instagram_username', e.target.value.replace(/^@/, ''))}
                placeholder="seuhandle"
                className={inputClasses()}
              />
            </Field>
            <Field
              label="Facebook (página)"
              hint="URL completa da página"
            >
              <input
                type="url"
                value={form.facebook_page_url}
                onChange={(e) => setField('facebook_page_url', e.target.value)}
                placeholder="https://facebook.com/..."
                className={inputClasses()}
              />
            </Field>
          </div>
          <Field
            label="Google Meu Negócio"
            hint="Digite o nome do profissional ou da clínica. Sugestões aparecem do próprio Google Maps."
          >
            <div ref={placeBoxRef} className="relative">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  value={placeQuery}
                  onChange={(e) => onPlaceQueryChange(e.target.value)}
                  onFocus={() => { if (predictions.length > 0) setPredictionsOpen(true); }}
                  placeholder='Ex: "Dra. Paula Franzon" ou "Clínica Reumatos São Paulo"'
                  className={inputClasses() + ' pl-9 pr-9'}
                  autoComplete="off"
                />
                {predictionsLoading && (
                  <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 animate-spin" />
                )}
              </div>

              {predictionsOpen && (predictions.length > 0 || (placeQuery.trim().length >= 2 && !predictionsLoading)) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/[0.08] rounded-md shadow-lg max-h-80 overflow-auto z-20" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                  {predictions.length === 0 ? (
                    <div className="px-3 py-3 text-[12px] text-zinc-500">
                      Nenhum resultado. Tente outro termo ou{' '}
                      <a href="https://business.google.com/create" target="_blank" rel="noopener noreferrer" className="text-violet-700 hover:underline">
                        criar perfil em business.google.com
                      </a>.
                    </div>
                  ) : (
                    predictions.map((p) => (
                      <button
                        key={p.place_id}
                        type="button"
                        onClick={() => selectPrediction(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-violet-50/60 border-b border-black/[0.04] last:border-b-0 transition-colors"
                      >
                        <div className="text-[13px] font-medium text-zinc-900">{p.main_text}</div>
                        {p.secondary_text && (
                          <div className="text-[11px] text-zinc-500 mt-0.5">{p.secondary_text}</div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </Field>

          {form.google_place_id && (
            <div className="rounded-md bg-emerald-50/60 border border-emerald-200/60 px-3 py-2 flex items-center gap-2 justify-between">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.1em] font-semibold text-emerald-700">Place ID conectado</div>
                <div className="text-[11px] text-emerald-800 mt-0.5 font-mono break-all">{form.google_place_id}</div>
              </div>
              <button
                type="button"
                onClick={() => { setField('google_place_id', ''); setPlaceQuery(''); }}
                className="text-[11px] font-medium text-zinc-500 hover:text-zinc-700 flex-shrink-0"
              >
                Limpar
              </button>
            </div>
          )}

          {placeApiError && (
            <div className="rounded-md bg-red-50/60 border border-red-200/60 px-3 py-2 text-[12px] text-red-800">
              {placeApiError}
            </div>
          )}

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Sem Place ID o card "Reviews Google" no painel Performance fica vazio. Não tem perfil ainda?{' '}
            <a href="https://business.google.com/create" target="_blank" rel="noopener noreferrer" className="text-violet-700 hover:underline">
              Crie em 5min em business.google.com
            </a>{' '}
            (Google verifica em 5-7 dias por carta postal).
          </p>
        </div>
      </Card>

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
            <Field label="WhatsApp do canal IA (Evolution)" hint="Número onde a IA atende paciente. É a instância Evolution.">
              <input type="tel" value={form.real_phone} onChange={(e) => setField('real_phone', e.target.value)} placeholder="+5511999999999" className={inputClasses()} />
            </Field>
            <Field label="Telefone público alternativo" hint="Apenas se diferente do canal IA (raro)">
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
          <div className="rounded-lg border border-black/[0.07] bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[12px] font-semibold text-zinc-700 inline-flex items-center gap-1.5">
                <Music className="w-3 h-3" />
                Voz da IA (ElevenLabs)
              </span>
              <span className={`text-[10px] uppercase tracking-[0.08em] font-bold px-1.5 py-0.5 rounded border ${
                form.elevenlabs_voice_id ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-50 text-zinc-500 border-zinc-200'
              }`}>
                {form.elevenlabs_voice_id ? 'configurada' : 'voz padrão'}
              </span>
            </div>
            <input
              type="text"
              value={form.elevenlabs_voice_id}
              onChange={(e) => setField('elevenlabs_voice_id', e.target.value)}
              placeholder="ID da voz (ex: 21m00Tcm4TlvDq8ikWAM) — deixe vazio pra voz padrão"
              className="w-full text-[12px] font-mono text-zinc-700 bg-transparent border-0 focus:outline-none focus:ring-0 p-0 placeholder:text-zinc-400"
            />
          </div>
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

      {/* Assinatura */}
      <SubscriptionInfoCard />

      {/* Zona perigosa */}
      <SubscriptionDangerZone />
    </div>
  );
}

interface SubscriptionInfo {
  plan_type: 'professional' | 'enterprise' | 'sob_medida' | string;
  amount: number | null;
  payment_status: string | null;
  asaas_subscription_id: string | null;
  payment_method: string | null;
  trial_ends_at: string | null;
  created_at: string | null;
  asaas: {
    status: string;
    next_due_date: string;
    cycle: string;
  } | null;
}

interface PlanOption {
  key: 'professional' | 'enterprise' | 'sob_medida';
  name: string;
  priceLabel: string;
  amount: number | null;
  description: string;
  features: string[];
  highlight?: boolean;
}

const PLAN_LABEL: Record<string, string> = {
  professional: 'Profissional',
  enterprise: 'Clínica',
  sob_medida: 'Na medida',
};

const PLANS: PlanOption[] = [
  {
    key: 'professional',
    name: 'Profissional',
    priceLabel: 'R$ 197',
    amount: 197,
    description: 'Para quem trabalha de forma independente.',
    features: ['1 profissional', 'Agendamento via WhatsApp', 'Lembretes automáticos', 'NPS automático'],
  },
  {
    key: 'enterprise',
    name: 'Clínica',
    priceLabel: 'R$ 397',
    amount: 397,
    description: 'Para equipes de até 5 profissionais.',
    features: ['Até 5 profissionais', 'Tudo do Profissional', 'Multi-canal', 'Relatórios por profissional'],
    highlight: true,
  },
  {
    key: 'sob_medida',
    name: 'Na medida',
    priceLabel: 'Sob consulta',
    amount: null,
    description: 'Pra redes e clínicas com várias unidades.',
    features: ['Profissionais ilimitados', 'Múltiplas unidades', 'Integrações sob medida', 'Gerente dedicado'],
  },
];

function formatBRL(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function statusBadge(status: string | null | undefined): { label: string; dot: string; fg: string } {
  const s = (status ?? '').toLowerCase();
  if (s === 'active' || s === 'paid' || s === 'received' || s === 'confirmed') {
    return { label: 'Ativa', dot: 'bg-emerald-500', fg: 'text-emerald-700' };
  }
  if (s.includes('trial')) return { label: 'Em teste', dot: 'bg-violet-500', fg: 'text-violet-700' };
  if (s === 'pending' || s === 'awaiting_risk_analysis') return { label: 'Aguardando pagamento', dot: 'bg-amber-500', fg: 'text-amber-700' };
  if (s === 'overdue' || s === 'expired') return { label: 'Em atraso', dot: 'bg-rose-500', fg: 'text-rose-700' };
  if (s === 'cancelled' || s === 'canceled' || s === 'inactive') return { label: 'Cancelada', dot: 'bg-zinc-400', fg: 'text-zinc-600' };
  return { label: status ?? '—', dot: 'bg-zinc-400', fg: 'text-zinc-600' };
}

function methodLabel(m: string | null): string {
  if (!m) return 'A definir';
  const v = m.toUpperCase();
  if (v === 'CREDIT_CARD') return 'Cartão de crédito';
  if (v === 'BOLETO') return 'Boleto';
  if (v === 'PIX') return 'Pix';
  return m;
}

function SubscriptionInfoCard() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);

  const reload = async () => {
    try {
      const res = await fetch('/api/painel/subscription');
      const json = await res.json();
      if (json.success) setSub(json.subscription ?? null);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, []);

  const start = async (planKey: PlanOption['key']) => {
    if (planKey === 'sob_medida') {
      window.open('https://wa.me/5547996800100?text=Olá!%20Quero%20uma%20proposta%20do%20plano%20Sob%20Medida.', '_blank');
      return;
    }
    setBusy(planKey);
    try {
      const res = await fetch('/api/painel/subscription/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: planKey }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Não consegui iniciar a assinatura.');
        return;
      }
      toast.success('Assinatura iniciada. 7 dias grátis começam agora.');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setBusy(null);
    }
  };

  const change = async (planKey: PlanOption['key']) => {
    if (planKey === 'sob_medida') {
      window.open('https://wa.me/5547996800100?text=Olá!%20Quero%20migrar%20pro%20plano%20Sob%20Medida.', '_blank');
      return;
    }
    if (!confirm(`Mudar pra plano ${PLAN_LABEL[planKey]}? A próxima cobrança será no novo valor.`)) return;
    setBusy(planKey);
    try {
      const res = await fetch('/api/painel/subscription/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: planKey }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Não consegui mudar de plano.');
        return;
      }
      toast.success('Plano atualizado.');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6 mt-8 flex items-center gap-2 text-[13px] text-zinc-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando assinatura…
      </div>
    );
  }

  const hasSub = !!sub;
  const liveStatus = sub?.asaas?.status ?? sub?.payment_status;
  const badge = statusBadge(liveStatus);
  const nextDue = sub?.asaas?.next_due_date ?? null;
  const trialActive = sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date();
  const currentPlan = sub?.plan_type ?? null;
  const isCancelled = ['cancelled', 'canceled', 'inactive'].includes((liveStatus ?? '').toLowerCase());

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6 mt-8"
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-md flex items-center justify-center"
            style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
          >
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-900">Plano e cobrança</h2>
            <p className="text-[12px] text-zinc-500">Tudo da sua assinatura aqui — sem ir pra outra página.</p>
          </div>
        </div>
        {hasSub && (
          <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${badge.fg}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        )}
      </div>

      {/* Resumo da assinatura ativa */}
      {hasSub && !isCancelled && (
        <div className="rounded-xl bg-zinc-50/60 border border-black/[0.05] p-4 mb-6">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500">Plano atual</div>
              <div className="text-[20px] font-semibold text-zinc-900 mt-1">
                {PLAN_LABEL[currentPlan ?? ''] ?? currentPlan}
                {sub?.amount != null && (
                  <span className="text-[13px] font-normal text-zinc-500 ml-2">{formatBRL(sub.amount)} / mês</span>
                )}
              </div>
            </div>
            <div className="text-right">
              {trialActive && (
                <>
                  <div className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500">Teste grátis até</div>
                  <div className="text-[13px] text-zinc-900 mt-1 font-medium">{formatDateBR(sub?.trial_ends_at)}</div>
                </>
              )}
              {!trialActive && nextDue && (
                <>
                  <div className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500">Próxima cobrança</div>
                  <div className="text-[13px] text-zinc-900 mt-1 font-medium">{formatDateBR(nextDue)}</div>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mt-4 pt-4 border-t border-black/[0.05]">
            <Meta label="Pagamento" value={methodLabel(sub?.payment_method ?? null)} />
            <Meta label="Ciclo" value={sub?.asaas?.cycle ? sub.asaas.cycle.toLowerCase().replace('monthly', 'Mensal').replace('yearly', 'Anual') : 'Mensal'} />
            <Meta label="Início" value={formatDateBR(sub?.created_at)} />
          </div>
        </div>
      )}

      {/* Cancelada — banner amber com CTA reativar */}
      {hasSub && isCancelled && (
        <div className="rounded-xl bg-amber-50/60 border border-amber-200/60 p-4 mb-6">
          <p className="text-[13px] text-amber-900 leading-relaxed">
            Sua assinatura está <strong>cancelada</strong>. Reative escolhendo um plano abaixo — você não perde nenhum dado.
          </p>
        </div>
      )}

      {/* Empty state — onboarding inline */}
      {!hasSub && (
        <div className="rounded-xl bg-violet-50/40 border border-violet-200/50 p-4 mb-6">
          <p className="text-[13px] text-violet-900 leading-relaxed">
            Você ainda não tem assinatura. Comece com <strong>7 dias grátis</strong> em qualquer plano — sem cartão necessário.
          </p>
        </div>
      )}

      {/* Catálogo de planos inline */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500 mb-3">
          {hasSub && !isCancelled ? 'Mudar de plano' : 'Escolher plano'}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key && !isCancelled;
            const isSob = plan.key === 'sob_medida';
            return (
              <div
                key={plan.key}
                className={`relative rounded-xl border p-4 flex flex-col ${
                  isCurrent
                    ? 'border-violet-300 bg-violet-50/30 ring-1 ring-violet-200/60'
                    : 'border-black/[0.07] bg-white hover:border-black/[0.12] transition-colors'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-semibold uppercase tracking-wider">
                    Atual
                  </span>
                )}
                {!isCurrent && plan.highlight && (
                  <span className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-zinc-900 text-white text-[10px] font-semibold uppercase tracking-wider">
                    Mais escolhido
                  </span>
                )}
                <div className="text-[14px] font-semibold text-zinc-900">{plan.name}</div>
                <div className="text-[20px] font-semibold text-zinc-900 mt-1">
                  {plan.priceLabel}
                  {plan.amount != null && <span className="text-[12px] font-normal text-zinc-500"> / mês</span>}
                </div>
                <p className="text-[12px] text-zinc-600 mt-1.5 leading-relaxed">{plan.description}</p>
                <ul className="mt-3 space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="text-[12px] text-zinc-700 flex items-start gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-zinc-400 mt-[7px] flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-3 border-t border-black/[0.05]">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full h-9 rounded-lg text-[12px] font-medium text-zinc-400 cursor-default"
                    >
                      Você está aqui
                    </button>
                  ) : (
                    <button
                      onClick={() => (hasSub && !isCancelled ? change(plan.key) : start(plan.key))}
                      disabled={busy !== null}
                      className={`w-full h-9 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                        plan.highlight && !isCurrent
                          ? 'bg-violet-600 text-white hover:bg-violet-700'
                          : 'border border-black/[0.12] text-zinc-900 hover:bg-zinc-50'
                      }`}
                    >
                      {busy === plan.key ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                      ) : isSob ? (
                        'Falar com a equipe'
                      ) : hasSub && !isCancelled ? (
                        'Mudar pra esse'
                      ) : (
                        'Começar 7 dias grátis'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hasSub && !isCancelled && (
        <p className="text-[11px] text-zinc-400 mt-5 leading-relaxed">
          Mudou de plano? A próxima cobrança ({nextDue ? formatDateBR(nextDue) : 'do ciclo'}) já vem com o novo valor. Sem cobrança duplicada, sem perder histórico.
        </p>
      )}
    </motion.div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.1em] font-semibold text-zinc-500 mb-0.5">{label}</div>
      <div className="text-[13px] text-zinc-900">{value}</div>
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

export default function ConfigView(props: ConfigViewProps) {
  return <ConfigInner {...props} />;
}
