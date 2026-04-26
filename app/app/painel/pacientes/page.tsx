'use client';

import { useEffect, useState, Suspense } from 'react';
import { Loader2, UserPlus, Phone, Mail, Calendar } from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import { PatientRowSkeleton } from '@/lib/painel-skeleton';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';

interface Patient {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  total_consultations: number;
  last_visit_at: string | null;
  last_doctor: string | null;
  doctor_preference: string | null;
  notes: string | null;
  tags: string[] | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function PacientesInner() {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/painel/pacientes');
        const json = await res.json();
        if (json.success) setPatients(json.patients);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId]);

  const filtered = patients.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.phone ?? '').toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q)
    );
  });

  if (!tenantId) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
          CRM
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
          Pacientes
        </h1>
        <p className="text-[14px] text-zinc-500 mt-1.5">
          Histórico, contatos e preferências dos seus pacientes.
        </p>
      </div>

      <input
        type="text"
        placeholder="Buscar por nome, telefone ou email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full h-11 px-4 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
      />

      {loading ? (
        <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
          <PatientRowSkeleton />
          <PatientRowSkeleton />
          <PatientRowSkeleton />
          <PatientRowSkeleton />
          <PatientRowSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[0.10] p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 mb-4">
            <UserPlus className="w-5 h-5 text-zinc-400" />
          </div>
          <p className="text-[15px] font-semibold text-zinc-900 mb-1">
            {patients.length === 0 ? 'Nenhum paciente ainda' : 'Nenhum resultado'}
          </p>
          <p className="text-[13px] text-zinc-500">
            {patients.length === 0
              ? 'Pacientes aparecem aqui automaticamente após o primeiro contato pelo WhatsApp.'
              : 'Tente outros termos.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 bg-zinc-50/60 border-b border-black/[0.06] text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
            <div className="col-span-4">Paciente</div>
            <div className="col-span-3">Contato</div>
            <div className="col-span-2">Última visita</div>
            <div className="col-span-2">Profissional</div>
            <div className="col-span-1 text-right">Cons.</div>
          </div>
          <div className="divide-y divide-black/[0.06]">
            {filtered.map((p) => (
              <div key={p.id} className="px-5 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center">
                <div className="col-span-4 min-w-0">
                  <p className="text-[14px] font-semibold text-zinc-900 truncate">{p.name ?? 'Sem nome'}</p>
                  <p className="text-[12px] text-zinc-500 sm:hidden mt-1">{p.phone}</p>
                </div>
                <div className="col-span-3 min-w-0 text-[13px] text-zinc-600 hidden sm:block">
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                    <span className="truncate">{p.phone}</span>
                  </div>
                  {p.email && (
                    <div className="flex items-center gap-1.5 truncate mt-0.5">
                      <Mail className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                      <span className="truncate">{p.email}</span>
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-[13px] text-zinc-600 hidden sm:flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-zinc-400" />
                  {fmtDate(p.last_visit_at)}
                </div>
                <div className="col-span-2 text-[13px] text-zinc-600 truncate hidden sm:block">
                  {p.last_doctor ?? p.doctor_preference ?? '—'}
                </div>
                <div className="col-span-1 text-right text-[14px] font-semibold text-zinc-900">
                  {p.total_consultations ?? 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-zinc-400 text-center">
        Mostrando até 100 pacientes. Filtros avançados em breve.
      </p>
    </div>
  );
}

export default function PacientesPage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <PacientesInner />
    </Suspense>
  );
}
