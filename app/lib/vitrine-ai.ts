// app/lib/vitrine-ai.ts
//
// Geracao de bio + FAQs pra pagina publica /p/[slug] da vitrine.
//
// Estrategia:
//   1. Tenta Gemini (gemini-1.5-flash via API REST) se GEMINI_API_KEY/GOOGLE_* setada.
//   2. Senao tenta Anthropic (claude-haiku via API REST) se ANTHROPIC_API_KEY setada.
//   3. Senao tenta OpenAI (gpt-4o-mini) se OPENAI_API_KEY setada.
//   4. Senao loga warning e devolve null — nao quebra o onboarding.
//
// Tudo via fetch direto (sem SDK) pra evitar peso de dependencia. Modelos
// pequenos/baratos porque o output e curto.

const TIMEOUT_MS = 30_000;

export interface VitrineFaq {
  q: string;
  a: string;
}

export interface VitrineAiInput {
  doctor_name: string;
  specialty: string;
  professional_type?: string | null;
  city?: string | null;
  state?: string | null;
  establishment_type?: string | null;
}

type AiProvider = 'gemini' | 'anthropic' | 'openai';

interface AiCallResult<T> {
  data: T | null;
  provider: AiProvider | null;
  error: string | null;
}

function geminiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Prompts
// ──────────────────────────────────────────────────────────────────────────

function bioPrompt(input: VitrineAiInput): string {
  const loc = [input.city, input.state].filter(Boolean).join('/');
  const profType = input.professional_type || 'profissional de saude';
  const setting = input.establishment_type === 'large_clinic'
    ? 'clinica grande'
    : input.establishment_type === 'small_clinic'
      ? 'clinica'
      : 'consultorio';
  return [
    `Voce escreve bios curtas pra paginas publicas de profissionais de saude no Brasil.`,
    `Tarefa: escreva UMA bio de 40 a 80 palavras pra ${input.doctor_name}, ${profType} - ${input.specialty}${loc ? `, atendendo em ${loc}` : ''} no formato ${setting}.`,
    ``,
    `Regras:`,
    `- Portugues do Brasil.`,
    `- Tom profissional e sobrio. Nada de "expert em", "renomado", "referencia", "transformamos vidas".`,
    `- Nao prometa resultados clinicos nem cite tempo de experiencia (voce nao sabe).`,
    `- Foque no tipo de atendimento e na area, nao em superlativos.`,
    `- Sem emojis, sem markdown, sem aspas, sem cabecalho. So o texto puro da bio.`,
  ].join('\n');
}

function faqsPrompt(input: VitrineAiInput): string {
  const loc = [input.city, input.state].filter(Boolean).join('/');
  return [
    `Voce escreve perguntas frequentes (FAQs) pra paginas publicas de profissionais de saude no Brasil.`,
    `Tarefa: gere 5 FAQs reais que pacientes fazem antes de marcar consulta com ${input.specialty}${loc ? ` em ${loc}` : ''}.`,
    ``,
    `Regras:`,
    `- Portugues do Brasil.`,
    `- Perguntas curtas, do ponto de vista do paciente. Respostas de 1 a 3 frases.`,
    `- Especificas da especialidade: nao gere FAQ generica que vale pra qualquer profissional.`,
    `- Nao prometa resultados, nao recomende tratamento especifico, nao diga "consulte sempre o medico".`,
    `- Respostas neutras, informativas. Sem auto-promocao.`,
    `- Sem emojis, sem markdown.`,
    ``,
    `Responda APENAS um JSON valido, sem markdown ao redor, no formato:`,
    `{"faqs":[{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."}]}`,
  ].join('\n');
}

// ──────────────────────────────────────────────────────────────────────────
// Providers
// ──────────────────────────────────────────────────────────────────────────

async function callGemini(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = geminiApiKey()!;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`gemini ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() ?? '';
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`anthropic ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const first = json.content?.find((c) => c.type === 'text');
    return first?.text?.trim() ?? '';
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`openai ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() ?? '';
  } finally {
    clearTimeout(timeout);
  }
}

async function callAi(prompt: string, maxTokens: number): Promise<{ text: string; provider: AiProvider } | null> {
  if (geminiApiKey()) {
    try {
      const text = await callGemini(prompt, maxTokens);
      if (text) {
        console.info('[vitrine-ai] using provider', 'gemini');
        return { text, provider: 'gemini' };
      }
    } catch (err) {
      console.warn('[vitrine-ai] gemini falhou, tentando anthropic:', err instanceof Error ? err.message : err);
    }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const text = await callAnthropic(prompt, maxTokens);
      if (text) {
        console.info('[vitrine-ai] using provider', 'anthropic');
        return { text, provider: 'anthropic' };
      }
    } catch (err) {
      console.warn('[vitrine-ai] anthropic falhou, tentando openai:', err instanceof Error ? err.message : err);
    }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      const text = await callOpenAI(prompt, maxTokens);
      if (text) {
        console.info('[vitrine-ai] using provider', 'openai');
        return { text, provider: 'openai' };
      }
    } catch (err) {
      console.warn('[vitrine-ai] openai falhou:', err instanceof Error ? err.message : err);
    }
  }
  console.warn('[vitrine-ai] no AI provider available');
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function cleanBio(raw: string): string {
  // remove markdown comum, aspas envolventes, prefixos tipo "Bio:"
  let text = raw.trim();
  text = text.replace(/^(bio|biografia|sobre)[:\s]+/i, '');
  text = text.replace(/^["']|["']$/g, '');
  text = text.replace(/\*\*/g, '');
  text = text.replace(/\s+/g, ' ');
  return text.trim().slice(0, 500);
}

function parseFaqsJson(raw: string): VitrineFaq[] {
  // Aceita JSON puro ou ```json ... ```
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) text = fence[1].trim();
  try {
    const parsed = JSON.parse(text) as { faqs?: Array<{ q?: unknown; a?: unknown }> };
    const list = Array.isArray(parsed.faqs) ? parsed.faqs : [];
    return list
      .map((it) => ({
        q: typeof it.q === 'string' ? it.q.trim().slice(0, 200) : '',
        a: typeof it.a === 'string' ? it.a.trim().slice(0, 600) : '',
      }))
      .filter((it) => it.q && it.a)
      .slice(0, 10);
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────
// API publica
// ──────────────────────────────────────────────────────────────────────────

export function aiAvailable(): boolean {
  return Boolean(geminiApiKey() || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

export async function generateVitrineBio(input: VitrineAiInput): Promise<AiCallResult<string>> {
  if (!aiAvailable()) {
    return { data: null, provider: null, error: 'no_ai_key' };
  }
  try {
    const result = await callAi(bioPrompt(input), 400);
    if (!result) return { data: null, provider: null, error: 'all_providers_failed' };
    const bio = cleanBio(result.text);
    if (!bio) return { data: null, provider: result.provider, error: 'empty_output' };
    return { data: bio, provider: result.provider, error: null };
  } catch (err) {
    return { data: null, provider: null, error: err instanceof Error ? err.message : 'unknown' };
  }
}

export async function generateVitrineFaqs(input: VitrineAiInput): Promise<AiCallResult<VitrineFaq[]>> {
  if (!aiAvailable()) {
    return { data: null, provider: null, error: 'no_ai_key' };
  }
  try {
    const result = await callAi(faqsPrompt(input), 1200);
    if (!result) return { data: null, provider: null, error: 'all_providers_failed' };
    const faqs = parseFaqsJson(result.text);
    if (!faqs.length) return { data: null, provider: result.provider, error: 'parse_failed' };
    return { data: faqs, provider: result.provider, error: null };
  } catch (err) {
    return { data: null, provider: null, error: err instanceof Error ? err.message : 'unknown' };
  }
}
