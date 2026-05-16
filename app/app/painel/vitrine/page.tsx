'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { Loader2, ExternalLink, Save, Eye, EyeOff, Globe, Sparkles, Plus, Trash2, ImagePlus, X } from 'lucide-react';
import { PROFESSIONAL_TYPES } from '@/lib/types';
import { useMe } from '@/lib/painel-context';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';

interface VitrineFaq {
  q: string;
  a: string;
}

interface VitrineBilling {
  plan_type: string | null;
  addon_marketing: boolean;
  subscription_status: string | null;
  can_publish: boolean;
}

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
  faqs?: VitrineFaq[];
  ai_generated_at?: string | null;
  unpublished_reason?: string | null;
}

const UNPUBLISH_REASON_COPY: Record<string, { title: string; cta: string; href: string }> = {
  subscription_canceled: {
    title: 'Sua pagina foi despublicada porque a assinatura foi cancelada.',
    cta: 'Reativar assinatura',
    href: '/painel/planos',
  },
  addon_removed: {
    title: 'Sua pagina foi despublicada porque o add-on de Marketing foi removido.',
    cta: 'Reativar add-on',
    href: '/painel/planos',
  },
  downgrade: {
    title: 'Sua pagina foi despublicada porque o plano foi alterado e nao inclui mais Marketing.',
    cta: 'Ajustar plano',
    href: '/painel/planos',
  },
};

function VitrinePageInner() {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';
  const [profile, setProfile] = useState<VitrineProfile | null>(null);
  const [billing, setBilling] = useState<VitrineBilling | null>(null);
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
  const [faqs, setFaqs] = useState<VitrineFaq[]>([]);
  const [regenerating, setRegenerating] = useState<'bio' | 'faqs' | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
          setFaqs(Array.isArray(json.profile.faqs) ? json.profile.faqs : []);
          if (json.billing) setBilling(json.billing);
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
        if (json.billing) setBilling(json.billing);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        return true;
      } else {
        if (res.status === 402 && json?.error === 'addon_marketing_required') {
          // Atualiza billing local pra UI mostrar upsell
          setBilling((b) => (b ? { ...b, can_publish: false } : b));
        }
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
    await save({ ...form, faqs } as Partial<VitrineProfile>);
  };

  const regenerate = async (kind: 'bio' | 'faqs') => {
    setRegenerating(kind);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/painel/vitrine/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.profile) {
        setProfile(json.profile);
        if (kind === 'bio' && typeof json.profile.bio === 'string') {
          setForm((f) => ({ ...f, bio: json.profile.bio }));
        }
        if (kind === 'faqs' && Array.isArray(json.profile.faqs)) {
          setFaqs(json.profile.faqs);
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(json.message || 'Erro ao regenerar com IA.');
      }
    } catch {
      setError('Erro de rede ao regenerar.');
    } finally {
      setRegenerating(null);
    }
  };

  // Redimensiona client-side pra max 800x800, devolve Blob jpeg/png conforme original.
  const resizeImage = (file: File, maxSide = 800): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagem invalida.'));
        img.onload = () => {
          const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
          const w = Math.round(img.width * ratio);
          const h = Math.round(img.height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas indisponivel neste navegador.'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          // mantem png so se transparencia importava; senao usa jpeg comprimido
          const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          canvas.toBlob(
            (blob) => {
              if (!blob) reject(new Error('Falha ao gerar imagem.'));
              else resolve(blob);
            },
            outType,
            outType === 'image/jpeg' ? 0.88 : undefined,
          );
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      if (file.size > 2 * 1024 * 1024 && !file.type.startsWith('image/')) {
        throw new Error('Use uma imagem JPG, PNG ou WEBP.');
      }
      const blob = await resizeImage(file, 800);
      const fd = new FormData();
      const filename = file.name.replace(/\.[^.]+$/, '') + (blob.type === 'image/png' ? '.png' : '.jpg');
      fd.append('file', new File([blob], filename, { type: blob.type }));
      const res = await fetch('/api/painel/vitrine/photo', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.success || !json.profile) {
        throw new Error(json.message || 'Erro ao subir foto.');
      }
      setProfile(json.profile);
      setForm((f) => ({ ...f, photo_url: json.profile.photo_url ?? '' }));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Erro ao subir foto.');
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onRemovePhoto = async () => {
    if (!profile?.photo_url) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const res = await fetch('/api/painel/vitrine/photo', { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success || !json.profile) {
        throw new Error(json.message || 'Erro ao remover foto.');
      }
      setProfile(json.profile);
      setForm((f) => ({ ...f, photo_url: '' }));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Erro ao remover foto.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const addFaq = () => {
    if (faqs.length >= 10) return;
    setFaqs([...faqs, { q: '', a: '' }]);
  };
  const updateFaq = (i: number, patch: Partial<VitrineFaq>) => {
    setFaqs(faqs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };
  const removeFaq = (i: number) => {
    setFaqs(faqs.filter((_, idx) => idx !== i));
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

  const unpublishedBanner =
    !profile.published && profile.unpublished_reason
      ? UNPUBLISH_REASON_COPY[profile.unpublished_reason] ?? {
          title: 'Sua pagina foi despublicada automaticamente.',
          cta: 'Ver planos',
          href: '/painel/planos',
        }
      : null;

  return (
    <div className="space-y-6">
      {unpublishedBanner && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-amber-900 leading-relaxed">
            {unpublishedBanner.title} Reative pra voltar ao ar.
          </p>
          <a
            href={unpublishedBanner.href}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] font-medium text-white"
            style={{ background: ACCENT }}
          >
            {unpublishedBanner.cta}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[12px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
                Bio (max 500 caracteres)
              </label>
              <button
                type="button"
                onClick={() => regenerate('bio')}
                disabled={regenerating !== null || saving}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium border border-black/[0.08] text-zinc-700 hover:bg-black/[0.03] disabled:opacity-50"
                title="Gerar uma nova versao da bio com IA"
              >
                {regenerating === 'bio' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" style={{ color: ACCENT_DEEP }} />}
                Regenerar com IA
              </button>
            </div>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              maxLength={500}
              rows={5}
              placeholder="Conte rapidamente sobre voce, formacao, areas de atuacao..."
              className="w-full px-3 py-2 rounded-lg border border-black/[0.08] text-[14px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6E56CF]/30 resize-y"
            />
            <p className="text-[11px] text-zinc-400 mt-1">{form.bio.length}/500</p>
            {profile.ai_generated_at && (
              <p className="text-[11px] mt-1" style={{ color: ACCENT_DEEP }}>
                Conteudo gerado por IA em {new Date(profile.ai_generated_at).toLocaleString('pt-BR')} — revise antes de publicar.
              </p>
            )}
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-1.5">
              Foto de perfil
            </label>
            <div className="flex items-start gap-4">
              {form.photo_url ? (
                <img
                  src={form.photo_url}
                  alt="Foto atual"
                  className="w-20 h-20 rounded-xl object-cover border border-black/[0.06]"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl border border-dashed border-black/[0.12] bg-[#FAFAF7] flex items-center justify-center text-zinc-300">
                  <ImagePlus className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onPickPhoto}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoUploading}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] font-medium border border-black/[0.08] text-zinc-700 hover:bg-black/[0.03] disabled:opacity-60"
                  >
                    {photoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                    {form.photo_url ? 'Trocar foto' : 'Enviar foto'}
                  </button>
                  {form.photo_url && (
                    <button
                      type="button"
                      onClick={onRemovePhoto}
                      disabled={photoUploading}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] font-medium border border-black/[0.08] text-zinc-700 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                    >
                      <X className="w-3.5 h-3.5" />
                      Remover
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1.5">
                  JPG, PNG ou WEBP, ate 2MB. Redimensionada automaticamente pra 800x800.
                </p>
                {photoError && <p className="text-[11px] text-red-700 mt-1">{photoError}</p>}
              </div>
            </div>
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

          <div className="pt-2 border-t border-black/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-[12px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
                  Perguntas frequentes (FAQs)
                </label>
                <p className="text-[11px] text-zinc-400 mt-0.5">Ate 10 perguntas. Aparecem na sua pagina publica.</p>
              </div>
              <button
                type="button"
                onClick={() => regenerate('faqs')}
                disabled={regenerating !== null || saving}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium border border-black/[0.08] text-zinc-700 hover:bg-black/[0.03] disabled:opacity-50"
                title="Gerar 5 FAQs novas com IA"
              >
                {regenerating === 'faqs' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" style={{ color: ACCENT_DEEP }} />}
                Regenerar com IA
              </button>
            </div>

            <div className="space-y-3">
              {faqs.length === 0 && (
                <p className="text-[12.5px] text-zinc-500 italic">Nenhuma FAQ ainda. Clique em &quot;Regenerar com IA&quot; ou adicione manualmente.</p>
              )}
              {faqs.map((f, i) => (
                <div key={i} className="rounded-lg border border-black/[0.06] bg-[#FAFAF7] p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      value={f.q}
                      onChange={(e) => updateFaq(i, { q: e.target.value })}
                      placeholder="Pergunta"
                      maxLength={200}
                      className="flex-1 h-9 px-2.5 rounded-md border border-black/[0.08] bg-white text-[13.5px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6E56CF]/30"
                    />
                    <button
                      type="button"
                      onClick={() => removeFaq(i)}
                      className="h-9 w-9 rounded-md border border-black/[0.08] text-zinc-500 hover:bg-red-50 hover:text-red-700 inline-flex items-center justify-center"
                      title="Remover esta FAQ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={f.a}
                    onChange={(e) => updateFaq(i, { a: e.target.value })}
                    placeholder="Resposta"
                    maxLength={600}
                    rows={2}
                    className="w-full px-2.5 py-2 rounded-md border border-black/[0.08] bg-white text-[13.5px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6E56CF]/30 resize-y"
                  />
                </div>
              ))}
            </div>

            {faqs.length < 10 && (
              <button
                type="button"
                onClick={addFaq}
                className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium border border-dashed border-black/[0.12] text-zinc-700 hover:bg-black/[0.03]"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar FAQ
              </button>
            )}
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

            {billing && !billing.can_publish ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-[13px] text-amber-900 leading-relaxed">
                  Pra publicar sua pagina e ranquear no Google, ative o add-on de
                  <span className="font-semibold"> Marketing</span>.
                </p>
                <a
                  href="/painel/planos"
                  className="mt-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] font-medium text-white"
                  style={{ background: ACCENT }}
                >
                  Ativar add-on
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <p className="text-[11px] text-amber-800/80 mt-2">
                  Voce pode editar bio, FAQs e foto agora — a publicacao fica liberada assim que o add-on for ativado.
                </p>
              </div>
            ) : (
              <>
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
              </>
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
