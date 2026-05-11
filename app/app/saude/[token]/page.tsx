'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { HeartPulse, Activity, Droplet, Scale, Thermometer, Wind, Loader2, CheckCircle2 } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';

interface ObsRow {
  id: number;
  loinc_code: string;
  display_name: string | null;
  value_numeric: number | string | null;
  unit: string | null;
  effective_time: string;
  data_quality_tag: 'clean' | 'outlier' | 'noisy' | 'rejected';
}

interface PageState {
  loading: boolean;
  error: string | null;
  firstName: string;
  observations: ObsRow[];
}

type FieldKey = 'hr' | 'sbp' | 'dbp' | 'weight' | 'temp' | 'spo2' | 'glucose';
const FIELD_LOINC: Record<FieldKey, string> = {
  hr: '8867-4',
  sbp: '8480-6',
  dbp: '8462-4',
  weight: '29463-7',
  temp: '8310-5',
  spo2: '59408-5',
  glucose: '2339-0',
};

const FIELD_META: Record<FieldKey, { label: string; unit: string; placeholder: string; icon: typeof HeartPulse }> = {
  hr: { label: 'Frequencia cardiaca', unit: 'bpm', placeholder: 'ex: 72', icon: HeartPulse },
  sbp: { label: 'Pressao sistolica', unit: 'mmHg', placeholder: 'ex: 120', icon: Activity },
  dbp: { label: 'Pressao diastolica', unit: 'mmHg', placeholder: 'ex: 80', icon: Activity },
  weight: { label: 'Peso', unit: 'kg', placeholder: 'ex: 70', icon: Scale },
  temp: { label: 'Temperatura', unit: 'C', placeholder: 'ex: 36.5', icon: Thermometer },
  spo2: { label: 'Saturacao (SpO2)', unit: '%', placeholder: 'ex: 98', icon: Wind },
  glucose: { label: 'Glicemia', unit: 'mg/dL', placeholder: 'ex: 95', icon: Droplet },
};

export default function ColetaSaudePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [state, setState] = useState<PageState>({
    loading: true,
    error: null,
    firstName: '',
    observations: [],
  });
  const [values, setValues] = useState<Record<FieldKey, string>>({
    hr: '', sbp: '', dbp: '', weight: '', temp: '', spo2: '', glucose: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ accepted: number; total: number; rejected: number } | null>(null);

  useEffect(() => {
    fetch(`/api/saude/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setState({
            loading: false,
            error: null,
            firstName: j.patient.first_name,
            observations: j.observations,
          });
        } else {
          setState({ loading: false, error: j.error ?? 'unknown_error', firstName: '', observations: [] });
        }
      })
      .catch((e) => setState({ loading: false, error: String(e), firstName: '', observations: [] }));
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const observations: { loinc_code: string; value: number }[] = [];
    (Object.keys(FIELD_LOINC) as FieldKey[]).forEach((k) => {
      const raw = values[k].trim().replace(',', '.');
      if (!raw) return;
      const n = Number(raw);
      if (isFinite(n) && n > 0) observations.push({ loinc_code: FIELD_LOINC[k], value: n });
    });
    if (observations.length === 0) {
      alert('Preencha pelo menos um valor pra enviar.');
      return;
    }
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await fetch(`/api/saude/${token}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observations }),
      });
      const j = await res.json();
      if (j.success) {
        setSubmitResult({ accepted: j.accepted, total: j.total, rejected: j.rejected });
        setValues({ hr: '', sbp: '', dbp: '', weight: '', temp: '', spo2: '', glucose: '' });
        // Recarrega historico
        fetch(`/api/saude/${token}`)
          .then((r) => r.json())
          .then((j2) => {
            if (j2.success) setState((s) => ({ ...s, observations: j2.observations }));
          });
      } else {
        alert(`Erro: ${j.error}`);
      }
    } catch (err) {
      alert(`Erro de rede: ${err}`);
    } finally {
      setSubmitting(false);
    }
  };

  const totalEntries = useMemo(() => {
    return (Object.values(values) as string[]).filter((v) => v.trim() !== '').length;
  }, [values]);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-6">
        <div className="max-w-sm text-center">
          <div className="text-[48px] mb-4" style={{ color: ACCENT }}>—</div>
          <h1 className="text-[20px] font-semibold text-zinc-900 mb-2">Link invalido ou expirado</h1>
          <p className="text-[13px] text-zinc-500">
            Pede pra sua clinica gerar um novo link de coleta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-black/[0.06] px-5 py-4">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <HeartPulse className="w-5 h-5" style={{ color: ACCENT }} />
          <span className="text-[13px] uppercase tracking-[0.12em] font-semibold text-zinc-500">Singulare Saude</span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 py-6">
        <h1 className="text-[24px] font-medium tracking-[-0.02em] text-zinc-900 mb-1">
          Ola, {state.firstName}
        </h1>
        <p className="text-[14px] text-zinc-500 mb-6">
          Registre suas medicoes de hoje. So preencher o que voce tem.
        </p>

        {submitResult && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 mb-5 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-semibold text-emerald-900">Enviado!</div>
              <div className="text-[12px] text-emerald-700">
                {submitResult.accepted} de {submitResult.total} medicoes registradas
                {submitResult.rejected > 0 && ` · ${submitResult.rejected} fora da faixa esperada (foram marcadas pra revisao)`}.
              </div>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-black/[0.06] p-5 space-y-4">
          {(Object.keys(FIELD_META) as FieldKey[]).map((k) => {
            const m = FIELD_META[k];
            const Icon = m.icon;
            return (
              <label key={k} className="block">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-[12px] uppercase tracking-wide font-semibold text-zinc-600">{m.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={values[k]}
                    onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                    placeholder={m.placeholder}
                    className="flex-1 h-11 px-3 rounded-lg border border-black/[0.08] focus:border-black/[0.2] focus:outline-none text-[15px]"
                  />
                  <span className="text-[12px] text-zinc-500 w-14 flex-shrink-0">{m.unit}</span>
                </div>
              </label>
            );
          })}

          <button
            type="submit"
            disabled={submitting || totalEntries === 0}
            className="w-full h-12 rounded-lg text-white font-semibold text-[14px] inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? 'Enviando...' : totalEntries === 0 ? 'Preencha pelo menos 1 valor' : `Enviar ${totalEntries} medicao${totalEntries > 1 ? 'oes' : ''}`}
          </button>

          <p className="text-[11px] text-zinc-400 text-center">
            Seus dados sao enviados com seguranca para a sua clinica. Voce esta autenticado(a) pelo link que recebeu, nao precisa de senha.
          </p>
        </form>

        {state.observations.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[12px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-3">
              Suas ultimas medicoes
            </h2>
            <div className="space-y-1.5">
              {state.observations.map((o) => {
                const d = new Date(o.effective_time);
                return (
                  <div key={o.id} className="bg-white rounded-lg border border-black/[0.05] px-3 py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-medium text-zinc-900">{o.display_name ?? o.loinc_code}</div>
                      <div className="text-[11px] text-zinc-500">
                        {d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[15px] font-semibold text-zinc-900">{o.value_numeric ?? '—'}</span>
                      <span className="text-[11px] text-zinc-500 ml-1">{o.unit ?? ''}</span>
                      {o.data_quality_tag === 'outlier' && (
                        <div className="text-[9px] uppercase tracking-wide font-bold text-amber-600">revisar</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
