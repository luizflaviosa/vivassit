'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronsUpDown, Check, Loader2, Building2 } from 'lucide-react';
import { useMe } from '@/lib/painel-context';

const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface TenantOption {
  tenant_id: string;
  clinic_name: string;
  plan_type: string;
  subscription_status: string;
  created_at: string;
}

const PLAN_LABEL: Record<string, string> = {
  basic: 'Starter',
  professional: 'Professional',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

export default function TenantSwitcher() {
  const me = useMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch lista 1x ao abrir (lazy)
  useEffect(() => {
    if (!open || tenants.length > 0) return;
    setLoading(true);
    fetch('/api/painel/tenants')
      .then((r) => r.json())
      .then((j) => { if (j.success) setTenants(j.tenants ?? []); })
      .finally(() => setLoading(false));
  }, [open, tenants.length]);

  // Click outside fecha
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleSwitch = async (tenantId: string) => {
    if (tenantId === me?.tenant_id) { setOpen(false); return; }
    setSwitching(tenantId);
    try {
      const res = await fetch('/api/painel/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const j = await res.json();
      if (j.success) {
        // Force reload pra refetch /api/painel/me + dados
        window.location.assign('/painel');
      }
    } finally {
      setSwitching(null);
    }
  };

  // Não mostra se tem só 1 tenant
  if (!me) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hidden sm:inline-flex items-center gap-2 h-9 px-3 -ml-1 rounded-md hover:bg-black/[0.04] transition-colors group"
        title="Trocar de clínica"
      >
        <span className="font-medium text-zinc-900 truncate max-w-[200px] text-[12px]">
          {me.clinic_name}
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.08em] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
        >
          {me.plan_type}
        </span>
        <ChevronsUpDown className="w-3 h-3 text-zinc-400 group-hover:text-zinc-700" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1.5 left-0 w-[320px] bg-white rounded-xl border border-black/[0.08] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.18)] z-50 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-black/[0.06] flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500">
                Suas clínicas {tenants.length > 0 && `(${tenants.length})`}
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto py-1">
              {loading ? (
                <div className="p-6 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                </div>
              ) : tenants.length === 0 ? (
                <p className="px-3 py-4 text-[12px] text-zinc-500 text-center">
                  Nenhuma outra clínica vinculada.
                </p>
              ) : (
                tenants.map((t) => {
                  const active = t.tenant_id === me.tenant_id;
                  return (
                    <button
                      key={t.tenant_id}
                      type="button"
                      onClick={() => handleSwitch(t.tenant_id)}
                      disabled={!!switching}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors ${
                        active ? 'bg-violet-50/40' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div
                        className="flex-shrink-0 h-8 w-8 rounded-md inline-flex items-center justify-center text-white text-[12px] font-bold uppercase"
                        style={{ background: active ? ACCENT_DEEP : '#71717A' }}
                      >
                        {(t.clinic_name ?? '?').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-medium text-zinc-900 truncate">
                          {t.clinic_name}
                        </div>
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                          <span>{PLAN_LABEL[t.plan_type] ?? t.plan_type}</span>
                          <span>·</span>
                          <span className={t.subscription_status === 'active' ? 'text-emerald-600' : 'text-zinc-500'}>
                            {t.subscription_status === 'active' ? 'ativa' : t.subscription_status}
                          </span>
                        </div>
                      </div>
                      {switching === t.tenant_id ? (
                        <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
                      ) : active ? (
                        <Check className="w-4 h-4" style={{ color: ACCENT_DEEP }} />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-3 py-2.5 border-t border-black/[0.06] bg-zinc-50/40 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">Trocar de clínica</span>
              <button
                type="button"
                onClick={() => router.push('/landing')}
                className="text-[11px] font-semibold text-zinc-600 hover:text-zinc-900"
              >
                + Nova clínica
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
