'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  Loader2,
  FileText,
  Plus,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import { DOC_TYPES, DOC_STATUSES, type DocStatus, type DocTypeKey, type MedicalDocument } from '@/lib/docs-types';

const ACCENT_DEEP = '#5746AF';

type DocWithPatient = MedicalDocument & { patient_name: string };

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: DocStatus }) {
  const info = DOC_STATUSES[status];
  return (
    <span
      className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded"
      style={{
        background: `${info.color}18`,
        color: info.color,
      }}
    >
      {info.label}
    </span>
  );
}

function DocsInner() {
  const me = useMe();
  const [docs, setDocs] = useState<DocWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DocStatus | ''>('');

  useEffect(() => {
    if (!me?.tenant_id) return;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        const res = await fetch(`/api/painel/docs?${params}`);
        const json = await res.json();
        if (json.success) setDocs(json.documents);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [me?.tenant_id, statusFilter]);

  if (!me?.tenant_id) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
            Documentos
          </p>
          <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            Documentos médicos
          </h1>
          <p className="text-[14px] text-zinc-500 mt-1.5">
            Atestados, guias e relatórios gerados pelo sistema.
          </p>
        </div>
        <Link
          href="/painel/docs/novo"
          className="h-10 px-4 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:brightness-110 transition-all flex-shrink-0"
          style={{ background: ACCENT_DEEP }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo documento</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-zinc-400" />
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors ${
            statusFilter === '' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Todos
        </button>
        {(Object.keys(DOC_STATUSES) as DocStatus[])
          .filter((s) => s !== 'cancelled')
          .map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors ${
                statusFilter === s ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {DOC_STATUSES[s].label}
            </button>
          ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[0.10] p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 mb-4">
            <FileText className="w-5 h-5 text-zinc-400" />
          </div>
          <p className="text-[15px] font-semibold text-zinc-900 mb-1">
            Nenhum documento ainda
          </p>
          <p className="text-[13px] text-zinc-500 mb-4">
            Crie atestados, guias e relatórios com formulários pré-preenchidos.
          </p>
          <Link
            href="/painel/docs/novo"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-white text-[13px] font-semibold hover:brightness-110 transition-all"
            style={{ background: ACCENT_DEEP }}
          >
            <Plus className="w-4 h-4" />
            Criar primeiro documento
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 bg-zinc-50/60 border-b border-black/[0.06] text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
            <div className="col-span-3">Tipo</div>
            <div className="col-span-3">Paciente</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Criado em</div>
            <div className="col-span-2 text-right">Ação</div>
          </div>
          <div className="divide-y divide-black/[0.06]">
            {docs.map((d) => (
              <Link
                key={d.id}
                href={`/painel/docs/${d.id}`}
                className="w-full text-left px-5 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center hover:bg-violet-50/30 transition-colors group block"
              >
                <div className="col-span-3 min-w-0">
                  <p className="text-[14px] font-semibold text-zinc-900 truncate">
                    {DOC_TYPES[d.doc_type]}
                  </p>
                  <p className="text-[12px] text-zinc-500 sm:hidden mt-0.5">
                    {d.patient_name} · {fmtDate(d.created_at)}
                  </p>
                </div>
                <div className="col-span-3 text-[13px] text-zinc-600 truncate hidden sm:block">
                  {d.patient_name}
                </div>
                <div className="col-span-2 hidden sm:block">
                  <StatusBadge status={d.status} />
                </div>
                <div className="col-span-2 text-[13px] text-zinc-600 hidden sm:block">
                  {fmtDate(d.created_at)}
                </div>
                <div className="col-span-2 text-right hidden sm:flex items-center justify-end">
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-violet-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  return (
    <Suspense fallback={<Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto mt-12" />}>
      <DocsInner />
    </Suspense>
  );
}
