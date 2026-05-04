// ============================================
// FILE: app/(painel)/marketing/page.tsx
// Singulare Score Dashboard — Main page
// ============================================
// Place at: app/(painel)/marketing/page.tsx
// or wherever your painel layout group is

"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// Types
interface PilarData {
  score: number;
  max: number;
  [key: string]: any;
}

interface ScoreData {
  total_score: number;
  classification: string;
  score_change: number;
  previous_score: number;
  pilares: Record<string, PilarData>;
  collected_at: string;
}

interface Recommendation {
  priority: "high" | "medium" | "low";
  category: string;
  message: string;
  action: string;
}

interface Post {
  id: number;
  post_text: string;
  post_type: string;
  platform: string;
  status: string;
  hashtags: string[];
  created_at: string;
  post_image_url?: string;
}

// Score Ring Component
function ScoreRing({ score, size = 180, className = "" }: { score: number; size?: number; className?: string }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score <= 25 ? "#ef4444" : score <= 50 ? "#f59e0b" : score <= 75 ? "#22c55e" : "#6e56cf";
  const bgColor =
    score <= 25 ? "#fef2f2" : score <= 50 ? "#fffbeb" : score <= 75 ? "#f0fdf4" : "#f5f3ff";
  const label =
    score <= 25 ? "Crítico" : score <= 50 ? "Em desenvolvimento" : score <= 75 ? "Bom" : "Excelente";

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f4f4f5" strokeWidth="12" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tracking-tight" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-zinc-400 mt-0.5">/ 100</span>
      </div>
      <div
        className="mt-3 px-3 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: bgColor, color }}
      >
        {label}
      </div>
    </div>
  );
}

// Pilar Bar Component
function PilarBar({
  name,
  icon,
  score,
  max,
  details,
}: {
  name: string;
  icon: string;
  score: number;
  max: number;
  details: string;
}) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex items-center gap-3 py-3">
      <span className="text-lg w-8 text-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm font-medium text-zinc-800">{name}</span>
          <span className="text-xs font-semibold" style={{ color }}>
            {score}/{max}
          </span>
        </div>
        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <p className="text-[11px] text-zinc-400 mt-1 truncate">{details}</p>
      </div>
    </div>
  );
}

// Recommendation Card
function RecommendationCard({ rec }: { rec: Recommendation }) {
  const priorityStyles = {
    high: { bg: "#fef2f2", border: "#fca5a5", icon: "🔴", label: "Urgente" },
    medium: { bg: "#fffbeb", border: "#fcd34d", icon: "🟡", label: "Importante" },
    low: { bg: "#f0fdf4", border: "#86efac", icon: "🟢", label: "Sugestão" },
  };
  const style = priorityStyles[rec.priority];

  return (
    <div
      className="rounded-xl p-4 border"
      style={{ backgroundColor: style.bg, borderColor: style.border + "60" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs">{style.icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          {style.label} · {rec.category}
        </span>
      </div>
      <p className="text-sm text-zinc-700 leading-relaxed mb-2">{rec.message}</p>
      <p className="text-xs font-medium text-violet-600">→ {rec.action}</p>
    </div>
  );
}

// Post Preview Card
function PostCard({ post, onApprove, onReject }: { post: Post; onApprove: () => void; onReject: () => void }) {
  const platformIcons: Record<string, string> = {
    instagram: "📸",
    facebook: "📘",
    linkedin: "💼",
    google_business: "📍",
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-100 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span>{platformIcons[post.platform] || "📱"}</span>
        <span className="text-xs font-medium text-zinc-500 uppercase">{post.platform}</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium">
          {post.post_type?.replace("_", " ")}
        </span>
      </div>
      <p className="text-sm text-zinc-700 leading-relaxed mb-3 line-clamp-4">{post.post_text}</p>
      {post.hashtags && post.hashtags.length > 0 && (
        <p className="text-xs text-violet-500 mb-3">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 py-2 px-3 bg-gradient-to-b from-violet-500 to-violet-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:brightness-110 transition"
        >
          ✓ Aprovar
        </button>
        <button
          onClick={onReject}
          className="py-2 px-3 bg-zinc-100 text-zinc-500 text-xs font-medium rounded-lg hover:bg-zinc-200 transition"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function MarketingPage() {
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"score" | "posts" | "ads">("score");

  const fetchData = useCallback(async () => {
    try {
      const [scoreRes, postsRes] = await Promise.all([
        fetch("/api/painel/marketing/score"),
        fetch("/api/painel/marketing/posts?status=pending_approval"),
      ]);

      if (scoreRes.ok) {
        const data = await scoreRes.json();
        setScoreData(data.current);
        setRecommendations(data.recommendations || []);
        setHistory(data.history || []);
      }

      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error("Failed to fetch marketing data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (postId: number) => {
    await fetch(`/api/painel/marketing/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    fetchData();
  };

  const handleReject = async (postId: number) => {
    await fetch(`/api/painel/marketing/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", reason: "Não aprovado pelo médico" }),
    });
    fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-violet-600 animate-spin" />
      </div>
    );
  }

  const pilares = scoreData?.pilares || {};

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Presença Digital</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Singulare Score · atualizado{" "}
            {scoreData?.collected_at
              ? new Date(scoreData.collected_at).toLocaleDateString("pt-BR")
              : "—"}
          </p>
        </div>
        {scoreData?.score_change !== undefined && scoreData.score_change !== 0 && (
          <div
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              scoreData.score_change > 0
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-500"
            }`}
          >
            {scoreData.score_change > 0 ? "↑" : "↓"} {Math.abs(scoreData.score_change)} pts
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl w-fit">
        {[
          { key: "score", label: "Score", icon: "📊" },
          { key: "posts", label: `Posts ${posts.length > 0 ? `(${posts.length})` : ""}`, icon: "✍️" },
          { key: "ads", label: "Tráfego", icon: "📈" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: SCORE ===== */}
      {activeTab === "score" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score Ring */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-zinc-100 p-6 shadow-sm flex flex-col items-center">
            <ScoreRing score={scoreData?.total_score || 0} />
            {scoreData?.previous_score !== null && scoreData?.previous_score !== undefined && (
              <p className="text-xs text-zinc-400 mt-4">
                Semana anterior: {scoreData.previous_score} pts
              </p>
            )}
          </div>

          {/* Pilares */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-100 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Detalhamento por pilar
            </h3>
            <div className="divide-y divide-zinc-50">
              <PilarBar
                name="Google"
                icon="🔍"
                score={pilares.google?.score || 0}
                max={30}
                details={`${pilares.google?.rating || "—"} ★ · ${pilares.google?.reviews || 0} avaliações`}
              />
              <PilarBar
                name="Doctoralia"
                icon="🏥"
                score={pilares.doctoralia?.score || 0}
                max={15}
                details={
                  pilares.doctoralia?.present
                    ? `${pilares.doctoralia?.rating || "—"} ★ · ${pilares.doctoralia?.reviews || 0} opiniões`
                    : "Perfil não encontrado"
                }
              />
              <PilarBar
                name="Redes Sociais"
                icon="📱"
                score={pilares.social?.score || 0}
                max={20}
                details={`${pilares.social?.ig_followers || 0} seguidores · ${pilares.social?.ig_engagement || 0}% engajamento`}
              />
              <PilarBar
                name="SEO & Website"
                icon="🌐"
                score={pilares.seo?.score || 0}
                max={20}
                details={
                  pilares.seo?.website_exists
                    ? `Mobile: ${pilares.seo?.mobile_score || 0}/100`
                    : "Sem site próprio"
                }
              />
              <PilarBar
                name="Operacional"
                icon="⚙️"
                score={pilares.operational?.score || 0}
                max={15}
                details={`NPS: ${pilares.operational?.avg_nps || "—"} · No-show: ${pilares.operational?.noshow_rate ? Math.round(pilares.operational.noshow_rate * 100) + "%" : "—"}`}
              />
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="lg:col-span-3">
              <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Recomendações para melhorar seu score
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recommendations
                  .sort((a, b) => {
                    const order = { high: 0, medium: 1, low: 2 };
                    return order[a.priority] - order[b.priority];
                  })
                  .map((rec, i) => (
                    <RecommendationCard key={i} rec={rec} />
                  ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!scoreData && (
            <div className="lg:col-span-3 text-center py-16">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                Seu score está sendo calculado
              </h3>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                A Singulare está coletando dados do Google, Doctoralia, redes sociais e do seu
                desempenho operacional. O primeiro score estará disponível em até 7 dias.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: POSTS ===== */}
      {activeTab === "posts" && (
        <div>
          {posts.length > 0 ? (
            <>
              <p className="text-sm text-zinc-500 mb-4">
                {posts.length} post{posts.length > 1 ? "s" : ""} aguardando sua aprovação
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onApprove={() => handleApprove(post.id)}
                    onReject={() => handleReject(post.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-zinc-100">
              <div className="text-4xl mb-4">✍️</div>
              <h3 className="text-lg font-semibold text-zinc-800 mb-2">Nenhum post pendente</h3>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                A IA gera posts educativos sobre sua especialidade automaticamente. Quando estiverem
                prontos, aparecerão aqui para sua aprovação antes de serem publicados.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: ADS ===== */}
      {activeTab === "ads" && (
        <div className="text-center py-16 bg-white rounded-2xl border border-zinc-100">
          <div className="text-4xl mb-4">📈</div>
          <h3 className="text-lg font-semibold text-zinc-800 mb-2">Tráfego Pago</h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
            Ative campanhas no Google e Instagram com um clique. Defina seu orçamento e a Singulare
            cuida de tudo — criação, otimização e relatórios.
          </p>
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-b from-violet-500 to-violet-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-violet-500/30 hover:brightness-110 transition">
            🚀 Ativar Tráfego Pago
          </button>
          <p className="text-xs text-zinc-300 mt-3">A partir de R$ 300/mês + taxa de gestão</p>
        </div>
      )}
    </div>
  );
}
