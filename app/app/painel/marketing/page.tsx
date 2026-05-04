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

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

function scoreColor(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 70) return '#22c55e';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

function ScoreRingDark({ score }: { score: number }) {
  const size = 172;
  const sw = 7;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const [from, to] = score <= 25
    ? ['#ef4444', '#f87171']
    : score <= 50
    ? ['#f59e0b', '#fbbf24']
    : score <= 75
    ? ['#22c55e', '#4ade80']
    : [ACCENT, '#a78bfa'];
  const label = score <= 25 ? 'Crítico' : score <= 50 ? 'Desenvolvendo' : score <= 75 ? 'Bom' : 'Excelente';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="url(#sg)" strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 8px ${from}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[60px] font-semibold tracking-[-0.05em] leading-none text-white">{score}</span>
          <span className="text-[11px] text-white/25 mt-1.5">/ 100</span>
        </div>
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</span>
    </div>
  );
}

function PilarRowDark({ name, score, max, detail }: { name: string; score: number; max: number; detail: string }) {
  const pct = Math.round((score / max) * 100);
  const color = scoreColor(score, max);
  return (
    <div className="py-3 border-t border-white/[0.05] first:border-t-0">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 4px ${color}80` }} />
          <span className="text-[13px] font-medium text-white/70">{name}</span>
        </div>
        <span className="text-[12px] font-semibold tabular-nums text-white/50">{score}<span className="text-white/20">/{max}</span></span>
      </div>
      <div className="h-px bg-white/[0.07] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color, transition: 'width 1.3s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </div>
      <p className="text-[11px] text-white/25 mt-1.5 truncate">{detail}</p>
    </div>
  );
}

function RecCard({ rec }: { rec: Recommendation }) {
  const { borderColor, labelColor, label } = {
    high: { borderColor: '#ef4444', labelColor: '#dc2626', label: 'Urgente' },
    medium: { borderColor: '#f59e0b', labelColor: '#d97706', label: 'Importante' },
    low: { borderColor: '#22c55e', labelColor: '#16a34a', label: 'Sugestão' },
  }[rec.priority];

  return (
    <motion.div variants={fadeUp} className="rounded-xl bg-white border border-black/[0.06] p-4 overflow-hidden relative" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: borderColor }} />
      <div className="pl-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: borderColor }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: labelColor }}>
            {label} · {rec.category}
          </span>
        </div>
        <p className="text-[13px] text-zinc-700 leading-relaxed">{rec.message}</p>
        <p className="text-[12px] font-medium mt-2" style={{ color: ACCENT_DEEP }}>→ {rec.action}</p>
      </div>
    </motion.div>
  );
}

function PostCard({ post, onApprove, onReject }: { post: Post; onApprove: () => void; onReject: () => void }) {
  const platformLabel: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn' };
  return (
    <motion.div variants={fadeUp} className="rounded-xl border border-black/[0.07] bg-white p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded-md"
          style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
        >
          {platformLabel[post.platform] || post.platform}
        </span>
      </div>
      <p className="text-[13px] text-zinc-700 leading-relaxed line-clamp-3 mb-2">{post.post_text}</p>
      {post.hashtags?.length > 0 && (
        <p className="text-[11px] mb-3 text-zinc-400">{post.hashtags.slice(0, 4).map((h) => `#${h}`).join(' ')}</p>
      )}
      <div className="flex gap-2 mt-3">
        <button
          onClick={onApprove}
          className="flex-1 h-8 rounded-lg text-white text-[12px] font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: ACCENT_DEEP }}
        >
          Aprovar
        </button>
        <button
          onClick={onReject}
          className="h-8 px-3 rounded-lg text-zinc-400 text-[12px] font-medium bg-zinc-100 hover:bg-zinc-200 transition-colors active:scale-[0.98]"
        >
          Rejeitar
        </button>
      </div>
    </motion.div>
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
    <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-2" style={{ color: ACCENT }}>
          Presença Digital
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
          Singulare Score
        </h1>
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
        <motion.div variants={fadeUp} className="rounded-2xl border border-dashed border-black/[0.10] p-12 text-center">
          <div
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-4"
            style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
          >
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-[15px] font-semibold text-zinc-900 mb-1.5">Score sendo calculado</p>
          <p className="text-[13px] text-zinc-500 max-w-sm mx-auto leading-relaxed">
            A Singulare está coletando dados do Google, Doctoralia e redes sociais.
            O primeiro score aparece na próxima segunda-feira.
          </p>
        </motion.div>
      ) : (
        <>
          {/* Dark hero card — score ring + pilares */}
          <motion.div
            variants={fadeUp}
            className="rounded-2xl overflow-hidden relative"
            style={{ background: '#09090b' }}
          >
            {/* Dot grid */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
              }}
            />
            {/* Violet ambient glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 55% 55% at 22% 50%, rgba(110,86,207,0.20) 0%, transparent 70%)',
              }}
            />

            <div className="relative grid grid-cols-1 sm:grid-cols-[220px_1fr]">
              {/* Ring */}
              <div className="flex items-center justify-center p-8 sm:border-r border-white/[0.05]">
                <ScoreRingDark score={scoreData.total_score} />
              </div>

              {/* Pilares */}
              <div className="p-6 sm:p-7">
                <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-white/25 mb-1">Pilares</p>
                <PilarRowDark name="Google" score={p.google?.score as number || 0} max={30}
                  detail={`${(p.google?.rating as string) || '—'} ★ · ${(p.google?.reviews as number) || 0} avaliações`} />
                <PilarRowDark name="Doctoralia" score={p.doctoralia?.score as number || 0} max={15}
                  detail={(p.doctoralia?.present as boolean) ? `${(p.doctoralia?.rating as string) || '—'} ★ · ${(p.doctoralia?.reviews as number) || 0} opiniões` : 'Perfil não encontrado'} />
                <PilarRowDark name="Redes Sociais" score={p.social?.score as number || 0} max={20}
                  detail={`${(p.social?.ig_followers as number) || 0} seguidores`} />
                <PilarRowDark name="SEO & Website" score={p.seo?.score as number || 0} max={20}
                  detail={(p.seo?.website_exists as boolean) ? `Mobile: ${(p.seo?.mobile_score as number) || 0}/100` : 'Sem site próprio'} />
                <PilarRowDark name="Operacional" score={p.operational?.score as number || 0} max={15}
                  detail={`NPS: ${(p.operational?.avg_nps as string) || '—'}`} />
              </div>
            </div>
          </motion.div>

          {/* Recomendações */}
          {sortedRecs.length > 0 && (
            <motion.div variants={fadeUp}>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400 mb-3">Recomendações</p>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                variants={stagger}
                initial="hidden"
                animate="show"
              >
                {sortedRecs.map((r, i) => <RecCard key={i} rec={r} />)}
              </motion.div>
            </motion.div>
          )}
        </>
      )}

      {/* Posts pendentes */}
      {posts.length > 0 && (
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400">Posts para aprovação</p>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}>
              {posts.length}
            </span>
          </div>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onApprove={() => approve(post.id)} onReject={() => reject(post.id)} />
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* Tráfego pago CTA */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6 flex items-center gap-4"
        style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
      >
        <div
          className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center"
          style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
        >
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-zinc-900">Tráfego Pago Gerenciado</p>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            Campanhas no Google e Instagram. A partir de R$ 300/mês.
          </p>
        </div>
        <Link
          href="/painel/marketing/configurar"
          className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-white text-[12.5px] font-semibold flex-shrink-0 hover:brightness-110 transition-all active:scale-[0.97]"
          style={{ background: ACCENT_DEEP }}
        >
          Ativar <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </motion.div>
    </motion.div>
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
