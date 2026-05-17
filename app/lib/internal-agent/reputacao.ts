/**
 * Reputação: nps_resumo, reviews_externos (reads).
 */
import { supabaseAdmin } from '../supabase';
import type { Handler } from './shared';

export const npsResumo: Handler = async (params, ctx) => {
  const since = params.since
    ? String(params.since)
    : new Date(Date.now() - 90 * 86_400_000).toISOString();
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from('patient_feedback')
    .select('nps_score, feedback_text, patient_name, responded_at')
    .eq('tenant_id', ctx.tenant_id)
    .not('nps_score', 'is', null)
    .gte('responded_at', since)
    .order('responded_at', { ascending: false });

  if (error) return { ok: false, summary: 'Erro ao buscar NPS', error: error.message };

  const list = data ?? [];
  if (list.length === 0) {
    return { ok: true, summary: 'Sem respostas de NPS no período.', data: { count: 0 } };
  }

  const scores = list.map((f) => f.nps_score as number);
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const passives = scores.length - promoters - detractors;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const npsScore = Math.round(((promoters - detractors) / scores.length) * 100);

  const positive = list.filter((f) => (f.nps_score as number) >= 9 && f.feedback_text).slice(0, 3);
  const negative = list.filter((f) => (f.nps_score as number) <= 6 && f.feedback_text).slice(0, 3);

  return {
    ok: true,
    summary: `NPS ${npsScore} (média ${avg.toFixed(1)}/10) com ${list.length} resposta(s). ${promoters} promotor(es), ${detractors} detrator(es).`,
    data: {
      nps_score: npsScore,
      avg,
      count: list.length,
      promoters,
      passives,
      detractors,
      top_positive: positive.map((f) => ({ name: f.patient_name, score: f.nps_score, text: f.feedback_text })),
      top_negative: negative.map((f) => ({ name: f.patient_name, score: f.nps_score, text: f.feedback_text })),
    },
  };
};

export const reviewsExternos: Handler = async (_params, ctx) => {
  const admin = supabaseAdmin();
  // v_latest_tenant_scores é a view agregada; fallback pra tenant_scores se ausente
  let data: any = null;
  let error: any = null;

  const viewQ = await admin
    .from('v_latest_tenant_scores')
    .select('total_score, classification, google_score, google_rating, google_reviews_count, doctoralia_score, doctoralia_rating, doctoralia_reviews_count, doctoralia_present, collected_at')
    .eq('tenant_id', ctx.tenant_id)
    .maybeSingle();

  if (viewQ.data) {
    data = viewQ.data;
  } else {
    const tableQ = await admin
      .from('tenant_scores')
      .select('total_score, classification, google_score, google_rating, google_reviews_count, doctoralia_score, doctoralia_rating, doctoralia_reviews_count, doctoralia_present, collected_at')
      .eq('tenant_id', ctx.tenant_id)
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    data = tableQ.data;
    error = tableQ.error;
  }

  if (error && error.code !== 'PGRST116') {
    return { ok: false, summary: 'Erro ao buscar reviews', error: error.message };
  }
  if (!data) {
    return {
      ok: true,
      summary: 'Sem dados de reviews externas ainda — Singulare Score não foi coletado.',
      data: null,
    };
  }

  const summary = `Google: ${data.google_rating ?? '—'}★ (${data.google_reviews_count ?? 0} reviews). Doctoralia: ${data.doctoralia_present ? `${data.doctoralia_rating ?? '—'}★ (${data.doctoralia_reviews_count ?? 0} reviews)` : 'sem perfil'}.`;

  return {
    ok: true,
    summary,
    data: {
      collected_at: data.collected_at,
      classification: data.classification,
      google: {
        rating: data.google_rating,
        reviews_count: data.google_reviews_count,
        score: data.google_score,
      },
      doctoralia: {
        present: data.doctoralia_present,
        rating: data.doctoralia_rating,
        reviews_count: data.doctoralia_reviews_count,
        score: data.doctoralia_score,
      },
    },
  };
};
