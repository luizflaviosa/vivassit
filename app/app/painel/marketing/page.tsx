'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, TrendingUp, ChevronRight, ChevronDown,
  Sparkles, Star, Globe, MessageSquare, Megaphone,
  CheckCircle, Layout, Settings, ExternalLink, MapPin,
  Zap, AlertCircle, Users, Target,
} from 'lucide-react';
import Link from 'next/link';

const ACCENT = '#0F1B33';
const ACCENT_DEEP = '#0F1B33';
const ACCENT_SOFT = '#F5F3FF';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PilarGoogle {
  score: number; max: number; rating?: number; reviews?: number;
  verified?: boolean; has_hours?: boolean; has_photos?: boolean;
  photos_count?: number; top10?: boolean; position?: number; knowledge_panel?: boolean;
}
interface PilarDoctoralia {
  score: number; max: number; present?: boolean; rating?: number;
  reviews?: number; url?: string; online_booking?: boolean;
}
interface PilarSocial {
  score: number; max: number; ig_followers?: number; ig_posts_count?: number;
  ig_engagement?: number; ig_posts_30d?: number; ig_has_bio_crm?: boolean;
  ig_has_link?: boolean; fb_exists?: boolean; fb_fans?: number;
  fb_rating?: number; fb_posts_30d?: number;
}
interface PilarSeo {
  score: number; max: number; website_exists?: boolean; website_ssl?: boolean;
  mobile_score?: number; performance?: number; top10?: boolean;
  position?: number; knowledge_panel?: boolean; own_site_in_results?: boolean;
}
interface PilarOperational {
  score: number; max: number; booking_rate?: number; avg_nps?: number;
  noshow_rate?: number; recurrence_rate?: number; avg_response_minutes?: number;
}
interface ScoreData {
  total_score: number; classification: string;
  score_change: number; previous_score: number; collected_at: string;
  pilares: {
    google: PilarGoogle; doctoralia: PilarDoctoralia;
    social: PilarSocial; seo: PilarSeo; operational: PilarOperational;
  };
}
interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string; message: string; action: string;
}
interface Post {
  id: number; post_text: string; post_type: string;
  platform: string; status: string; hashtags: string[];
}
interface RegionDemand {
  is_mock: boolean;
  is_cached?: boolean;
  location: string;
  location_level?: 'city' | 'state' | 'country';
  location_disclaimer?: string | null;
  specialty: string;
  total_monthly_volume: number;
  avg_cpc: number | null;
  keywords: Array<{
    keyword: string; volume: number;
    competition_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
    cpc: number | null;
  }>;
  name_search: {
    doctor_name: string;
    total_volume: number;
    keywords: Array<{
      keyword: string; volume: number;
      competition_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
      cpc: number | null;
    }>;
  } | null;
  trend?: {
    previous_total_monthly_volume: number | null;
    previous_total_name_volume: number | null;
    previous_collected_at: string | null;
    delta_market_pct: number | null;
    delta_name_pct: number | null;
    history_points: Array<{ collected_at: string; total_monthly_volume: number; total_name_volume: number }>;
  };
}

interface Competitors {
  is_mock: boolean;
  is_cached?: boolean;
  search_query: string;
  location_label: string;
  competitors: Array<{
    place_id: string;
    name: string;
    rating: number | null;
    reviews: number;
    address: string;
    distance_km: number | null;
    is_self: boolean;
  }>;
  market_stats: {
    total_competitors: number;
    avg_rating: number | null;
    avg_reviews: number | null;
    median_reviews: number | null;
    top_rating: number | null;
    top_reviews: number | null;
    self_position_by_reviews: number | null;
    self_percentile_by_reviews: number | null;
  };
  collected_at: string;
  trend?: {
    previous_avg_reviews: number | null;
    previous_self_percentile: number | null;
    delta_self_percentile: number | null;
    history_points: Array<{ collected_at: string; avg_reviews: number | null; self_percentile: number | null }>;
  };
}

interface GbpInsights {
  is_mock: boolean;
  is_cached?: boolean;
  location_name: string;
  period_start: string;
  period_end: string;
  totals: {
    impressions_search: number;
    impressions_maps: number;
    impressions_total: number;
    direction_requests: number;
    call_clicks: number;
    website_clicks: number;
    bookings: number;
    conversations: number;
  };
  daily: Array<{ date: string; impressions: number; calls: number; directions: number; website: number }>;
  collected_at: string;
  trend?: {
    previous_impressions_total: number | null;
    previous_call_clicks: number | null;
    previous_collected_at: string | null;
    delta_impressions_pct: number | null;
    delta_calls_pct: number | null;
    history_points: Array<{ collected_at: string; impressions_total: number; call_clicks: number }>;
  };
}

// ─── Animations ───────────────────────────────────────────────────────────────
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(score: number, max: number) { return Math.round((score / max) * 100); }

function googleSummary(p: PilarGoogle): string {
  const rev = p.reviews ?? 0;
  const rat = p.rating ? `${p.rating}★` : '';
  if (rev === 0) return 'Nenhuma avaliação ainda — você não aparece nas buscas locais';
  if (rev < 10) return `${rev} avaliação${rev > 1 ? 'ões' : ''} ${rat} — poucas avaliações limitam sua visibilidade`;
  if (rev < 50) return `${rev} avaliações ${rat} — crescendo bem, continue pedindo reviews`;
  return `${rev} avaliações ${rat} — ótima reputação no Google`;
}
function doctoraliaSummary(p: PilarDoctoralia): string {
  if (!p.present) return 'Sem perfil — plataforma com milhões de buscas mensais de pacientes';
  const rev = p.reviews ?? 0;
  const rat = p.rating ? `${p.rating}★` : '';
  const booking = p.online_booking ? ' · Agendamento online ativo' : ' · Sem agendamento online';
  return `${rev} opiniões ${rat}${booking}`;
}
function socialSummary(p: PilarSocial): string {
  const fol = p.ig_followers ?? 0;
  const posts30 = p.ig_posts_30d ?? 0;
  if (fol === 0) return 'Sem presença no Instagram — canal essencial para atrair pacientes';
  const base = fol < 500
    ? `${fol} seguidores — perfil iniciante, poste regularmente`
    : fol < 2000
    ? `${fol} seguidores — boa base, foque em conteúdo educativo`
    : `${fol} seguidores — ótima presença nas redes`;
  return posts30 > 0 ? `${base} · ${posts30} posts nos últimos 30 dias` : `${base} · Sem posts recentes`;
}
function seoSummary(p: PilarSeo): string {
  if (!p.website_exists) return 'Sem site próprio — dificulta aparecer no Google para sua especialidade';
  const mob = p.mobile_score ? `Mobile: ${p.mobile_score}/100` : '';
  const pos = p.top10 ? 'Aparece no top 10 do Google' : 'Ainda não aparece no top 10';
  return [pos, mob].filter(Boolean).join(' · ');
}
function operationalSummary(p: PilarOperational): string {
  const parts: string[] = [];
  if (p.avg_nps != null) parts.push(`NPS médio: ${Number(p.avg_nps).toFixed(1)}`);
  if (p.booking_rate != null) parts.push(`${Math.round(Number(p.booking_rate) * 100)}% de agendamentos confirmados`);
  if (p.noshow_rate != null && Number(p.noshow_rate) > 0) parts.push(`${Math.round(Number(p.noshow_rate) * 100)}% no-show`);
  if (p.recurrence_rate != null) parts.push(`${Math.round(Number(p.recurrence_rate) * 100)}% de retorno`);
  return parts.length > 0 ? parts.join(' · ') : 'Dados operacionais sendo coletados com base nos atendimentos';
}

// ─── Conceito por atributo de reputação ───────────────────────────────────────
const PILLAR_CONCEPTS = {
  google:      { name: 'Descoberta',    subtitle: 'ser encontrado por quem ainda não conhece a clínica' },
  doctoralia:  { name: 'Credibilidade', subtitle: 'ser escolhida entre alternativas em pesquisa profunda' },
  social:      { name: 'Vínculo',       subtitle: 'estar presente entre uma consulta e outra' },
  seo:         { name: 'Autoridade',    subtitle: 'ter voz própria, sem depender de plataformas terceiras' },
  operational: { name: 'Lealdade',      subtitle: 'transformar atendimento em retorno e indicação' },
} as const;

function stageOf(p: number): { label: string; color: string; bg: string } {
  if (p <= 25) return { label: 'Inicial',           color: '#ef4444', bg: '#fef2f2' };
  if (p <= 50) return { label: 'Em desenvolvimento', color: '#f59e0b', bg: '#fffbeb' };
  if (p <= 75) return { label: 'Consolidada',        color: '#22c55e', bg: '#f0fdf4' };
  return       { label: 'Referência',                color: ACCENT,    bg: ACCENT_SOFT };
}

function buildNarrative(s: ScoreData): string {
  const items = [
    { key: 'google',      p: pct(s.pilares.google.score, 30) },
    { key: 'doctoralia',  p: pct(s.pilares.doctoralia.score, 15) },
    { key: 'social',      p: pct(s.pilares.social.score, 20) },
    { key: 'seo',         p: pct(s.pilares.seo.score, 20) },
    { key: 'operational', p: pct(s.pilares.operational.score, 15) },
  ] as const;
  const sorted = [...items].sort((a, b) => b.p - a.p);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const topName = PILLAR_CONCEPTS[top.key].name.toLowerCase();
  const bottomName = PILLAR_CONCEPTS[bottom.key].name.toLowerCase();
  if (top.p < 25) {
    return `Os cinco atributos ainda estão em estágio inicial. O ponto mais maduro é a ${topName}; o menor, a ${bottomName} — começar pela alavanca de menor custo costuma ser o caminho.`;
  }
  if (top.p >= 70 && bottom.p < 30) {
    return `A ${topName} já é um capital consolidado, mas a ${bottomName} ainda não acompanha. Converter um no motor do outro é a maior alavanca disponível.`;
  }
  return `A ${topName} é o atributo mais maduro. A ${bottomName} é a que mais tem espaço para crescer — e seu avanço move o score com mais força.`;
}

// ─── ScoreRing ─────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const size = 128;
  const sw = 7;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const stage = stageOf(score);
  const color = stage.color;
  const label = stage.label;
  const labelBg = stage.bg;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f4f4f5" strokeWidth={sw} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[40px] font-semibold tracking-[-0.04em] leading-none" style={{ color }}>{score}</span>
          <span className="text-[10.5px] text-zinc-400 mt-0.5">/ 100</span>
        </div>
      </div>
      <span className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: labelBg, color }}>{label}</span>
    </div>
  );
}

// ─── AtributoRow ──────────────────────────────────────────────────────────────
function AtributoRow({
  index, name, subtitle, score, max, summary,
}: {
  index: number; name: string; subtitle: string;
  score: number; max: number; summary: string;
}) {
  const p = pct(score, max);
  const stage = stageOf(p);
  const ordinal = String(index).padStart(2, '0');

  return (
    <div className="group grid grid-cols-[32px_1fr] sm:grid-cols-[36px_minmax(0,1.3fr)_minmax(0,1.1fr)_88px] gap-x-3 sm:gap-x-5 gap-y-1.5 px-4 sm:px-5 py-3.5 border-t border-black/[0.05] first:border-t-0 transition-colors hover:bg-zinc-50/50">

      {/* Numeração editorial */}
      <div className="row-span-2 sm:row-span-1 flex items-start sm:items-center pt-0.5 sm:pt-0">
        <span className="text-[16px] sm:text-[17px] font-light tabular-nums text-zinc-300 tracking-tight">
          {ordinal}
        </span>
      </div>

      {/* Conceito + subtítulo conceitual */}
      <div className="min-w-0">
        <h3 className="text-[14px] sm:text-[15px] font-semibold text-zinc-900 tracking-[-0.012em] mb-0.5">
          {name}
        </h3>
        <p className="text-[11.5px] text-zinc-500 leading-[1.4]">
          {subtitle}
        </p>
      </div>

      {/* Maturidade · barra + pontos + summary técnico (texto quebra em mais linhas se preciso) */}
      <div className="hidden sm:flex flex-col gap-1 justify-center min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[9.5px] uppercase tracking-[0.12em] font-semibold text-zinc-400">
            Maturidade
          </span>
          <span className="text-[11.5px] tabular-nums font-semibold" style={{ color: stage.color }}>
            {score}<span className="text-zinc-300 font-normal">/{max}</span>
          </span>
        </div>
        <div className="h-[3px] bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${p}%`,
              background: stage.color,
              transition: 'width 1.3s cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </div>
        <p
          className="text-[10.5px] text-zinc-400 leading-[1.45] break-words"
          title={summary}
        >
          {summary}
        </p>
      </div>

      {/* Estágio (chip) */}
      <div className="hidden sm:flex items-start justify-end pt-0.5">
        <span
          className="text-[9.5px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: stage.bg, color: stage.color }}
        >
          {stage.label}
        </span>
      </div>

      {/* Mobile · barra compacta + estágio */}
      <div className="sm:hidden col-start-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-[3px] bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${p}%`,
                background: stage.color,
                transition: 'width 1.3s cubic-bezier(0.16,1,0.3,1)',
              }}
            />
          </div>
          <span className="text-[10.5px] tabular-nums font-semibold flex-shrink-0" style={{ color: stage.color }}>
            {score}/{max}
          </span>
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
            style={{ background: stage.bg, color: stage.color }}
          >
            {stage.label}
          </span>
        </div>
        <p className="text-[10.5px] text-zinc-400 leading-[1.5] break-words">{summary}</p>
      </div>
    </div>
  );
}

// ─── RecCard ──────────────────────────────────────────────────────────────────
function RecCard({ rec }: { rec: Recommendation }) {
  const cfg = {
    high: { border: '#ef4444', label: 'Urgente', labelColor: '#dc2626' },
    medium: { border: '#f59e0b', label: 'Importante', labelColor: '#d97706' },
    low: { border: '#22c55e', label: 'Sugestão', labelColor: '#16a34a' },
  }[rec.priority];

  return (
    <motion.div
      variants={fadeUp}
      className="rounded-xl bg-white border border-black/[0.06] p-4 relative overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: cfg.border }} />
      <div className="pl-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: cfg.labelColor }}>
          {cfg.label} · {rec.category}
        </span>
        <p className="text-[13px] text-zinc-700 leading-relaxed mt-1 mb-2">{rec.message}</p>
        <p className="text-[12px] font-medium" style={{ color: ACCENT_DEEP }}>→ {rec.action}</p>
      </div>
    </motion.div>
  );
}

// ─── ActionCard ───────────────────────────────────────────────────────────────
function ActionCard({
  icon, title, desc, label, badge, href, onClick, loading, done,
}: {
  icon: React.ReactNode; title: string; desc: string; label: string;
  badge?: string; href?: string; onClick?: () => void;
  loading?: boolean; done?: boolean;
}) {
  const content = (
    <div className="flex gap-4 items-start">
      <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-semibold text-zinc-900">{title}</p>
          {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-[12px] text-zinc-500 mt-0.5 leading-relaxed">{desc}</p>
        <div className="mt-3">
          <span
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-white text-[12px] font-semibold"
            style={{ background: done ? '#22c55e' : ACCENT_DEEP }}
          >
            {loading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : done
              ? <><CheckCircle className="w-3.5 h-3.5" /> Enviado</>
              : <>{label} {href && <ChevronRight className="w-3.5 h-3.5" />}</>
            }
          </span>
        </div>
      </div>
    </div>
  );

  const cls = "rounded-xl border border-black/[0.07] bg-white p-5 block transition-colors hover:border-slate-200/60";
  const shadow = { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' };

  if (href) {
    return (
      <motion.div variants={fadeUp} style={shadow}>
        <Link href={href} className={cls}>{content}</Link>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeUp} style={shadow}>
      <button onClick={onClick} disabled={loading || done} className={`${cls} w-full text-left disabled:opacity-70`}>
        {content}
      </button>
    </motion.div>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────
function PostCard({ post, onApprove, onReject }: {
  post: Post; onApprove: () => void; onReject: () => void;
}) {
  const plat: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn' };
  return (
    <motion.div variants={fadeUp} className="rounded-xl border border-black/[0.07] bg-white p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded-md" style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}>
        {plat[post.platform] || post.platform}
      </span>
      <p className="text-[13px] text-zinc-700 leading-relaxed line-clamp-3 mt-2.5 mb-2">{post.post_text}</p>
      {post.hashtags?.length > 0 && (
        <p className="text-[11px] text-zinc-400 mb-3">{post.hashtags.slice(0, 4).map(h => `#${h}`).join(' ')}</p>
      )}
      <div className="flex gap-2">
        <button onClick={onApprove} className="flex-1 h-8 rounded-lg text-white text-[12px] font-semibold hover:brightness-110 active:scale-[0.98] transition-all" style={{ background: ACCENT_DEEP }}>
          Aprovar
        </button>
        <button onClick={onReject} className="h-8 px-3 rounded-lg text-zinc-500 text-[12px] font-medium bg-zinc-100 hover:bg-zinc-200 transition-colors active:scale-[0.98]">
          Rejeitar
        </button>
      </div>
    </motion.div>
  );
}

// ─── DeltaBadge & Sparkline ───────────────────────────────────────────────────
function DeltaBadge({ pct, color }: { pct: number | null; color: string }) {
  if (pct == null) return null;
  const positive = pct >= 0;
  const arrow = positive ? '↑' : '↓';
  const abs = Math.abs(pct);
  const display = abs < 1 ? abs.toFixed(1) : Math.round(abs).toString();
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums"
      style={{ background: positive ? '#f0fdf4' : '#fef2f2', color: positive ? '#16a34a' : '#dc2626' }}
      title={`vs mês anterior — ${color}`}
    >
      {arrow} {display}%
    </span>
  );
}

function Sparkline({ points, accentColor }: { points: number[]; accentColor: string }) {
  if (points.length < 2) return null;
  const w = 80, h = 24, p = 2;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const xStep = (w - 2 * p) / (points.length - 1);
  const path = points
    .map((v, i) => {
      const x = p + i * xStep;
      const y = h - p - ((v - min) / range) * (h - 2 * p);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const last = points[points.length - 1];
  const lastX = p + (points.length - 1) * xStep;
  const lastY = h - p - ((last - min) / range) * (h - 2 * p);
  return (
    <svg width={w} height={h} className="inline-block">
      <path d={path} fill="none" stroke={accentColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
      <circle cx={lastX} cy={lastY} r={2} fill={accentColor} />
    </svg>
  );
}

// ─── RegionDemandCard ─────────────────────────────────────────────────────────
function RegionDemandCard({ d, refreshing, onRefresh }: { d: RegionDemand; refreshing: boolean; onRefresh: () => void }) {
  const captureRate = 0.02;
  const onTable = Math.round(d.total_monthly_volume * (1 - captureRate));
  const cpcText = d.avg_cpc != null ? `R$ ${d.avg_cpc.toFixed(2).replace('.', ',')}` : '—';
  const cleanLocation = d.location.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const locationHead = cleanLocation.split(',')[0];

  return (
    <motion.div variants={fadeUp} className="space-y-3">
      <div
        className="rounded-2xl p-6 sm:p-7 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-center"
        style={{
          background: 'linear-gradient(180deg, #fefce8 0%, #ffffff 70%)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
        }}
      >
        <div>
          <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2 flex items-center gap-2" style={{ color: '#b45309' }}>
            <MapPin className="inline w-3 h-3 -mt-0.5" />
            <span>Oportunidade · {cleanLocation}</span>
            {refreshing && (
              <span className="inline-flex items-center gap-1 text-amber-700/70 normal-case tracking-normal text-[10px] font-medium">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                buscando dados reais…
              </span>
            )}
            {!refreshing && d.is_mock && (
              <span className="text-[9px] font-medium normal-case tracking-normal text-amber-700/60">(estimativa preliminar)</span>
            )}
            {!refreshing && !d.is_mock && d.location_disclaimer && (
              <span className="text-[9px] font-medium normal-case tracking-normal text-amber-700/60">({d.location_disclaimer})</span>
            )}
            {!refreshing && !d.is_mock && (
              <button
                type="button"
                onClick={onRefresh}
                className="ml-auto text-[10px] font-medium normal-case tracking-normal text-amber-700/60 hover:text-amber-800"
                aria-label="Atualizar dados de mercado"
              >
                atualizar
              </button>
            )}
          </p>
          <p className="text-[17px] sm:text-[18px] font-medium leading-[1.35] tracking-[-0.015em] text-zinc-900">
            Pacientes buscam <em className="not-italic font-semibold" style={{ color: '#b45309' }}>&ldquo;{d.specialty}{d.location_level === 'country' ? '' : ` ${locationHead}`}&rdquo;</em>{' '}
            <span className="tabular-nums">{d.total_monthly_volume.toLocaleString('pt-BR')}</span> vezes por mês.
            Sua clínica capta menos de {Math.round(captureRate * 100)}% disso hoje.
          </p>
          <p className="text-[12px] text-zinc-500 mt-2">
            Estimativa baseada em volume de buscas Google + sua posição atual nos resultados locais
            {d.avg_cpc != null && ` · CPC médio dos termos: ${cpcText}`}.
          </p>
        </div>
        <div className="flex gap-5 sm:gap-6 flex-shrink-0">
          <div className="text-left sm:text-right">
            <div className="flex items-center sm:justify-end gap-2">
              <p className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums leading-none text-zinc-900">
                {d.total_monthly_volume.toLocaleString('pt-BR')}
              </p>
              <DeltaBadge pct={d.trend?.delta_market_pct ?? null} color="#b45309" />
            </div>
            <div className="flex items-center sm:justify-end gap-1.5 mt-1.5">
              <p className="text-[10px] text-zinc-500 tracking-[0.08em] uppercase">buscas/mês</p>
              {d.trend && d.trend.history_points.length >= 2 && (
                <Sparkline
                  points={d.trend.history_points.map(p => p.total_monthly_volume)}
                  accentColor="#b45309"
                />
              )}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums leading-none" style={{ color: '#b45309' }}>
              ~{onTable.toLocaleString('pt-BR')}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1.5 tracking-[0.08em] uppercase">pacientes na mesa</p>
          </div>
        </div>
      </div>

      {d.name_search && (
        <div
          className="rounded-2xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center"
          style={{
            background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 70%)',
            border: '1px solid rgba(110, 86, 207, 0.18)',
          }}
        >
          <div>
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: ACCENT_DEEP }}>
              Quanto você está sendo buscado pelo nome
            </p>
            <p className="text-[15px] font-medium leading-[1.4] text-zinc-900">
              {d.name_search.total_volume > 0 ? (
                <>
                  Pacientes buscam <em className="not-italic font-semibold" style={{ color: ACCENT_DEEP }}>{d.name_search.doctor_name}</em>{' '}
                  <span className="tabular-nums">{d.name_search.total_volume.toLocaleString('pt-BR')}</span> vezes por mês — você já tem reconhecimento de marca.
                </>
              ) : (
                <>
                  Ainda não há volume mensurável de buscas pelo nome <em className="not-italic font-semibold" style={{ color: ACCENT_DEEP }}>{d.name_search.doctor_name}</em>.
                  Trabalhar reputação e SEO do seu nome é caminho rápido — branding tem tráfego mais barato.
                </>
              )}
            </p>
          </div>
          <div className="text-left sm:text-right flex-shrink-0">
            <div className="flex items-center sm:justify-end gap-2">
              <p className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums leading-none" style={{ color: ACCENT_DEEP }}>
                {d.name_search.total_volume.toLocaleString('pt-BR')}
              </p>
              <DeltaBadge pct={d.trend?.delta_name_pct ?? null} color={ACCENT_DEEP} />
            </div>
            <div className="flex items-center sm:justify-end gap-1.5 mt-1.5">
              <p className="text-[10px] text-zinc-500 tracking-[0.08em] uppercase">buscas pelo nome/mês</p>
              {d.trend && d.trend.history_points.length >= 2 && (
                <Sparkline
                  points={d.trend.history_points.map(p => p.total_name_volume)}
                  accentColor={ACCENT_DEEP}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── ActivationOpportunities ──────────────────────────────────────────────────
//
// Bloco de "alertas inteligentes" close-to-action que combina sinais de várias
// fontes (DFS Trends, score, posts pendentes) pra surpreender o cliente com
// insights quantificados + botão de ativação direto.

interface ActivationAlert {
  icon: React.ReactNode;
  tone: 'urgent' | 'opportunity' | 'info';
  title: string;
  body: React.ReactNode;
  ctaLabel: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
}

function buildActivationAlerts(args: {
  scoreData: ScoreData | null;
  regionDemand: RegionDemand | null;
  marketTrends: MarketTrends | null;
  posts: Post[];
  eligibleReviews: number;
  primaryKeyword?: string;
}): ActivationAlert[] {
  const alerts: ActivationAlert[] = [];

  // Alert 1: Tendência de alta na especialidade — janela de oportunidade
  const specialtyDelta = args.marketTrends?.explore?.delta_90d_pct?.[0];
  if (specialtyDelta != null && specialtyDelta >= 15) {
    alerts.push({
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      tone: 'opportunity',
      title: `Janela de tráfego pago barato — ${specialtyDelta.toFixed(0)}% de alta no trimestre`,
      body: (
        <>
          Buscas por <strong>{args.marketTrends?.primary_keyword?.toLowerCase()}</strong> subiram <strong>{specialtyDelta.toFixed(0)}%</strong> nos últimos 90 dias.
          Próximas 4-6 semanas valem 2-3× ROI vs aguardar — mercado ainda não percebeu, CPC mais baixo.
        </>
      ),
      ctaLabel: 'Conhecer Plano Ads',
      ctaHref: '/painel/marketing/configurar',
    });
  }

  // Alert 2: Doença vs especialidade gap (se trends disponível)
  const explore = args.marketTrends?.explore;
  if (explore?.keywords && explore.avg_90d) {
    const specialtyAvg = explore.avg_90d[0] ?? 0;
    // Encontra a maior keyword correlata (índices 1-3 são doenças correlatas)
    const corrAvgs = explore.avg_90d.slice(1, 4);
    const maxCorr = Math.max(...corrAvgs);
    const maxCorrIdx = corrAvgs.indexOf(maxCorr) + 1;
    const maxCorrKw = explore.keywords[maxCorrIdx];

    if (specialtyAvg > 0 && maxCorr > specialtyAvg * 3) {
      const ratio = Math.round(maxCorr / specialtyAvg);
      alerts.push({
        icon: <Target className="w-3.5 h-3.5" />,
        tone: 'opportunity',
        title: `Estratégia de conteúdo: paciente busca doença, não especialidade`,
        body: (
          <>
            Pessoas buscam <strong>&ldquo;{maxCorrKw}&rdquo;</strong> <strong>{ratio}× mais</strong> que &ldquo;{args.marketTrends?.primary_keyword?.toLowerCase()}&rdquo;.
            Capturar essa intenção via conteúdo educativo dispara conversões para consulta.
            {args.posts.length > 0 && <> <strong>{args.posts.length} posts gerados pela IA</strong> aguardam aprovação.</>}
          </>
        ),
        ctaLabel: args.posts.length > 0 ? `Revisar ${args.posts.length} posts` : 'Configurar conteúdo',
        ctaHref: '#posts-section',
      });
    }
  }

  // Alert 3: Brand awareness baseline = 0 (último item do explore.keywords é o nome)
  const lastKw = explore?.keywords?.[explore.keywords.length - 1];
  const lastAvg = explore?.avg_90d?.[explore.avg_90d.length - 1] ?? 0;
  if (lastKw && lastAvg === 0 && lastKw.length >= 6 && !lastKw.includes(' ')) {
    // só se for nome próprio (uma palavra, ≥6 chars) e zero buscas
  } else if (lastKw && lastAvg === 0) {
    alerts.push({
      icon: <Sparkles className="w-3.5 h-3.5" />,
      tone: 'info',
      title: 'Marca pessoal sem awareness mensurável',
      body: (
        <>
          Seu nome <strong>ainda não é buscado no Google</strong> em volume mensurável.
          Cada review e post sobe esse número — meta de 90 dias: 100 buscas/mês pelo nome → CPL de ads cai ~30%.
        </>
      ),
      ctaLabel: 'Conhecer Plano Social',
      ctaHref: '/painel/marketing/configurar',
    });
  }

  // Alert 4: Gap de reviews (Google = 0)
  const googleReviews = args.scoreData?.pilares?.google?.reviews ?? 0;
  if (googleReviews < 5 && args.eligibleReviews > 0) {
    alerts.push({
      icon: <Star className="w-3.5 h-3.5" />,
      tone: 'urgent',
      title: `${args.eligibleReviews} pacientes elegíveis pra pedido de review automático`,
      body: (
        <>
          Você tem <strong>{googleReviews} reviews no Google</strong> e <strong>{args.eligibleReviews} pacientes com NPS ≥ 9</strong> esperando.
          Cada review sobe seu Score Singulare ~2 pontos e melhora ranking local. Custo: zero.
        </>
      ),
      ctaLabel: 'Ativar pedidos de review',
      ctaHref: '#review-section',
    });
  }

  // Alert 5: Demografia surpreende (se disponível)
  const demo = args.marketTrends?.demography?.[0];
  if (demo?.age) {
    const youngerShare = (demo.age['18-24'] ?? 0) + (demo.age['25-34'] ?? 0);
    if (youngerShare > 50) {
      alerts.push({
        icon: <Users className="w-3.5 h-3.5" />,
        tone: 'info',
        title: 'Audiência mais jovem do que você imagina',
        body: (
          <>
            <strong>{Math.round(youngerShare)}%</strong> das pessoas que buscam sua especialidade têm 18-34 anos
            ({demo.gender.female > 50 ? `${Math.round(demo.gender.female)}% mulheres` : 'gênero balanceado'}).
            Conteúdo precisa falar com esse perfil — primeira pessoa, jornada do paciente, tom emocional.
          </>
        ),
        ctaLabel: 'Ver detalhes',
        ctaHref: '#trends-section',
      });
    }
  }

  return alerts;
}

function ActivationOpportunitiesCard({ alerts }: { alerts: ActivationAlert[] }) {
  if (alerts.length === 0) return null;

  const toneColors = {
    urgent: { bg: '#fef2f2', border: 'rgba(239,68,68,0.25)', accent: '#dc2626', label: 'Urgente' },
    opportunity: { bg: '#f5f3ff', border: 'rgba(110,86,207,0.25)', accent: ACCENT_DEEP, label: 'Oportunidade' },
    info: { bg: '#fefce8', border: 'rgba(245,158,11,0.25)', accent: '#b45309', label: 'Insight' },
  };

  return (
    <motion.div variants={fadeUp}>
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5" style={{ color: ACCENT }} />
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold" style={{ color: ACCENT }}>
          Oportunidades de ativação
        </p>
        <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full" style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}>
          {alerts.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {alerts.map((a, i) => {
          const c = toneColors[a.tone];
          return (
            <div
              key={i}
              className="rounded-xl p-4 relative overflow-hidden"
              style={{ background: c.bg, border: `1px solid ${c.border}` }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md" style={{ background: c.accent, color: 'white' }}>
                  {a.icon}
                </span>
                <span className="text-[9px] font-bold tracking-[0.1em] uppercase" style={{ color: c.accent }}>
                  {c.label}
                </span>
              </div>
              <p className="text-[13px] font-semibold leading-tight text-zinc-900 mb-1.5">{a.title}</p>
              <p className="text-[12px] text-zinc-600 leading-relaxed mb-3">{a.body}</p>
              {a.ctaHref ? (
                <Link
                  href={a.ctaHref}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold transition-colors hover:underline"
                  style={{ color: c.accent }}
                >
                  {a.ctaLabel} <ChevronRight className="w-3 h-3" />
                </Link>
              ) : (
                <button
                  onClick={a.ctaOnClick}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold transition-colors hover:underline"
                  style={{ color: c.accent }}
                >
                  {a.ctaLabel} <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Competitors ──────────────────────────────────────────────────────────────
function CompetitorsCard({ d, refreshing, onRefresh }: { d: Competitors; refreshing: boolean; onRefresh: () => void }) {
  const stats = d.market_stats;
  const hasSelf = d.competitors.some(c => c.is_self);
  const top5 = d.competitors.slice(0, 5);
  const peerLine = stats.avg_reviews != null && stats.median_reviews != null
    ? `Mediana ${stats.median_reviews} reviews · média ${stats.avg_reviews}`
    : 'Sem dados de competidores ainda';

  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
      <div className="px-5 pt-4 pb-3 border-b border-black/[0.05] flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400">Competidores · {d.location_label}</p>
          <p className="text-[12px] text-zinc-500 mt-0.5">{peerLine}</p>
        </div>
        <div className="flex items-center gap-2">
          {refreshing ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              atualizando
            </span>
          ) : (
            <button type="button" onClick={onRefresh} className="text-[10px] text-zinc-400 hover:text-zinc-700 transition-colors">
              atualizar
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-black/[0.04]">
        <div className="p-4">
          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-400 mb-1">Total no raio</p>
          <p className="text-[20px] tabular-nums font-semibold">{stats.total_competitors}</p>
        </div>
        <div className="p-4">
          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-400 mb-1">Top reviews</p>
          <p className="text-[20px] tabular-nums font-semibold">{stats.top_reviews ?? '—'}</p>
        </div>
        <div className="p-4">
          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-400 mb-1">Sua posição</p>
          <p className="text-[20px] tabular-nums font-semibold" style={{ color: ACCENT }}>
            {hasSelf && stats.self_position_by_reviews ? `#${stats.self_position_by_reviews}` : '—'}
          </p>
          {stats.self_percentile_by_reviews != null && (
            <p className="text-[10px] text-zinc-500">percentil {stats.self_percentile_by_reviews}</p>
          )}
        </div>
      </div>
      {top5.length > 0 && (
        <div className="px-5 py-3 border-t border-black/[0.05]">
          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-400 mb-2">Top 5 por reviews</p>
          <div className="space-y-1.5">
            {top5.map((c, i) => (
              <div key={c.place_id} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="flex items-center gap-2 truncate">
                  <span className="text-zinc-400 tabular-nums w-4">{i + 1}.</span>
                  <span className={`truncate ${c.is_self ? 'font-semibold text-[#0F1B33]' : 'text-zinc-700'}`}>
                    {c.name} {c.is_self && <span className="ml-1 text-[10px] uppercase">você</span>}
                  </span>
                </span>
                <span className="flex items-center gap-2 tabular-nums text-[11px] text-zinc-500 flex-shrink-0">
                  {c.rating != null && <span>★ {c.rating.toFixed(1)}</span>}
                  <span>{c.reviews}</span>
                  {c.distance_km != null && <span>{c.distance_km.toFixed(1)}km</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── GBP Insights ─────────────────────────────────────────────────────────────
function GbpInsightsCard({ d, refreshing, onRefresh }: { d: GbpInsights; refreshing: boolean; onRefresh: () => void }) {
  const t = d.totals;
  const trend = d.trend;
  const formatNum = (n: number) => n.toLocaleString('pt-BR');
  const period = `${d.period_start} → ${d.period_end}`;
  const stats: Array<{ label: string; value: number; delta: number | null; accent?: string }> = [
    { label: 'Buscas no Google', value: t.impressions_search, delta: null },
    { label: 'Visualizações no Maps', value: t.impressions_maps, delta: null },
    { label: 'Cliques pra ligar', value: t.call_clicks, delta: trend?.delta_calls_pct ?? null, accent: ACCENT },
    { label: 'Pediu rota', value: t.direction_requests, delta: null },
    { label: 'Cliques no site', value: t.website_clicks, delta: null },
    { label: 'Mensagens', value: t.conversations, delta: null },
  ];

  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
      <div className="px-5 pt-4 pb-3 border-b border-black/[0.05] flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400">Performance no Google · Meu Negócio</p>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            {d.location_name} · {period} {d.is_mock && <span className="text-amber-700/70">(estimativa — conecte sua conta)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {refreshing ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              atualizando
            </span>
          ) : (
            <button
              type="button"
              onClick={onRefresh}
              className="text-[10px] text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              atualizar
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-black/[0.04]">
        {stats.map((s, i) => (
          <div key={i} className="p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-400 mb-1">{s.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[20px] tabular-nums font-semibold" style={{ color: s.accent || '#18181b' }}>{formatNum(s.value)}</span>
              {s.delta != null && <DeltaBadge pct={s.delta} color={s.accent || ACCENT} />}
            </div>
          </div>
        ))}
      </div>
      {trend?.history_points && trend.history_points.length > 1 && (
        <div className="px-5 py-3 border-t border-black/[0.05]">
          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-400 mb-2">Histórico mensal · {trend.history_points.length} coletas</p>
          <div className="flex items-end gap-1 h-12">
            {trend.history_points.map((p, i) => {
              const max = Math.max(...trend.history_points.map(x => x.impressions_total)) || 1;
              const h = (p.impressions_total / max) * 100;
              return <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: ACCENT_SOFT, borderTop: `2px solid ${ACCENT}` }} title={`${p.collected_at}: ${formatNum(p.impressions_total)}`} />;
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── MarketTrends ─────────────────────────────────────────────────────────────
interface MarketTrends {
  is_mock: boolean;
  is_cached?: boolean;
  location: string;
  primary_keyword: string;
  explore: {
    keywords: string[];
    series: Array<{ date_from: string; values: number[] }>;
    current: number[];
    peak: number[];
    avg_90d: number[];
    prev_90d: number[];
    delta_90d_pct: (number | null)[];
  };
  subregion: Array<{ keyword: string; regions: Array<{ name: string; value: number }> }>;
  demography: Array<{ keyword: string; age: Record<string, number>; gender: { female: number; male: number } }>;
}

function TrendBar({ label, value, peak, delta, color, size = 'md' }: { label: string; value: number; peak: number; delta: number | null; color: string; size?: 'sm' | 'md' }) {
  const pct = peak > 0 ? Math.round((value / peak) * 100) : 0;
  const fontSize = size === 'sm' ? 'text-[12px]' : 'text-[13px]';
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className={`${fontSize} font-medium text-zinc-800 truncate`}>{label}</span>
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[12px] tabular-nums font-semibold" style={{ color }}>{value}</span>
          <span className="text-[10px] text-zinc-300">/{peak}</span>
          <DeltaBadge pct={delta} color={color} />
        </span>
      </div>
      <div className="h-[3px] bg-zinc-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 1s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
    </div>
  );
}

function MarketTrendsCard({ d }: { d: MarketTrends }) {
  const explore = d.explore;
  const subregion = d.subregion?.[0];
  const demography = d.demography?.[0];

  const ageOrder = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
  const ageEntries = ageOrder.filter(k => demography?.age?.[k] != null).map(k => ({ k, v: demography!.age[k] }));
  const ageMax = Math.max(1, ...ageEntries.map(e => e.v));

  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
      <div className="px-5 pt-4 pb-3 border-b border-black/[0.05]">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400">Inteligência de Mercado · Brasil</p>
        <p className="text-[12px] text-zinc-500 mt-0.5">
          Tendência de interesse, distribuição regional e demografia — fonte clickstream DataForSEO {d.is_mock && <span className="text-amber-700/70">(estimativa)</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-black/[0.05]">
        {/* Bloco 1 — Comparação de tendências */}
        <div className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400 mb-3">Comparação de busca · 90d vs 90d anterior</p>
          {explore.keywords.map((kw, i) => (
            <TrendBar
              key={kw}
              label={kw}
              value={Math.round(explore.avg_90d[i] ?? 0)}
              peak={Math.max(1, ...explore.peak)}
              delta={explore.delta_90d_pct[i]}
              color={i === 0 ? ACCENT_DEEP : '#71717a'}
            />
          ))}
          <p className="text-[10px] text-zinc-400 mt-3 leading-relaxed">
            Escala 0–100 normalizada. Valor = média dos últimos 90d. Termo destacado é sua especialidade.
          </p>
        </div>

        {/* Bloco 2 — Onde está a demanda */}
        <div className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400 mb-3">
            <MapPin className="inline w-3 h-3 mr-1 -mt-0.5" />
            Top regiões · {subregion?.keyword ?? d.primary_keyword}
          </p>
          {subregion?.regions?.length ? (
            <div className="space-y-1.5">
              {subregion.regions.slice(0, 6).map((r, i) => (
                <TrendBar
                  key={r.name}
                  label={r.name}
                  value={r.value}
                  peak={subregion.regions[0].value}
                  delta={null}
                  color={i === 0 ? ACCENT : '#a1a1aa'}
                  size="sm"
                />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-zinc-400">Sem dados regionais disponíveis</p>
          )}
          <p className="text-[10px] text-zinc-400 mt-3 leading-relaxed">
            Onde sua especialidade tem mais buscas no BR. Útil pra estratégia de expansão e tráfego pago geo-segmentado.
          </p>
        </div>

        {/* Bloco 3 — Demografia */}
        <div className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400 mb-3">Quem busca</p>

          {demography ? (
            <>
              <div className="mb-4">
                <p className="text-[10px] text-zinc-400 mb-2">Gênero</p>
                <div className="flex h-6 rounded-md overflow-hidden border border-black/[0.06]">
                  <div
                    className="flex items-center justify-center text-[10px] font-semibold text-white"
                    style={{ width: `${demography.gender.female}%`, background: ACCENT_DEEP }}
                  >
                    {demography.gender.female > 12 && `♀ ${Math.round(demography.gender.female)}%`}
                  </div>
                  <div
                    className="flex items-center justify-center text-[10px] font-semibold text-zinc-700"
                    style={{ width: `${demography.gender.male}%`, background: '#e4e4e7' }}
                  >
                    {demography.gender.male > 12 && `♂ ${Math.round(demography.gender.male)}%`}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-zinc-400 mb-2">Faixa etária</p>
                <div className="space-y-1">
                  {ageEntries.map(({ k, v }) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-[10px] tabular-nums text-zinc-500 w-10">{k}</span>
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(v / ageMax) * 100}%`, background: ACCENT, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                      </div>
                      <span className="text-[10px] tabular-nums font-medium text-zinc-700 w-8 text-right">{Math.round(v)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-[12px] text-zinc-400">Sem dados demográficos</p>
          )}

          <p className="text-[10px] text-zinc-400 mt-4 leading-relaxed">
            Perfil de quem busca sua especialidade. Use pra segmentar criativos e copy de campanhas.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── DadosCompletos ───────────────────────────────────────────────────────────
function DadosCompletos({ d }: { d: ScoreData }) {
  const [open, setOpen] = useState(false);
  const p = d.pilares;

  const sections = [
    {
      label: 'Google',
      items: [
        { label: 'Nota', value: p.google.rating ? `${p.google.rating}★` : '—' },
        { label: 'Avaliações', value: p.google.reviews ?? 0 },
        { label: 'Verificado', value: p.google.verified ? 'Sim' : 'Não' },
        { label: 'Horários', value: p.google.has_hours ? 'Sim' : 'Não' },
        { label: 'Fotos', value: p.google.photos_count ?? 0 },
        { label: 'Top 10 busca', value: p.google.top10 ? 'Sim' : 'Não' },
        { label: 'Posição', value: p.google.position ?? '—' },
        { label: 'Knowledge Panel', value: p.google.knowledge_panel ? 'Sim' : 'Não' },
      ],
    },
    {
      label: 'Doctoralia',
      items: [
        { label: 'Presente', value: p.doctoralia.present ? 'Sim' : 'Não' },
        { label: 'Nota', value: p.doctoralia.rating ? `${p.doctoralia.rating}★` : '—' },
        { label: 'Opiniões', value: p.doctoralia.reviews ?? 0 },
        { label: 'Agendamento online', value: p.doctoralia.online_booking ? 'Sim' : 'Não' },
      ],
    },
    {
      label: 'Redes Sociais',
      items: [
        { label: 'Seguidores IG', value: p.social.ig_followers ?? 0 },
        { label: 'Posts (30d)', value: p.social.ig_posts_30d ?? 0 },
        { label: 'Engajamento', value: p.social.ig_engagement ? `${Number(p.social.ig_engagement).toFixed(2)}%` : '—' },
        { label: 'Link na bio', value: p.social.ig_has_link ? 'Sim' : 'Não' },
        { label: 'Fãs Facebook', value: p.social.fb_fans ?? 0 },
        { label: 'Posts FB (30d)', value: p.social.fb_posts_30d ?? 0 },
      ],
    },
    {
      label: 'SEO & Site',
      items: [
        { label: 'Tem site', value: p.seo.website_exists ? 'Sim' : 'Não' },
        { label: 'HTTPS', value: p.seo.website_ssl ? 'Sim' : 'Não' },
        { label: 'Score mobile', value: p.seo.mobile_score ?? 0 },
        { label: 'Performance', value: p.seo.performance ?? 0 },
        { label: 'Top 10 Google', value: p.seo.top10 ? 'Sim' : 'Não' },
      ],
    },
    {
      label: 'Operacional',
      items: [
        { label: 'NPS médio', value: p.operational.avg_nps != null ? Number(p.operational.avg_nps).toFixed(1) : '—' },
        { label: 'Conv. agendamentos', value: p.operational.booking_rate != null ? `${Math.round(Number(p.operational.booking_rate) * 100)}%` : '—' },
        { label: 'No-show', value: p.operational.noshow_rate != null ? `${Math.round(Number(p.operational.noshow_rate) * 100)}%` : '—' },
        { label: 'Taxa retorno', value: p.operational.recurrence_rate != null ? `${Math.round(Number(p.operational.recurrence_rate) * 100)}%` : '—' },
        { label: 'Resp. média (min)', value: p.operational.avg_response_minutes != null ? Math.round(Number(p.operational.avg_response_minutes)) : '—' },
      ],
    },
  ];

  return (
    <div className="rounded-xl border border-black/[0.07] overflow-hidden bg-white" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left"
      >
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">Dados completos da coleta</span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-black/[0.05] bg-zinc-50/60 p-5 space-y-5">
              {sections.map(sec => (
                <div key={sec.label}>
                  <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-400 mb-2">{sec.label}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {sec.items.map(item => (
                      <div key={item.label} className="bg-white rounded-lg border border-black/[0.05] px-3 py-2">
                        <p className="text-[10px] text-zinc-400 mb-0.5">{item.label}</p>
                        <p className="text-[13px] font-semibold text-zinc-800">{String(item.value ?? '—')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-zinc-400">
                Coletado em {new Date(d.collected_at).toLocaleString('pt-BR')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function MarketingInner() {
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [eligibleReviews, setEligibleReviews] = useState(0);
  const [regionDemand, setRegionDemand] = useState<RegionDemand | null>(null);
  const [regionRefreshing, setRegionRefreshing] = useState(false);
  const [marketTrends, setMarketTrends] = useState<MarketTrends | null>(null);
  const [gbpInsights, setGbpInsights] = useState<GbpInsights | null>(null);
  const [gbpRefreshing, setGbpRefreshing] = useState(false);
  const [competitors, setCompetitors] = useState<Competitors | null>(null);
  const [competitorsRefreshing, setCompetitorsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, pRes, rRes, dRes, tRes, gRes, cRes] = await Promise.all([
        fetch('/api/painel/marketing/score'),
        fetch('/api/painel/marketing/posts?status=pending_approval&limit=6'),
        fetch('/api/painel/marketing/reviews'),
        fetch('/api/painel/marketing/region-demand'),
        fetch('/api/painel/marketing/market-trends'),
        fetch('/api/painel/marketing/gbp-insights'),
        fetch('/api/painel/marketing/competitors'),
      ]);
      if (sRes.ok) { const d = await sRes.json(); setScoreData(d.current); setRecs(d.recommendations || []); }
      if (pRes.ok) { const d = await pRes.json(); setPosts(d.posts || []); }
      if (rRes.ok) { const d = await rRes.json(); setEligibleReviews(d.eligible || 0); }
      if (dRes.ok) {
        const d = await dRes.json();
        if (d.success) {
          setRegionDemand(d);
          if (!d.is_cached) {
            setRegionRefreshing(true);
            fetch('/api/painel/marketing/region-demand-refresh', { method: 'POST' })
              .then(r => r.ok ? r.json() : null)
              .then(j => { if (j?.payload) setRegionDemand(j.payload); })
              .catch(() => {})
              .finally(() => setRegionRefreshing(false));
          }
        }
      }
      if (tRes.ok) {
        const t = await tRes.json();
        if (t.primary_keyword) setMarketTrends(t);
      }
      if (gRes.ok) {
        const g = await gRes.json();
        if (g?.location_name) {
          setGbpInsights(g);
          if (!g.is_cached && !g.is_mock) {
            setGbpRefreshing(true);
            fetch('/api/painel/marketing/gbp-insights-refresh', { method: 'POST' })
              .then(r => r.ok ? r.json() : null)
              .then(j => { if (j?.payload) setGbpInsights(j.payload); })
              .catch(() => {})
              .finally(() => setGbpRefreshing(false));
          }
        }
      }
      if (cRes.ok) {
        const c = await cRes.json();
        if (c?.search_query) {
          setCompetitors(c);
          if (!c.is_cached) {
            setCompetitorsRefreshing(true);
            fetch('/api/painel/marketing/competitors-refresh', { method: 'POST' })
              .then(r => r.ok ? r.json() : null)
              .then(j => { if (j?.payload) setCompetitors(j.payload); })
              .catch(() => {})
              .finally(() => setCompetitorsRefreshing(false));
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRegionDemand = useCallback(async () => {
    setRegionRefreshing(true);
    try {
      const r = await fetch('/api/painel/marketing/region-demand-refresh', { method: 'POST' });
      if (r.ok) {
        const j = await r.json();
        if (j?.payload) setRegionDemand(j.payload);
      }
    } finally {
      setRegionRefreshing(false);
    }
  }, []);

  const refreshGbpInsights = useCallback(async () => {
    setGbpRefreshing(true);
    try {
      const r = await fetch('/api/painel/marketing/gbp-insights-refresh', { method: 'POST' });
      if (r.ok) {
        const j = await r.json();
        if (j?.payload) setGbpInsights(j.payload);
      }
    } finally {
      setGbpRefreshing(false);
    }
  }, []);

  const refreshCompetitors = useCallback(async () => {
    setCompetitorsRefreshing(true);
    try {
      const r = await fetch('/api/painel/marketing/competitors-refresh', { method: 'POST' });
      if (r.ok) {
        const j = await r.json();
        if (j?.payload) setCompetitors(j.payload);
      }
    } finally {
      setCompetitorsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const approve = async (id: number) => {
    await fetch(`/api/painel/marketing/posts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve' }) });
    fetchData();
  };
  const reject = async (id: number) => {
    await fetch(`/api/painel/marketing/posts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject' }) });
    fetchData();
  };
  const requestReviews = async () => {
    setReviewLoading(true);
    try { await fetch('/api/painel/marketing/reviews', { method: 'POST' }); setReviewDone(true); }
    catch (e) { console.error(e); }
    finally { setReviewLoading(false); }
  };

  const p = scoreData?.pilares;
  const sortedRecs = [...recs].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));

  return (
    <motion.div className="space-y-7" variants={stagger} initial="hidden" animate="show">

      {/* Header */}
      <motion.div variants={fadeUp}>
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-2" style={{ color: ACCENT }}>
          Marketing Digital
        </p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            Presença Digital
          </h1>
          {scoreData?.score_change !== undefined && scoreData.score_change !== 0 && (
            <span className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 ${scoreData.score_change > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {scoreData.score_change > 0 ? '↑' : '↓'} {Math.abs(scoreData.score_change)} pts
            </span>
          )}
        </div>
        {scoreData?.collected_at && (
          <p className="text-[13px] text-zinc-400 mt-1">
            Score atualizado em {new Date(scoreData.collected_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
          </p>
        )}
      </motion.div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-zinc-300 animate-spin" />
        </div>
      )}

      {!loading && !scoreData && (
        <motion.div variants={fadeUp} className="rounded-2xl border border-dashed border-black/[0.10] p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-4" style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}>
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-[15px] font-semibold text-zinc-900 mb-1.5">Score sendo calculado</p>
          <p className="text-[13px] text-zinc-500 max-w-sm mx-auto leading-relaxed">
            A Singulare está mapeando seu Google, Doctoralia, redes sociais e site.
            O score aparece na próxima segunda-feira.
          </p>
        </motion.div>
      )}

      {!loading && scoreData && (
        <>
          {/* Bloco 1 — Reputação digital */}
          <motion.div
            variants={fadeUp}
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 58%)',
              border: '1px solid rgba(110, 86, 207, 0.16)',
              boxShadow: '0 1px 8px rgba(110, 86, 207, 0.05)',
            }}
          >
            {/* Topo · eyebrow + anel + diagnóstico narrativo */}
            <div className="px-5 sm:px-7 pt-4 pb-5">
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: ACCENT_DEEP }}>
                Reputação digital
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-[148px_1fr] gap-3 sm:gap-6 items-center">
                <div className="flex items-center justify-center sm:justify-start">
                  <ScoreRing score={scoreData.total_score} />
                </div>
                <div>
                  <p className="text-[15px] sm:text-[17px] leading-[1.5] tracking-[-0.012em] text-zinc-700">
                    {buildNarrative(scoreData)}
                  </p>
                  {scoreData.score_change !== undefined && scoreData.score_change !== 0 && (
                    <p className="text-[12px] text-zinc-400 mt-3 tabular-nums">
                      {scoreData.score_change > 0 ? '+' : ''}{scoreData.score_change} pontos vs. semana anterior
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de atributos · cinco conceitos de reputação */}
            <div className="bg-white border-t border-black/[0.06]">
              <div className="px-5 sm:px-6 pt-4 pb-1 flex items-baseline justify-between">
                <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400">
                  Atributos de reputação
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] font-medium text-zinc-300 hidden sm:block">
                  cinco capitais que compõem o score
                </p>
              </div>
              <AtributoRow index={1} name={PILLAR_CONCEPTS.google.name}      subtitle={PILLAR_CONCEPTS.google.subtitle}      score={p!.google.score}      max={30} summary={googleSummary(p!.google)} />
              <AtributoRow index={2} name={PILLAR_CONCEPTS.doctoralia.name}  subtitle={PILLAR_CONCEPTS.doctoralia.subtitle}  score={p!.doctoralia.score}  max={15} summary={doctoraliaSummary(p!.doctoralia)} />
              <AtributoRow index={3} name={PILLAR_CONCEPTS.social.name}      subtitle={PILLAR_CONCEPTS.social.subtitle}      score={p!.social.score}      max={20} summary={socialSummary(p!.social)} />
              <AtributoRow index={4} name={PILLAR_CONCEPTS.seo.name}         subtitle={PILLAR_CONCEPTS.seo.subtitle}         score={p!.seo.score}         max={20} summary={seoSummary(p!.seo)} />
              <AtributoRow index={5} name={PILLAR_CONCEPTS.operational.name} subtitle={PILLAR_CONCEPTS.operational.subtitle} score={p!.operational.score} max={15} summary={operationalSummary(p!.operational)} />
            </div>
          </motion.div>

          {/* Bloco 1.5 — Oportunidades de ativação (insights close-to-action) */}
          <ActivationOpportunitiesCard
            alerts={buildActivationAlerts({
              scoreData,
              regionDemand,
              marketTrends,
              posts,
              eligibleReviews,
            })}
          />

          {/* Bloco 2 — O que está te travando */}
          {sortedRecs.length > 0 && (
            <motion.div variants={fadeUp}>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400 mb-3">O que está te travando</p>
              <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-3" variants={stagger} initial="hidden" animate="show">
                {sortedRecs.map((r, i) => <RecCard key={i} rec={r} />)}
              </motion.div>
            </motion.div>
          )}

          {/* Bloco 3 — Oportunidade na região */}
          {regionDemand && (
            <RegionDemandCard d={regionDemand} refreshing={regionRefreshing} onRefresh={refreshRegionDemand} />
          )}

          {/* Bloco 3a — Performance no Google Meu Negócio */}
          {gbpInsights && (
            <GbpInsightsCard d={gbpInsights} refreshing={gbpRefreshing} onRefresh={refreshGbpInsights} />
          )}

          {/* Bloco 3a2 — Competidores próximos */}
          {competitors && (
            <CompetitorsCard d={competitors} refreshing={competitorsRefreshing} onRefresh={refreshCompetitors} />
          )}

          {/* Bloco 3b — Inteligência de Mercado (Trends) */}
          {marketTrends && (
            <MarketTrendsCard d={marketTrends} />
          )}

          {/* Bloco 4 — Ativar agora */}
          <motion.div variants={fadeUp}>
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400 mb-3">Ativar agora</p>
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-3" variants={stagger} initial="hidden" animate="show">

              <ActionCard
                icon={<Star className="w-4 h-4" />}
                title="Solicitar avaliações no Google"
                desc="Envia mensagem automática via WhatsApp para pacientes com NPS 9 ou 10 pedindo review no Google."
                label="Enviar solicitações"
                badge={eligibleReviews > 0 ? `${eligibleReviews} elegíveis` : undefined}
                onClick={requestReviews}
                loading={reviewLoading}
                done={reviewDone}
              />

              <ActionCard
                icon={<Megaphone className="w-4 h-4" />}
                title="Tráfego pago gerenciado"
                desc="Campanhas no Google e Instagram configuradas pela Singulare. A partir de R$ 300/mês."
                label="Ativar campanha"
                href="/painel/marketing/configurar"
              />

              {!p!.seo.website_exists && (
                <ActionCard
                  icon={<Globe className="w-4 h-4" />}
                  title="Gerar site profissional"
                  desc="Sem site próprio você perde posição no Google. Crie sua página com agendamento online em minutos."
                  label="Criar meu site"
                  badge="Recomendado"
                  href="/painel/marketing/site"
                />
              )}

              {posts.length > 0 && (
                <ActionCard
                  icon={<Layout className="w-4 h-4" />}
                  title="Posts gerados pela IA"
                  desc={`${posts.length} post${posts.length > 1 ? 's' : ''} prontos para publicar nas suas redes sociais.`}
                  label="Revisar posts"
                  badge={`${posts.length} pendentes`}
                  onClick={() => document.getElementById('posts-section')?.scrollIntoView({ behavior: 'smooth' })}
                />
              )}

              {!p!.doctoralia.present && (
                <ActionCard
                  icon={<ExternalLink className="w-4 h-4" />}
                  title="Criar perfil na Doctoralia"
                  desc="Plataforma com milhões de buscas de pacientes por mês. Cadastro gratuito."
                  label="Criar perfil"
                  href="https://www.doctoralia.com.br"
                />
              )}

              <ActionCard
                icon={<Settings className="w-4 h-4" />}
                title="Configurar URL de avaliação"
                desc="Configure o link do Google Review para envio automático após consultas com NPS alto."
                label="Configurar"
                href="/painel/marketing/configurar"
              />

            </motion.div>
          </motion.div>

          {/* Bloco 4 — Posts pendentes */}
          {posts.length > 0 && (
            <motion.div variants={fadeUp} id="posts-section">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400">Posts para aprovação</p>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}>
                  {posts.length}
                </span>
              </div>
              <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" variants={stagger} initial="hidden" animate="show">
                {posts.map(post => (
                  <PostCard key={post.id} post={post} onApprove={() => approve(post.id)} onReject={() => reject(post.id)} />
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Bloco 5 — Dados completos */}
          <motion.div variants={fadeUp}>
            <DadosCompletos d={scoreData} />
          </motion.div>
        </>
      )}
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
