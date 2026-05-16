'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { Loader2, ExternalLink, Save, Eye, EyeOff, Globe } from 'lucide-react';
import { PROFESSIONAL_TYPES } from '@/lib/types';
import { useMe } from '@/lib/painel-context';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';

interface VitrineProfile {
  id: number;
  tenant_id: string;
  slug: string;
  display_name: string;
  professional_type: string;
  specialty: string;
  city: string;
  state: string;
  bio: string | null;
  photo_url: string | null;
  consultation_value: number | null;
  published: boolean;
  lgpd_consent_at: string | null;
  avg_nps: number | null;
  review_count: number;
}

function VitrinePageInner() {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';
  const [profile, setProfile] = useState<VitrineProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // form state (controlado)
  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    photo_url: '',
    professional_type: 'medico',
    specialty: '',
    city: '',
    state: 'SP',
  });
  const [confirmPublish, setConfirmPublish] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const res = await fetch('/api/painel/vitrine', { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.success && json.profile) {
          setProfile(json.profile);
          setForm({
            display_name: json.profile.display_name ?? '',
            bio: json.profile.bio ?? '',
            photo_url: json.profile.photo_url ?? '',
            professional_type: json.profile.professional_type ?? 'medico',
            specialty: json.profile.specialty ?? '',
            city: json.profile.city ?? '',
            state: json.profile.state ?? 'SP',
          });
        } else {
          setError(json.message || 'Nao foi possivel carregar a pagina publica.');
        }
      } catch {
        setError('Erro de rede ao carregar a pagina publica.');
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId]);

  const publicUrl = useMemo(() => {
    if (!profile?.slug) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://singulare.org';
    return `${origin}/p/${profile.slug}`;
  }, [profile?.slug]);

  const save = async (patch: Partial<VitrineProfile>) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/painel/vitrine', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setProfile(json.profile);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        return true;
      } else {
        setError(json.message || 'Erro ao salvar.');
        return false;
      }
    } catch {
      setError('Erro de rede ao salvar.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await save(form as Partial<VitrineProfile>);
  };

  const onTogglePublish = async () => {
    if (!profile) return;
    // Se vai publicar, exige confirmacao LGPD
    if (!profile.published && !confirmPublish) {
      setError('Marque a caixa de consentimento LGPD antes de publicar.');
      return;
    }
    await save({ published: !profile.published });
  };

  if (!tenantId || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center">
        <p className="text-zinc-600">{error || 'Pagina publica indisponivel.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
            Crescimento
          </p>
          <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            Pagina publica
          </h1>
          <p className="text-[14px] text-zinc-500 mt-1.5">
            Sua pagina em <span className="font-mono text-zinc-700">singulare.org/p/{profile.slug}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium ${
            profile.published
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-zinc-100 text-zinc-600'
          }`}>
            {profile.published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {profile.published ? 'Publicada' : 'Nao publicada'}
          </span>
          {profile.published && publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium border border-black/[0.08] text-zinc-700 hover:bg-black/[0.03]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver pagina ao vivo
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        {/* Formulario */}
        <form onSubmit={onSubmitForm} className="space-y-5 rounded-2xl border border-black/[0.06] bg-white p-6">
          <div>
            <label className="block text-[12px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-1.5">
              Nome de exibicao
            </label>
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              maxLength={120}
              className="w-full h-10 px-3 rounded-lg border border-black/[0.08] text-[14px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6E56CF]/30"
            />
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-1.5">
              Bio (max 500 caracteres)
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              maxLength={500}
              rows={5}
              placeholder="Conte rapidamente sobre voce, formacao, areas de atuacao..."
              className="w-full px-3 py-2 rounded-lg border border-black/[0.08] text-[14px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6E56CF]/30 resize-y"
            />
            <p className="text-[11px] text-zinc-400 mt-1">{form.bio.length}/500</p>
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-1.5">
              URL da foto
            </label>
            <input
              type="url"
              value={form.photo_url}
              onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
              placeholder="https://..."
              className="w-full h-10 px-3 rounded-lg border border-black/[0.08] text-[14px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6E56CF]/30"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              TODO: upload direto via Supabase Storage. Por enquanto, cole uma URL publica.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-1.5">
                Tipo
              </label>
              <select
                value={form.professional_type}
                onChange={(e) => setForm({ ...form, professional_type: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-black/[0.08] text-[14px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6E56CF]/30 bg-white"
              >
                {Object.entries(PROFESSIONAL_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-1.5">
                Especialidade
              </label>
              <input
                type="text"
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-black/[0.08] text-[14px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6E56CF]/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div>
              <label className="block text-[12px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-1.5">
                Cidade
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-black/[0.08] text-[14px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6E56CF]/30"
              />
            </div>
            <div>
              <label className="block text-[12px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-1.5">
                UF
              </label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })}
                maxLength={2}
                className="w-full h-10 px-3 rounded-lg border border-black/[0.08] text-[14px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6E56CF]/30 uppercase"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-white text-[14px] font-medium disabled:opacity-60"
              style={{ background: ACCENT }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar alteracoes
            </button>
            {saved && <span className="text-[13px] text-emerald-700">Salvo!</span>}
            {error && <span className="text-[13px] text-red-700">{error}</span>}
          </div>
        </form>

        {/* Painel lateral: publish + LGPD + preview link */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-black/[0.06] bg-white p-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F5F3FF' }}>
                <Globe className="w-5 h-5" style={{ color: ACCENT_DEEP }} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-zinc-900">Publicacao</h3>
                <p className="text-[13px] text-zinc-500 mt-0.5">
                  Sua pagina so aparece no buscador e no link publico depois que voce publica.
                </p>
              </div>
            </div>

            {!profile.published && (
              <label className="flex items-start gap-2.5 mt-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmPublish}
                  onChange={(e) => setConfirmPublish(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-black/20"
                />
                <span className="text-[12.5px] text-zinc-600 leading-relaxed">
                  Concordo que meu nome, foto, especialidade e cidade fiquem visiveis publicamente em
                  <span className="font-mono"> singulare.org/p/{profile.slug}</span> e possam ser indexados em buscadores.
                  Posso despublicar a qualquer momento.
                </span>
              </label>
            )}

            <button
              type="button"
              onClick={onTogglePublish}
              disabled={saving || (!profile.published && !confirmPublish)}
              className={`mt-4 w-full h-10 rounded-lg text-[14px] font-medium disabled:opacity-50 ${
                profile.published
                  ? 'border border-black/[0.08] text-zinc-700 hover:bg-black/[0.03]'
                  : 'text-white'
              }`}
              style={profile.published ? undefined : { background: ACCENT }}
            >
              {saving
                ? 'Salvando...'
                : profile.published
                  ? 'Despublicar pagina'
                  : 'Publicar pagina'}
            </button>

            {profile.lgpd_consent_at && (
              <p className="text-[11px] text-zinc-400 mt-3">
                Consentimento LGPD registrado em {new Date(profile.lgpd_consent_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-black/[0.06] bg-white p-6">
            <h3 className="text-[15px] font-semibold text-zinc-900 mb-2">Pre-visualizacao</h3>
            <p className="text-[13px] text-zinc-500 mb-4">
              {profile.published
                ? 'Veja como aparece pro publico.'
                : 'A previa abaixo simula o layout. Publique pra disponibilizar a URL real.'}
            </p>
            {profile.published && publicUrl ? (
              <iframe
                src={publicUrl}
                title="Previa da pagina publica"
                className="w-full h-[520px] rounded-lg border border-black/[0.06] bg-[#FAFAF7]"
              />
            ) : (
              <div className="rounded-lg border border-dashed border-black/[0.1] bg-[#FAFAF7] p-6 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F5F3FF] text-2xl font-medium mb-3" style={{ color: ACCENT_DEEP }}>
                  {(form.display_name || '?').charAt(0).toUpperCase()}
                </div>
                <p className="text-[15px] font-semibold text-zinc-900">{form.display_name || 'Seu nome'}</p>
                <p className="text-[13px] text-zinc-500 mt-0.5">
                  {(PROFESSIONAL_TYPES[form.professional_type as keyof typeof PROFESSIONAL_TYPES] || form.professional_type)} - {form.specialty || 'Especialidade'}
                </p>
                <p className="text-[12px] text-zinc-400 mt-0.5">
                  {form.city || 'Cidade'}, {form.state || 'UF'}
                </p>
                {form.bio && (
                  <p className="text-[13px] text-zinc-600 mt-4 text-left leading-relaxed">{form.bio}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VitrinePage() {
  return (
    <Suspense fallback={null}>
      <VitrinePageInner />
    </Suspense>
  );
}
