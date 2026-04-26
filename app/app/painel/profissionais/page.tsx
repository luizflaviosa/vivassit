'use client';

import { useEffect, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Trash2, User, Star, Mail, Phone, Loader2, X, Check, Pencil, Calendar } from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import { DoctorCardSkeleton, PageHeadingSkeleton } from '@/lib/painel-skeleton';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface Doctor {
  id: string;
  doctor_name: string;
  doctor_crm: string | null;
  specialty: string;
  is_primary: boolean;
  status: string;
  consultation_value: number | string | null;
  consultation_duration: number;
  payment_methods: string | null;
  working_hours: Record<string, string>;
  accepts_insurance: boolean;
  insurance_note: string | null;
  followup_window_days: number;
  contact_email: string | null;
  contact_phone: string | null;
  calendar_id: string | null;
}

function ProfissionaisInner() {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [register, setRegister] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [value, setValue] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [calendarId, setCalendarId] = useState('');

  const isEditing = editingId !== null;
  const modalOpen = showAdd || isEditing;

  const resetForm = () => {
    setName(''); setRegister(''); setSpecialty(''); setValue('');
    setEmail(''); setPhone(''); setCalendarId('');
  };

  const closeModal = () => {
    setShowAdd(false);
    setEditingId(null);
    resetForm();
  };

  const startEdit = (d: Doctor) => {
    setEditingId(d.id);
    setShowAdd(false);
    setName(d.doctor_name);
    setRegister(d.doctor_crm ?? '');
    setSpecialty(d.specialty);
    setValue(d.consultation_value ? String(d.consultation_value) : '');
    setEmail(d.contact_email ?? '');
    setPhone(d.contact_phone ?? '');
    setCalendarId(d.calendar_id ?? '');
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

  const handleAdd = async () => {
    if (!name.trim() || !specialty.trim()) {
      toast.error('Nome e especialidade são obrigatórios');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/painel/profissionais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_name: name,
          doctor_crm: register || null,
          specialty,
          consultation_value: value || null,
          contact_email: email || null,
          contact_phone: phone || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Erro ao cadastrar');
        return;
      }
      toast.success('Profissional cadastrado!');
      closeModal();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!name.trim() || !specialty.trim()) {
      toast.error('Nome e especialidade são obrigatórios');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/painel/profissionais', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          doctor_name: name,
          doctor_crm: register || null,
          specialty,
          consultation_value: value || null,
          contact_email: email || null,
          contact_phone: phone || null,
          calendar_id: calendarId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Erro ao salvar');
        return;
      }
      toast.success('Profissional atualizado');
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
      <div className="flex items-end justify-between gap-4">
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

      {/* Modal Add/Edit */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
            />
            <motion.div
              className="fixed inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 top-1/2 -translate-y-1/2 z-50 w-auto sm:w-[480px] bg-white rounded-2xl shadow-2xl overflow-hidden"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-black/[0.06]">
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
              <div className="p-5 sm:p-6 space-y-3 max-h-[70vh] overflow-y-auto">
                <FormInput placeholder="Nome completo" value={name} onChange={setName} />
                <div className="grid grid-cols-2 gap-3">
                  <FormInput placeholder="Registro (CRM/CRO/CRP...)" value={register} onChange={setRegister} />
                  <FormInput placeholder="Especialidade" value={specialty} onChange={setSpecialty} />
                </div>
                <FormInput placeholder="Valor da consulta (R$)" value={value} onChange={setValue} inputMode="decimal" />
                <FormInput placeholder="Email de contato" value={email} onChange={setEmail} type="email" />
                <FormInput placeholder="Telefone de contato" value={phone} onChange={setPhone} type="tel" />
                <div>
                  <FormInput
                    placeholder="Calendar ID Google (ex: profissional@gmail.com ou xxx@group.calendar.google.com)"
                    value={calendarId}
                    onChange={setCalendarId}
                  />
                  <p className="text-[11px] text-zinc-400 mt-1.5 px-1">
                    Compartilhe esse calendar com o Service Account pra agenda funcionar.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 bg-zinc-50/60 border-t border-black/[0.06]">
                <button
                  onClick={closeModal}
                  className="h-10 px-4 rounded-lg text-[13px] font-semibold text-zinc-700 hover:bg-black/[0.04] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={isEditing ? handleSaveEdit : handleAdd}
                  disabled={submitting}
                  className="h-10 px-4 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-70"
                  style={{
                    background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                  }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isEditing ? 'Salvar alterações' : 'Cadastrar'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function DoctorCard({ doctor, onDelete, onEdit }: { doctor: Doctor; onDelete: (id: string, isPrimary: boolean) => void; onEdit: () => void }) {
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
              R$ {Number(doctor.consultation_value).toFixed(0)} / {doctor.consultation_duration}min
            </span>
          )}
          {doctor.payment_methods && <span>{doctor.payment_methods}</span>}
          {doctor.contact_email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {doctor.contact_email}
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
        {doctor.calendar_id && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
            <Calendar className="w-2.5 h-2.5" /> calendar
          </span>
        )}
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
  placeholder,
  value,
  onChange,
  type = 'text',
  inputMode,
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
      className="w-full h-11 px-3.5 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
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
