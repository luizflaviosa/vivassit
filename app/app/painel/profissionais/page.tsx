'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import BackToChecklist from '../components/back-to-checklist';
import {
  Plus, Trash2, User, Star, Mail, Phone, Loader2, X, Check, Pencil, Calendar,
  Clock, MapPin, CreditCard, Shield, Repeat, Fingerprint,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import { DoctorCardSkeleton } from '@/lib/painel-skeleton';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

type WorkingHours = Record<string, string>;

interface BusinessRules {
  min_advance_hours?: number;
  max_advance_days?: number;
  max_per_day?: number | null;
  allow_emergency_fds?: boolean;
  requires_anamnese?: boolean;
  custom_rules_text?: string;
}

interface Doctor {
  id: string;
  doctor_name: string;
  doctor_crm: string | null;
  specialty: string;
  is_primary: boolean;
  status: string;
  consultation_value: number | string | null;
  consultation_duration: number | null;
  payment_methods: string | null;
  working_hours: WorkingHours | null;
  accepts_insurance: boolean;
  insurance_note: string | null;
  followup_value: number | string | null;
  followup_duration: number | null;
  followup_window_days: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  calendar_id: string | null;
  business_rules: BusinessRules | null;
  birdid_cpf: string | null;
}

interface FormData {
  doctor_name: string;
  doctor_crm: string;
  specialty: string;
  consultation_value: string;
  consultation_duration: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  calendar_id: string;
  payment_methods: string;
  accepts_insurance: boolean;
  insurance_note: string;
  followup_value: string;
  followup_duration: string;
  followup_window_days: string;
  working_hours: WorkingHours;
  // Regras de negócio (todas opcionais — defaults aplicados no backend gate)
  rule_min_advance_hours: string;
  rule_max_advance_days: string;
  rule_max_per_day: string;
  rule_allow_emergency_fds: boolean;
  rule_requires_anamnese: boolean;
  rule_custom_text: string;
  // BirdID (assinatura digital)
  birdid_cpf: string;
}

const EMPTY_FORM: FormData = {
  doctor_name: '', doctor_crm: '', specialty: '',
  consultation_value: '', consultation_duration: '60',
  contact_email: '', contact_phone: '', address: '', calendar_id: '',
  payment_methods: '', accepts_insurance: false, insurance_note: '',
  followup_value: '', followup_duration: '30', followup_window_days: '30',
  working_hours: {},
  rule_min_advance_hours: '', rule_max_advance_days: '', rule_max_per_day: '',
  rule_allow_emergency_fds: false, rule_requires_anamnese: false, rule_custom_text: '',
  birdid_cpf: '',
};

const DAYS = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

function ProfissionaisInner() {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';
  const searchParams = useSearchParams();
  const router = useRouter();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  // Deeplink: /painel/profissionais?action=new abre o modal automaticamente
  useEffect(() => {
    if (searchParams?.get('action') === 'new') {
      setShowAdd(true);
      router.replace('/painel/profissionais', { scroll: false });
    }
  }, [searchParams, router]);

  const isEditing = editingId !== null;
  const modalOpen = showAdd || isEditing;

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const closeModal = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (d: Doctor) => {
    setEditingId(d.id);
    setShowAdd(false);
    setForm({
      doctor_name: d.doctor_name,
      doctor_crm: d.doctor_crm ?? '',
      specialty: d.specialty,
      consultation_value: d.consultation_value ? String(d.consultation_value) : '',
      consultation_duration: d.consultation_duration ? String(d.consultation_duration) : '60',
      contact_email: d.contact_email ?? '',
      contact_phone: d.contact_phone ?? '',
      address: d.address ?? '',
      calendar_id: d.calendar_id ?? '',
      payment_methods: d.payment_methods ?? '',
      accepts_insurance: d.accepts_insurance ?? false,
      insurance_note: d.insurance_note ?? '',
      followup_value: d.followup_value ? String(d.followup_value) : '',
      followup_duration: d.followup_duration ? String(d.followup_duration) : '30',
      followup_window_days: d.followup_window_days ? String(d.followup_window_days) : '30',
      working_hours: d.working_hours ?? {},
      rule_min_advance_hours: d.business_rules?.min_advance_hours != null ? String(d.business_rules.min_advance_hours) : '',
      rule_max_advance_days: d.business_rules?.max_advance_days != null ? String(d.business_rules.max_advance_days) : '',
      rule_max_per_day: d.business_rules?.max_per_day != null ? String(d.business_rules.max_per_day) : '',
      rule_allow_emergency_fds: !!d.business_rules?.allow_emergency_fds,
      rule_requires_anamnese: !!d.business_rules?.requires_anamnese,
      rule_custom_text: d.business_rules?.custom_rules_text ?? '',
      birdid_cpf: d.birdid_cpf ?? '',
    });
  };

  const load = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/painel/profissionais');
      const json = await res.json();
      if (json.success) setDoctors(json.doctors);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const buildPayload = () => {
    // Monta business_rules apenas com chaves preenchidas (evita poluir o jsonb)
    const businessRules: BusinessRules = {};
    if (form.rule_min_advance_hours.trim()) businessRules.min_advance_hours = parseInt(form.rule_min_advance_hours, 10);
    if (form.rule_max_advance_days.trim()) businessRules.max_advance_days = parseInt(form.rule_max_advance_days, 10);
    if (form.rule_max_per_day.trim()) businessRules.max_per_day = parseInt(form.rule_max_per_day, 10);
    if (form.rule_allow_emergency_fds) businessRules.allow_emergency_fds = true;
    if (form.rule_requires_anamnese) businessRules.requires_anamnese = true;
    if (form.rule_custom_text.trim()) businessRules.custom_rules_text = form.rule_custom_text.trim();

    return {
      doctor_name: form.doctor_name.trim(),
      doctor_crm: form.doctor_crm.trim() || null,
      specialty: form.specialty.trim(),
      consultation_value: form.consultation_value ? parseFloat(form.consultation_value) : null,
      consultation_duration: form.consultation_duration ? parseInt(form.consultation_duration, 10) : null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      address: form.address.trim() || null,
      calendar_id: form.calendar_id.trim() || null,
      payment_methods: form.payment_methods.trim() || null,
      accepts_insurance: form.accepts_insurance,
      insurance_note: form.insurance_note.trim() || null,
      followup_value: form.followup_value ? parseFloat(form.followup_value) : null,
      followup_duration: form.followup_duration ? parseInt(form.followup_duration, 10) : null,
      followup_window_days: form.followup_window_days ? parseInt(form.followup_window_days, 10) : null,
      working_hours: form.working_hours,
      business_rules: businessRules,
      birdid_cpf: form.birdid_cpf.replace(/\D/g, '').trim() || null,
    };
  };

  const handleSubmit = async () => {
    if (!form.doctor_name.trim() || !form.specialty.trim()) {
      toast.error('Nome e especialidade são obrigatórios');
      return;
    }
    setSubmitting(true);
    try {
      const isPatch = isEditing;
      const res = await fetch('/api/painel/profissionais', {
        method: isPatch ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isPatch ? { id: editingId, ...buildPayload() } : buildPayload()),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Erro ao salvar');
        return;
      }
      // Feedback rico se calendar foi auto-criado no POST
      if (!isPatch && json.calendar?.calendar_id) {
        toast.success('Profissional cadastrado · agenda Google criada automaticamente', {
          description: json.calendar.share_status?.startsWith('shared_with_')
            ? `Compartilhada com ${json.calendar.share_status.replace('shared_with_', '')}`
            : undefined,
        });
      } else if (!isPatch && json.calendar?.share_status?.includes('skipped')) {
        toast.success('Profissional cadastrado', {
          description: 'Service Account não configurado — agenda pode ser criada manualmente depois.',
        });
      } else {
        toast.success(isPatch ? 'Profissional atualizado' : 'Profissional cadastrado');
      }
      closeModal();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, isPrimary: boolean) => {
    if (isPrimary) {
      toast.error('Não é possível remover o profissional principal');
      return;
    }
    if (!confirm('Tem certeza que deseja remover este profissional?')) return;
    try {
      const res = await fetch(`/api/painel/profissionais?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Erro ao remover');
        return;
      }
      toast.success('Profissional removido');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    }
  };

  if (!tenantId) return null;

  return (
    <div className="space-y-6">
      <BackToChecklist />
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
            Equipe
          </p>
          <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            Profissionais
          </h1>
          <p className="text-[14px] text-zinc-500 mt-1.5">
            Gerencie quem atende. O agente IA usa esses dados pra agendar.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="h-10 px-4 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110"
          style={{
            background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
            boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 6px 18px -6px rgba(110,86,207,0.55)',
          }}
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <DoctorCardSkeleton />
          <DoctorCardSkeleton />
          <DoctorCardSkeleton />
        </div>
      ) : doctors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[0.10] p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 mb-4">
            <User className="w-5 h-5 text-zinc-400" />
          </div>
          <p className="text-[15px] font-semibold text-zinc-900 mb-1">Nenhum profissional</p>
          <p className="text-[13px] text-zinc-500">Adicione o primeiro acima.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {doctors.map((d) => (
            <DoctorCard key={d.id} doctor={d} onDelete={handleDelete} onEdit={() => startEdit(d)} />
          ))}
        </div>
      )}

      {/* Modal Add/Edit (dialog padrão Apple/Linear: centralizado, scroll interno) */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/40 overflow-y-auto"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="w-full sm:max-w-[560px] my-auto bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header (sticky no topo do modal) */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-black/[0.06] flex-shrink-0">
                <h2 className="text-[16px] font-semibold text-zinc-900">
                  {isEditing ? 'Editar profissional' : 'Novo profissional'}
                </h2>
                <button
                  onClick={closeModal}
                  className="h-8 w-8 -mr-2 rounded-md hover:bg-black/[0.04] inline-flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              {/* Body (scrollavel) */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
                {/* Identidade */}
                <Section title="Identidade">
                  <FormInput placeholder="Nome completo *" value={form.doctor_name} onChange={(v) => setField('doctor_name', v)} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormInput placeholder="Registro (CRM/CRO/CRP)" value={form.doctor_crm} onChange={(v) => setField('doctor_crm', v)} />
                    <FormInput placeholder="Especialidade *" value={form.specialty} onChange={(v) => setField('specialty', v)} />
                  </div>
                </Section>

                {/* Contato */}
                <Section title="Contato" icon={<Mail className="w-3.5 h-3.5" />}>
                  <FormInput placeholder="Email" value={form.contact_email} onChange={(v) => setField('contact_email', v)} type="email" />
                  <FormInput placeholder="Telefone" value={form.contact_phone} onChange={(v) => setField('contact_phone', v)} type="tel" />
                  <FormInput placeholder="Endereço (rua, número, cidade)" value={form.address} onChange={(v) => setField('address', v)} />
                </Section>

                {/* Consulta */}
                <Section title="Consulta" icon={<CreditCard className="w-3.5 h-3.5" />}>
                  <div className="grid grid-cols-2 gap-3">
                    <FormInput placeholder="Valor (R$)" value={form.consultation_value} onChange={(v) => setField('consultation_value', v)} inputMode="decimal" />
                    <FormInput placeholder="Duração (min)" value={form.consultation_duration} onChange={(v) => setField('consultation_duration', v)} inputMode="numeric" />
                  </div>
                  <FormInput placeholder="Métodos aceitos (ex: PIX, dinheiro, cartão)" value={form.payment_methods} onChange={(v) => setField('payment_methods', v)} />
                </Section>

                {/* Convênio */}
                <Section title="Convênios" icon={<Shield className="w-3.5 h-3.5" />}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setField('accepts_insurance', !form.accepts_insurance)}
                      className={`h-6 w-11 rounded-full transition-colors relative ${form.accepts_insurance ? 'bg-violet-500' : 'bg-zinc-300'}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 bg-white rounded-full transition-transform shadow-sm ${form.accepts_insurance ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-[13px] text-zinc-700">Aceita convênios</span>
                  </div>
                  {form.accepts_insurance && (
                    <FormTextarea
                      placeholder="Quais convênios aceita? (ex: Unimed, Amil, GreenLine)"
                      value={form.insurance_note}
                      onChange={(v) => setField('insurance_note', v)}
                      rows={2}
                    />
                  )}
                </Section>

                {/* Follow-up */}
                <Section title="Retorno (follow-up)" icon={<Repeat className="w-3.5 h-3.5" />}>
                  <div className="grid grid-cols-3 gap-3">
                    <FormInput placeholder="Valor (R$)" value={form.followup_value} onChange={(v) => setField('followup_value', v)} inputMode="decimal" />
                    <FormInput placeholder="Duração (min)" value={form.followup_duration} onChange={(v) => setField('followup_duration', v)} inputMode="numeric" />
                    <FormInput placeholder="Janela (dias)" value={form.followup_window_days} onChange={(v) => setField('followup_window_days', v)} inputMode="numeric" />
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Janela = dias depois da consulta em que o paciente pode marcar retorno.
                  </p>
                </Section>

                {/* Horários */}
                <Section title="Dias e horários de atendimento" icon={<Clock className="w-3.5 h-3.5" />}>
                  <WorkingHoursEditor
                    value={form.working_hours}
                    onChange={(v) => setField('working_hours', v)}
                  />
                </Section>

                {/* Regras de negócio — usadas pelo agente IA pra cotar/agendar */}
                <Section title="Regras de agendamento" icon={<Shield className="w-3.5 h-3.5" />}>
                  <p className="text-[12px] text-zinc-500 -mt-1">
                    O agente IA usa essas regras pra recusar pedidos fora do esperado. Vazios = padrões saudáveis (mín 2h antecedência, máx 60d futuro, sem limite por dia).
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <FormInput
                      placeholder="Antecedência mín (h)"
                      value={form.rule_min_advance_hours}
                      onChange={(v) => setField('rule_min_advance_hours', v.replace(/\D/g, ''))}
                      inputMode="numeric"
                    />
                    <FormInput
                      placeholder="Janela máx (dias)"
                      value={form.rule_max_advance_days}
                      onChange={(v) => setField('rule_max_advance_days', v.replace(/\D/g, ''))}
                      inputMode="numeric"
                    />
                    <FormInput
                      placeholder="Máx por dia"
                      value={form.rule_max_per_day}
                      onChange={(v) => setField('rule_max_per_day', v.replace(/\D/g, ''))}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2 pt-1">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={form.rule_allow_emergency_fds}
                        onChange={(e) => setField('rule_allow_emergency_fds', e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-violet-600 cursor-pointer"
                      />
                      <span className="text-[13px] text-zinc-700 group-hover:text-zinc-900">
                        Atende emergência em fim de semana (sob demanda)
                      </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={form.rule_requires_anamnese}
                        onChange={(e) => setField('rule_requires_anamnese', e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-violet-600 cursor-pointer"
                      />
                      <span className="text-[13px] text-zinc-700 group-hover:text-zinc-900">
                        Exige formulário de anamnese antes da primeira consulta
                      </span>
                    </label>
                  </div>
                  <div className="pt-1">
                    <textarea
                      value={form.rule_custom_text}
                      onChange={(e) => setField('rule_custom_text', e.target.value)}
                      placeholder="Outras regras especiais (texto livre — aparece no prompt do agente). Ex: Não atende crianças < 12 anos. Para emergência, encaminhar ao PS Humberto Primo."
                      rows={3}
                      className="w-full px-3 py-2.5 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all resize-none"
                    />
                  </div>
                </Section>

                {/* BirdID — assinatura digital */}
                <Section title="Assinatura Digital (BirdID)" icon={<Fingerprint className="w-3.5 h-3.5" />}>
                  <p className="text-[12px] text-zinc-500 -mt-1">
                    CPF cadastrado no BirdID para assinatura digital de documentos médicos. Sem isso, documentos serão assinados manualmente.
                  </p>
                  <div className="relative">
                    <FormInput
                      placeholder="CPF (apenas números)"
                      value={form.birdid_cpf}
                      onChange={(v) => setField('birdid_cpf', v.replace(/\D/g, '').slice(0, 11))}
                      inputMode="numeric"
                    />
                    {form.birdid_cpf.length === 11 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Check className="w-4 h-4 text-emerald-500" />
                      </div>
                    )}
                  </div>
                  {form.birdid_cpf.length > 0 && form.birdid_cpf.length < 11 && (
                    <p className="text-[11px] text-amber-600">CPF incompleto ({form.birdid_cpf.length}/11 dígitos)</p>
                  )}
                </Section>

                {/* Calendar — criado automaticamente, sem campo manual */}
                <Section title="Google Calendar" icon={<Calendar className="w-3.5 h-3.5" />}>
                  <CalendarManager
                    doctorId={editingId}
                    currentCalendarId={form.calendar_id}
                    contactEmail={form.contact_email}
                    onCreated={(id) => setField('calendar_id', id)}
                  />
                  {form.calendar_id ? (
                    <p className="text-[11px] text-zinc-400 break-all">
                      Calendar dedicado ativo · <span className="font-mono text-[10px]">{form.calendar_id.slice(0, 28)}…</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-zinc-400">
                      Criamos uma agenda dedicada automaticamente quando você salvar este profissional. Não precisa configurar nada manualmente.
                    </p>
                  )}
                </Section>
              </div>

              {/* Footer (sticky bottom) */}
              <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 bg-zinc-50/60 border-t border-black/[0.06] flex-shrink-0">
                <button
                  onClick={closeModal}
                  className="h-10 px-4 rounded-lg text-[13px] font-semibold text-zinc-700 hover:bg-black/[0.04] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="h-10 px-4 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-70"
                  style={{ background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isEditing ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CalendarManager({
  doctorId, currentCalendarId, contactEmail, onCreated,
}: {
  doctorId: string | null;
  currentCalendarId: string;
  contactEmail: string;
  onCreated: (id: string) => void;
}) {
  const [busy, setBusy] = useState<'create' | 'verify' | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string; sa_email?: string; suggestion?: string } | null>(null);

  if (!doctorId) {
    return (
      <p className="text-[12px] text-zinc-500 italic mb-2">
        Salve o profissional primeiro pra poder criar/vincular um calendar.
      </p>
    );
  }

  const handleCreate = async () => {
    if (!confirm('Criar um novo Google Calendar dedicado pra este profissional?\n\nO Service Account será o dono e (se tiver email cadastrado) será compartilhado com o profissional pra ele ver no Gmail dele.')) return;
    setBusy('create');
    try {
      const res = await fetch(`/api/painel/profissionais/${doctorId}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', share_with: contactEmail || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Erro ao criar calendar');
        return;
      }
      onCreated(json.calendar_id);
      const shareMsg = json.share?.shared
        ? ` e compartilhado com ${json.share.with}`
        : (json.share?.error ? ` (mas falhou compartilhar com ${json.share.with}: ${json.share.error})` : '');
      toast.success(`Calendar criado${shareMsg}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setBusy(null);
    }
  };

  const handleVerify = async () => {
    setBusy('verify');
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/painel/profissionais/${doctorId}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });
      const json = await res.json();
      setVerifyResult({
        ok: !!json.success,
        message: json.message ?? (json.success ? 'OK' : 'Erro'),
        sa_email: json.sa_email,
        suggestion: json.suggestion,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2 mb-2">
      <div className="flex flex-wrap items-center gap-2">
        {!currentCalendarId ? (
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy !== null}
            className="h-9 px-3.5 rounded-md text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-60"
            style={{ background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})` }}
          >
            {busy === 'create' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Criar agenda Google automaticamente
          </button>
        ) : (
          <button
            type="button"
            onClick={handleVerify}
            disabled={busy !== null}
            className="h-9 px-3.5 rounded-md text-[12.5px] font-semibold text-zinc-700 border border-black/[0.10] hover:border-black/30 hover:bg-black/[0.02] inline-flex items-center gap-1.5 transition-all disabled:opacity-60"
          >
            {busy === 'verify' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Verificar acesso do Service Account
          </button>
        )}
      </div>
      {verifyResult && (
        <div className={`text-[12px] rounded-lg px-3 py-2 leading-relaxed ${verifyResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
          <p className="font-semibold mb-0.5">{verifyResult.ok ? '✓ Acesso OK' : '⚠ Sem acesso'}</p>
          <p>{verifyResult.message}</p>
          {verifyResult.suggestion && <p className="mt-1 font-mono text-[11px] break-all">{verifyResult.suggestion}</p>}
          {verifyResult.sa_email && (
            <p className="mt-1.5 text-[11px]">Service Account: <code className="font-mono">{verifyResult.sa_email}</code></p>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500">
        {icon}
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

type Interval = { start: string; end: string };

function parseIntervals(raw: string | undefined | null): Interval[] {
  if (!raw || raw === 'fechado') return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [start = '', end = ''] = part.split('-');
      return { start: start.trim(), end: end.trim() };
    });
}

function serializeIntervals(intervals: Interval[]): string {
  if (intervals.length === 0) return 'fechado';
  return intervals
    .map((i) => `${i.start || '00:00'}-${i.end || '00:00'}`)
    .join(',');
}

function WorkingHoursEditor({ value, onChange }: { value: WorkingHours; onChange: (v: WorkingHours) => void }) {
  const setIntervals = (key: string, intervals: Interval[]) => {
    onChange({ ...value, [key]: serializeIntervals(intervals) });
  };

  return (
    <div className="space-y-2 rounded-xl border border-black/[0.08] bg-zinc-50/40 p-3">
      {DAYS.map((d) => {
        const intervals = parseIntervals(value[d.key]);
        const isClosed = intervals.length === 0;
        return (
          <div key={d.key} className="flex items-start gap-3 py-1.5">
            <span className="w-20 text-[13px] font-medium text-zinc-700 flex-shrink-0 mt-1.5">{d.label}</span>
            <button
              type="button"
              onClick={() => setIntervals(d.key, isClosed ? [{ start: '08:00', end: '18:00' }] : [])}
              className={`h-6 w-10 rounded-full transition-colors relative flex-shrink-0 mt-1.5 ${!isClosed ? 'bg-violet-500' : 'bg-zinc-300'}`}
              aria-label={isClosed ? 'Abrir' : 'Fechar'}
            >
              <span className={`absolute top-0.5 h-5 w-5 bg-white rounded-full transition-transform shadow-sm ${!isClosed ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
                        onChange={(e) => {
                          const next = [...intervals];
                          next[idx] = { ...next[idx], start: e.target.value };
                          setIntervals(d.key, next);
                        }}
                        className="h-8 px-2 text-[13px] rounded-md border border-black/10 bg-white"
                      />
                      <span className="text-[12px] text-zinc-400">–</span>
                      <input
                        type="time"
                        value={iv.end}
                        onChange={(e) => {
                          const next = [...intervals];
                          next[idx] = { ...next[idx], end: e.target.value };
                          setIntervals(d.key, next);
                        }}
                        className="h-8 px-2 text-[13px] rounded-md border border-black/10 bg-white"
                      />
                      {intervals.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setIntervals(d.key, intervals.filter((_, i) => i !== idx))}
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
                    onClick={() => setIntervals(d.key, [...intervals, { start: '14:00', end: '18:00' }])}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-700 hover:text-violet-900 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> intervalo
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-zinc-400 px-1 pt-1">
        Ex: 08:00–12:00 e 14:00–18:00. Adicione quantos intervalos precisar por dia.
      </p>
    </div>
  );
}

function DoctorCard({ doctor, onDelete, onEdit }: { doctor: Doctor; onDelete: (id: string, isPrimary: boolean) => void; onEdit: () => void }) {
  // Mesmas regras do setup-status backend
  const hasValue = doctor.consultation_value != null && Number(doctor.consultation_value) > 0;
  const hasHours = !!doctor.working_hours && Object.keys(doctor.working_hours).length > 0;
  const isIncomplete = !hasValue || !hasHours;
  const missing: string[] = [];
  if (!hasValue) missing.push('valor');
  if (!hasHours) missing.push('horários');
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5 flex items-start gap-4">
      <div
        className="h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center text-white flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
      >
        <User className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[15px] font-semibold text-zinc-900 truncate">{doctor.doctor_name}</h3>
          {doctor.is_primary && (
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] font-semibold px-2 py-0.5 rounded"
              style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
            >
              <Star className="w-3 h-3 fill-current" />
              Principal
            </span>
          )}
          {doctor.birdid_cpf && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] font-semibold px-2 py-0.5 rounded text-blue-700 bg-blue-50">
              <Fingerprint className="w-2.5 h-2.5" /> birdid
            </span>
          )}
          {doctor.calendar_id && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] font-semibold px-2 py-0.5 rounded text-emerald-700 bg-emerald-50">
              <Calendar className="w-2.5 h-2.5" /> calendar
            </span>
          )}
          {isIncomplete && doctor.status === 'active' && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] font-semibold px-2 py-0.5 rounded text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
              title={`Faltam: ${missing.join(' e ')}`}
            >
              ⚠ falta {missing.join(' + ')}
            </button>
          )}
          {doctor.status !== 'active' && (
            <span className="inline-flex items-center text-[10px] uppercase tracking-[0.08em] font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-500">
              Inativo
            </span>
          )}
        </div>
        <p className="text-[13px] text-zinc-500 mt-0.5">
          {doctor.specialty}
          {doctor.doctor_crm && ` · ${doctor.doctor_crm}`}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12px] text-zinc-500">
          {doctor.consultation_value && (
            <span className="font-medium text-zinc-700">
              R$ {Number(doctor.consultation_value).toFixed(0)} / {doctor.consultation_duration ?? 60}min
            </span>
          )}
          {doctor.payment_methods && <span>{doctor.payment_methods}</span>}
          {doctor.address && (
            <span className="inline-flex items-center gap-1 truncate max-w-[280px]">
              <MapPin className="w-3 h-3" /> {doctor.address}
            </span>
          )}
          {doctor.contact_phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {doctor.contact_phone}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="h-9 w-9 rounded-md hover:bg-zinc-100 hover:text-zinc-900 text-zinc-400 inline-flex items-center justify-center transition-colors"
          aria-label="Editar"
          title="Editar profissional"
        >
          <Pencil className="w-4 h-4" />
        </button>
        {!doctor.is_primary && (
          <button
            onClick={() => onDelete(doctor.id, doctor.is_primary)}
            className="h-9 w-9 rounded-md hover:bg-rose-50 hover:text-rose-600 text-zinc-400 inline-flex items-center justify-center transition-colors"
            aria-label="Remover"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function FormInput({
  placeholder, value, onChange, type = 'text', inputMode,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal';
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={inputMode}
      className="w-full h-11 px-3.5 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
    />
  );
}

function FormTextarea({
  placeholder, value, onChange, rows = 3,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full px-3.5 py-2.5 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all resize-none"
    />
  );
}

export default function ProfissionaisPage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <ProfissionaisInner />
    </Suspense>
  );
}
