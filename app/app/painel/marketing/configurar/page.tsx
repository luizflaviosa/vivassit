'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  ArrowLeft,
  Save,
  ExternalLink,
  Star,
  Instagram,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import type { MarketingSubscription } from '@/lib/marketing-types';

const ACCENT_DEEP = '#5746AF';

interface SubExtra {
  instagram_business_account_id?: string | null;
  instagram_username?: string | null;
  instagram_token_expires_at?: string | null;
  facebook_page_id?: string | null;
  gbp_account_id?: string | null;
  gbp_location_id?: string | null;
  gbp_location_name?: string | null;
  gbp_connected_at?: string | null;
}

type ExtendedSub = MarketingSubscription & SubExtra;

function tokenStatus(expiresAt?: string | null): { label: string; tone: 'ok' | 'warn' | 'danger' } | null {
  if (!expiresAt) return null;
  const days = Math.round((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `expirado há ${Math.abs(days)}d`, tone: 'danger' };
  if (days < 7) return { label: `expira em ${days}d`, tone: 'danger' };
  if (days < 14) return { label: `expira em ${days}d`, tone: 'warn' };
  return { label: `válido por ${days}d`, tone: 'ok' };
}

function PageInner() {
  const me = useMe();
  const router = useRouter();
  const params = useSearchParams();

  const [sub, setSub] = useState<ExtendedSub | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [googleReviewUrl, setGoogleReviewUrl] = useState('');

  useEffect(() => {
    const errKey = params.get('error');
    const connected = params.get('connected');
    if (connected === 'instagram') {
      const u = params.get('username');
      setNotice({ kind: 'success', text: `Instagram conectado${u ? ` (@${u})` : ''}.` });
    } else if (connected === 'gbp') {
      const loc = params.get('location');
      setNotice({ kind: 'success', text: `Google Business conectado${loc ? ` (${loc})` : ''}.` });
    } else if (errKey) {
      setNotice({ kind: 'error', text: `Erro: ${errKey}` });
    }
    if (errKey || connected) {
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.toString());
    }
  }, [params]);

  useEffect(() => {
    if (!me?.tenant_id) return;
    fetch('/api/painel/marketing/subscription')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.subscription) {
          setSub(json.subscription);
          setGoogleReviewUrl(json.subscription.google_review_url ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, [me?.tenant_id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/painel/marketing/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_review_url: googleReviewUrl.trim() || null }),
      });
      const json = await res.json();
      if (json.success) {
        setSub(json.subscription);
        router.push('/painel/marketing');
      } else {
        alert(json.message || 'Erro ao salvar');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de conexão');
    } finally {
      setSaving(false);
    }
  };

  if (!me?.tenant_id) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => router.push('/painel/marketing')}
          className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Marketing
        </button>
        <p className="text-[15px] text-zinc-500">Ative o plano Presença primeiro para configurar.</p>
      </div>
    );
  }

  const igConnected = !!(sub.instagram_business_account_id && sub.instagram_token_expires_at);
  const gbpConnected = !!sub.gbp_account_id;
  const igStatus = tokenStatus(sub.instagram_token_expires_at);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push('/painel/marketing')}
        className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Marketing
      </button>

      <div>
        <h1 className="text-[22px] font-medium tracking-[-0.02em] text-zinc-900">
          Configurações de marketing
        </h1>
        <p className="text-[14px] text-zinc-500 mt-1">
          Configure as integrações do Singulare Presença.
        </p>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-[13px] flex items-start gap-2 ${
            notice.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {notice.kind === 'success' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Instagram OAuth */}
      <div className="rounded-xl border border-black/[0.07] bg-white p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-violet-50 flex items-center justify-center">
              <Instagram className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-zinc-900">Instagram</p>
              <p className="text-[12px] text-zinc-500 mt-0.5">
                {igConnected
                  ? `Conectado como @${sub.instagram_username ?? sub.instagram_business_account_id}`
                  : 'Permite publicar posts e ler engajamento'}
              </p>
              {igStatus && (
                <span
                  className={`inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded ${
                    igStatus.tone === 'ok'
                      ? 'bg-emerald-50 text-emerald-700'
                      : igStatus.tone === 'warn'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  Token {igStatus.label}
                </span>
              )}
            </div>
          </div>
          <a
            href="/api/painel/marketing/oauth/instagram"
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-[13px] font-medium text-white hover:brightness-110 transition-all"
            style={{ background: ACCENT_DEEP }}
          >
            {igConnected ? <RotateCw className="w-3.5 h-3.5" /> : <Instagram className="w-3.5 h-3.5" />}
            {igConnected ? 'Reconectar' : 'Conectar'}
          </a>
        </div>
        <p className="text-[11px] text-zinc-400">
          Requer Instagram Business linkado a uma página Facebook. Token long-lived (60d) renovado mensalmente.
        </p>
      </div>

      {/* Google Business Profile OAuth */}
      <div className="rounded-xl border border-black/[0.07] bg-white p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-zinc-900">Google Business Profile</p>
              <p className="text-[12px] text-zinc-500 mt-0.5">
                {gbpConnected
                  ? `Conectado: ${sub.gbp_location_name ?? sub.gbp_location_id}`
                  : 'Insights de visualizações, chamadas, direções e cliques'}
              </p>
            </div>
          </div>
          <a
            href="/api/painel/marketing/oauth/gbp"
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-[13px] font-medium text-white hover:brightness-110 transition-all"
            style={{ background: ACCENT_DEEP }}
          >
            {gbpConnected ? <RotateCw className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
            {gbpConnected ? 'Reconectar' : 'Conectar'}
          </a>
        </div>
      </div>

      {/* Google Review URL */}
      <div className="rounded-xl border border-black/[0.07] bg-white p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center">
            <Star className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-zinc-900">Google Review</p>
            <p className="text-[12px] text-zinc-500">
              Link direto para pacientes deixarem avaliação
            </p>
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-zinc-700 mb-2">
            URL do Google Review
          </label>
          <input
            type="url"
            value={googleReviewUrl}
            onChange={(e) => setGoogleReviewUrl(e.target.value)}
            placeholder="https://g.page/r/CeA1B2C3D4E5/review"
            className="w-full h-11 px-4 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
          />
          <p className="text-[12px] text-zinc-400 mt-2">
            Quando um paciente der NPS 9 ou 10, receberá automaticamente uma mensagem no WhatsApp com esse link.
          </p>
        </div>

        {/* Help box */}
        <div className="rounded-lg bg-zinc-50 p-4 space-y-2">
          <p className="text-[13px] font-semibold text-zinc-700">Como encontrar a URL:</p>
          <ol className="text-[12px] text-zinc-500 space-y-1.5 list-decimal list-inside">
            <li>Acesse o Google Maps e busque sua clínica</li>
            <li>Clique no nome da clínica para ver o perfil</li>
            <li>Clique em &quot;Pedir avaliações&quot; ou copie o link do perfil</li>
            <li>Adicione <code className="bg-zinc-200 px-1 rounded">/review</code> ao final, se necessário</li>
          </ol>
          <a
            href="https://support.google.com/business/answer/7035772"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-600 hover:text-violet-800"
          >
            Ver instruções do Google
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 rounded-xl text-white text-[15px] font-semibold hover:brightness-110 transition-all disabled:opacity-40"
        style={{ background: ACCENT_DEEP }}
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        ) : (
          <span className="inline-flex items-center gap-2">
            <Save className="w-4 h-4" />
            Salvar configurações
          </span>
        )}
      </button>
    </div>
  );
}

export default function MarketingConfigurarPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 text-zinc-400 animate-spin" /></div>}>
      <PageInner />
    </Suspense>
  );
}
