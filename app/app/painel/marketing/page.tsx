'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface Pilar { score: number; max: number; [k: string]: unknown }
interface ScoreData {
  total_score: number;
  classification: string;
  score_change: number;
  previous_score: number;
  pilares: Record<string, Pilar>;
  collected_at: string;
}
interface Recommendation { priority: 'high' | 'medium' | 'low'; category: string; message: string; action: string }
interface Post { id: number; post_text: string; post_type: string; platform: string; status: string; hashtags: string[] }

function ScoreRing({ score }: { score: number }) {
  const size = 148;
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score <= 25 ? '#ef4444' : score <= 50 ? '#f59e0b' : score <= 75 ? '#22c55e' : ACCENT;
  const bgColor = score <= 25 ? '#fef2f2' : score <= 50 ? '#fffbeb' : score <= 75 ? '#f0fdf4' : ACCENT_SOFT;
  const label = score <= 25 ? 'Crítico' : score <= 50 ? 'Desenvolvendo' : score <= 75 ? 'Bom' : 'Excelente';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f4f4f5" strokeWidth="10" />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[34px] font-semibold tracking-tight leading-none" style={{ color }}>{score}</span>
          <span className="text-[11px] text-zinc-400 mt-0.5">/ 100</span>
        </div>
      </div>
      <span className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: bgColor, color }}>{label}</span>
    </div>
  );
}

function PilarRow({ icon, name, score, max, detail }: { icon: string; name: string; score: number; max: number; detail: string }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-3 py-2.5 border-t border-black/[0.05] first:border-t-0">
      <span className="text-base w-6 text-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[13px] font-medium text-zinc-800">{name}</span>
          <span className="text-[12px] font-semibold tabular-nums" style={{ color }}>{score}/{max}</span>
        </div>
        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)' }} />
        </div>
        <p className="text-[11px] text-zinc-400 mt-1 truncate">{detail}</p>
      </div>
    </div>
  );
}

function RecCard({ rec }: { rec: Recommendation }) {
  const s = {
    high: { dot: '🔴', label: 'Urgente', color: '#b91c1c', bg: '#fef2f2' },
    medium: { dot: '🟡', label: 'Importante', color: '#92400e', bg: '#fffbeb' },
    low: { dot: '🟢', label: 'Sugestão', color: '#166534', bg: '#f0fdf4' },
  }[rec.priority];
  return (
    <div className="rounded-xl border border-black/[0.06] p-4" style={{ background: s.bg }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px]">{s.dot}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: s.color }}>
          {s.label} · {rec.category}
        </span>
      </div>
      <p className="text-[13px] text-zinc-700 leading-relaxed">{rec.message}</p>
      <p className="text-[12px] font-medium mt-1.5" style={{ color: ACCENT_DEEP }}>→ {rec.action}</p>
    </div>
  );
}

function PostCard({ post, onApprove, onReject }: { post: Post; onApprove: () => void; onReject: () => void }) {
  const icons: Record<string, string> = { instagram: '📸', facebook: '📘', linkedin: '💼' };
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm">{icons[post.platform] || '📱'}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{post.platform}</span>
      </div>
      <p className="text-[13px] text-zinc-700 leading-relaxed line-clamp-3 mb-2">{post.post_text}</p>
      {post.hashtags?.length > 0 && (
        <p className="text-[11px] mb-3" style={{ color: ACCENT }}>
          {post.hashtags.map((h) => `#${h}`).join(' ')}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 h-8 rounded-lg text-white text-[12px] font-semibold transition-all hover:brightness-110"
          style={{ background: ACCENT_DEEP }}
        >
          ✓ Aprovar
        </button>
        <button
          onClick={onReject}
          className="h-8 px-3 rounded-lg text-zinc-500 text-[12px] bg-zinc-100 hover:bg-zinc-200 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function MarketingInner() {
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        fetch('/api/painel/marketing/score'),
        fetch('/api/painel/marketing/posts?status=pending_approval&limit=6'),
      ]);
      if (sRes.ok) {
        const d = await sRes.json();
        setScoreData(d.current);
        setRecs(d.recommendations || []);
      }
      if (pRes.ok) {
        const d = await pRes.json();
        setPosts(d.posts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const approve = async (id: number) => {
    await fetch(`/api/painel/marketing/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    fetchData();
  };

  const reject = async (id: number) => {
    await fetch(`/api/painel/marketing/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    });
    fetchData();
  };

  const p = scoreData?.pilares || {};
  const sortedRecs = [...recs].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
          Presença Digital
        </p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            Singulare Score
          </h1>
          {scoreData?.score_change !== undefined && scoreData.score_change !== 0 && (
            <span className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 ${scoreData.score_change > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {scoreData.score_change > 0 ? '↑' : '↓'} {Math.abs(scoreData.score_change)} pts
            </span>
          )}
        </div>
        {scoreData?.collected_at && (
          <p className="text-[13px] text-zinc-400 mt-1">
            Atualizado em {new Date(scoreData.collected_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
          </p>
        )}
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-zinc-300 animate-spin" />
        </div>
      ) : !scoreData ? (
        /* Empty state */
        <div className="rounded-2xl border border-dashed border-black/[0.10] p-12 text-center">
          <div
            className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4"
            style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
          >
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-[15px] font-semibold text-zinc-900 mb-1.5">Score sendo calculado</p>
          <p className="text-[13px] text-zinc-500 max-w-sm mx-auto leading-relaxed">
            A Singulare está coletando dados do Google, Doctoralia e redes sociais.
            O primeiro score aparece na próxima segunda-feira.
          </p>
        </div>
      ) : (
        <>
          {/* Score ring + pilares */}
          <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
              <div className="flex items-center justify-center p-8 sm:border-r border-b sm:border-b-0 border-black/[0.05]">
                <ScoreRing score={scoreData.total_score} />
              </div>
              <div className="p-5 sm:p-6">
                <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-400 mb-2">Detalhamento por pilar</p>
                <PilarRow icon="🔍" name="Google" score={p.google?.score as number || 0} max={30}
                  detail={`${(p.google?.rating as string) || '—'} ★ · ${(p.google?.reviews as number) || 0} avaliações`} />
                <PilarRow icon="🏥" name="Doctoralia" score={p.doctoralia?.score as number || 0} max={15}
                  detail={(p.doctoralia?.present as boolean) ? `${(p.doctoralia?.rating as string) || '—'} ★ · ${(p.doctoralia?.reviews as number) || 0} opiniões` : 'Perfil não encontrado'} />
                <PilarRow icon="📱" name="Redes Sociais" score={p.social?.score as number || 0} max={20}
                  detail={`${(p.social?.ig_followers as number) || 0} seguidores`} />
                <PilarRow icon="🌐" name="SEO & Website" score={p.seo?.score as number || 0} max={20}
                  detail={(p.seo?.website_exists as boolean) ? `Mobile: ${(p.seo?.mobile_score as number) || 0}/100` : 'Sem site próprio'} />
                <PilarRow icon="⚙️" name="Operacional" score={p.operational?.score as number || 0} max={15}
                  detail={`NPS: ${(p.operational?.avg_nps as string) || '—'}`} />
              </div>
            </div>
          </div>

          {/* Recomendações */}
          {sortedRecs.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-400 mb-3">Recomendações</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedRecs.map((r, i) => <RecCard key={i} rec={r} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Posts pendentes */}
      {posts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-400">Posts para aprovação</p>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}>
              {posts.length} pendentes
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onApprove={() => approve(post.id)} onReject={() => reject(post.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Tráfego pago CTA */}
      <div className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6 flex items-center gap-4">
        <div
          className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center"
          style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
        >
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-zinc-900">Tráfego Pago Gerenciado</p>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            Campanhas no Google e Instagram ativadas com um clique. A partir de R$ 300/mês.
          </p>
        </div>
        <Link
          href="/painel/marketing/configurar"
          className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-white text-[12.5px] font-semibold flex-shrink-0 hover:brightness-110 transition-all"
          style={{ background: ACCENT_DEEP }}
        >
          Ativar <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default function MarketingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-zinc-300 animate-spin" />
      </div>
    }>
      <MarketingInner />
    </Suspense>
  );
}
