'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, TrendingUp, ChevronRight, ChevronDown,
  Sparkles, Star, Globe, MessageSquare, Megaphone,
  CheckCircle, Layout, Settings, ExternalLink, MapPin,
} from 'lucide-react';
import Link from 'next/link';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
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
}

// ─── Animations ───────────────────────────────────────────────────────────────
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(score: number, max: number) { return Math.round((score / max) * 100); }
function barColor(p: number) {
  return p >= 70 ? '#22c55e' : p >= 40 ? '#f59e0b' : '#ef4444';
}

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

// ─── ScoreRing ─────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const size = 152;
  const sw = 8;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score <= 25 ? '#ef4444' : score <= 50 ? '#f59e0b' : score <= 75 ? '#22c55e' : ACCENT;
  const label = score <= 25 ? 'Crítico' : score <= 50 ? 'Desenvolvendo' : score <= 75 ? 'Bom' : 'Excelente';
  const labelBg = score <= 25 ? '#fef2f2' : score <= 50 ? '#fffbeb' : score <= 75 ? '#f0fdf4' : ACCENT_SOFT;

  return (
    <div className="flex flex-col items-center gap-3">
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
          <span className="text-[48px] font-semibold tracking-[-0.04em] leading-none" style={{ color }}>{score}</span>
          <span className="text-[11px] text-zinc-400 mt-1">/ 100</span>
        </div>
      </div>
      <span className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: labelBg, color }}>{label}</span>
    </div>
  );
}

// ─── PilarRow ─────────────────────────────────────────────────────────────────
function PilarRow({ name, score, max, summary }: {
  name: string; score: number; max: number; summary: string;
}) {
  const p = pct(score, max);
  const color = barColor(p);
  return (
    <div className="py-3 border-t border-black/[0.05] first:border-t-0">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-[13px] font-medium text-zinc-800">{name}</span>
        </div>
        <span className="text-[12px] tabular-nums font-semibold" style={{ color }}>
          {score}<span className="text-zinc-300 font-normal">/{max}</span>
        </span>
      </div>
      <div className="h-px bg-zinc-100 rounded-full overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full"
          style={{ width: `${p}%`, background: color, transition: 'width 1.3s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </div>
      <p className="text-[11px] text-zinc-400 leading-relaxed">{summary}</p>
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

  const cls = "rounded-xl border border-black/[0.07] bg-white p-5 block transition-colors hover:border-violet-200/60";
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

// ─── RegionDemandCard ─────────────────────────────────────────────────────────
function RegionDemandCard({ d }: { d: RegionDemand }) {
  const captureRate = 0.02;
  const onTable = Math.round(d.total_monthly_volume * (1 - captureRate));
  const cpcText = d.avg_cpc != null ? `R$ ${d.avg_cpc.toFixed(2).replace('.', ',')}` : '—';

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
          <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: '#b45309' }}>
            <MapPin className="inline w-3 h-3 mr-1.5 -mt-0.5" />
            Oportunidade · {d.location}
            {d.is_mock && <span className="ml-2 text-[9px] font-medium normal-case tracking-normal text-amber-700/60">(estimativa preliminar)</span>}
          </p>
          <p className="text-[17px] sm:text-[18px] font-medium leading-[1.35] tracking-[-0.015em] text-zinc-900">
            Pacientes buscam <em className="not-italic font-semibold" style={{ color: '#b45309' }}>&ldquo;{d.specialty} {d.location.split(',')[0]}&rdquo;</em>{' '}
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
            <p className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums leading-none text-zinc-900">
              {d.total_monthly_volume.toLocaleString('pt-BR')}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1.5 tracking-[0.08em] uppercase">buscas/mês</p>
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
            <p className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums leading-none" style={{ color: ACCENT_DEEP }}>
              {d.name_search.total_volume.toLocaleString('pt-BR')}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1.5 tracking-[0.08em] uppercase">buscas pelo nome/mês</p>
          </div>
        </div>
      )}
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
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, pRes, rRes, dRes] = await Promise.all([
        fetch('/api/painel/marketing/score'),
        fetch('/api/painel/marketing/posts?status=pending_approval&limit=6'),
        fetch('/api/painel/marketing/reviews'),
        fetch('/api/painel/marketing/region-demand'),
      ]);
      if (sRes.ok) { const d = await sRes.json(); setScoreData(d.current); setRecs(d.recommendations || []); }
      if (pRes.ok) { const d = await pRes.json(); setPosts(d.posts || []); }
      if (rRes.ok) { const d = await rRes.json(); setEligibleReviews(d.eligible || 0); }
      if (dRes.ok) { const d = await dRes.json(); if (d.success) setRegionDemand(d); }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
          {/* Bloco 1 — Score de Visibilidade */}
          <motion.div variants={fadeUp} className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
            <div className="px-5 pt-4 pb-3 border-b border-black/[0.05]">
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400">Score de Visibilidade</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
              <div className="flex items-center justify-center p-8 sm:border-r border-b sm:border-b-0 border-black/[0.05]">
                <ScoreRing score={scoreData.total_score} />
              </div>
              <div className="p-5 sm:p-6">
                <PilarRow name="Google" score={p!.google.score} max={30} summary={googleSummary(p!.google)} />
                <PilarRow name="Doctoralia" score={p!.doctoralia.score} max={15} summary={doctoraliaSummary(p!.doctoralia)} />
                <PilarRow name="Redes Sociais" score={p!.social.score} max={20} summary={socialSummary(p!.social)} />
                <PilarRow name="SEO & Site" score={p!.seo.score} max={20} summary={seoSummary(p!.seo)} />
                <PilarRow name="Operacional" score={p!.operational.score} max={15} summary={operationalSummary(p!.operational)} />
              </div>
            </div>
          </motion.div>

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
          {regionDemand && <RegionDemandCard d={regionDemand} />}

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
