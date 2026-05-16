// LLM-as-judge: Gemini avalia se a resposta do agente cumpre critério semântico.

import { config } from '../config.js';

const JUDGE_SYSTEM_PROMPT = `Você é um juiz de qualidade de respostas de agente IA (secretária virtual de clínica médica).
Responda APENAS "PASS" ou "FAIL" + justificativa breve (≤80 chars) em português brasileiro.

ENTRADA:
- Critério: o que o agente DEVERIA ter feito
- Contexto: turns anteriores (só pra referência — NÃO compare lá)
- Resposta do agente: ESTA é a que você avalia contra o critério

REGRAS RÍGIDAS (siga ao pé da letra):
1. Avalie APENAS a "Resposta do agente". Se ela atende o critério, é PASS — mesmo que seja simples ou genérica.
2. Pedir esclarecimento, cumprimentar, ou pedir nome/DOB SÃO formas válidas de "responder educadamente" — não marque FAIL por isso.
3. "Repetição" só vale FAIL se for cópia literal palavra-por-palavra de turn anterior. Reformular OU pedir mesmo tipo de info de novo é OK.
4. Confirmar intenção antes de agir (cancelar, confirmar, remarcar) É O COMPORTAMENTO CORRETO. NÃO marque FAIL por "não cancelou direto".
5. Se a resposta cumpre o ESSENCIAL do critério, é PASS. Não invente requisitos extras.
6. Em dúvida razoável, prefira PASS.

EXEMPLOS:

Critério: "O agente respondeu educadamente sem travar?"
Resposta: "Olá! Pra te ajudar, me informe nome e data de nascimento."
Veredito: PASS — Respondeu educadamente, sem travar.

Critério: "O agente confirmou intenção antes de cancelar?"
Resposta: "Encontrei sua consulta em 23/05 às 14h. Confirma o cancelamento?"
Veredito: PASS — Pediu confirmação antes de cancelar.

Critério: "O agente reconheceu que terça é dia fechado?"
Resposta: "Ótimo! Qual especialidade você busca?" (ignora "terça")
Veredito: FAIL — Não mencionou terça, ignorou o pedido.

Critério: "O agente respondeu sem repetir literalmente?"
Resposta: "Pra te ajudar preciso de nome e DOB." (turn anterior: "Para começarmos preciso de nome e DOB.")
Veredito: PASS — Reformulou, não repetiu literal.

Formato OBRIGATÓRIO (sem markdown):
PASS — <razão>
ou
FAIL — <razão>`;

export type JudgeVerdict = {
  passed: boolean;
  reason: string;
};

export async function judgeResponse(
  criteria: string,
  agentResponse: string,
  conversationContext?: string,
): Promise<JudgeVerdict> {
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const userMessage = [
    `DATA ATUAL: ${today}. Use para avaliar referências temporais (datas no futuro/passado).`,
    `\nCritério: ${criteria}`,
    conversationContext ? `\nContexto da conversa anterior:\n${conversationContext}` : '',
    `\nResposta do agente:\n${agentResponse}`,
  ].join('');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.judge.model}:generateContent?key=${config.judge.apiKey}`;

  let res: Response | null = null;
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: JUDGE_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 200,
        },
      }),
    });
    if (res.ok) break;
    // Retry only on 429 (rate limit) and 5xx
    if (res.status !== 429 && res.status < 500) break;
    if (attempt < maxAttempts) {
      const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  if (!res || !res.ok) {
    const body = res ? await res.text().catch(() => '') : '';
    throw new Error(`Gemini judge HTTP ${res?.status || 'NO_RES'}: ${body.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  if (!text) {
    throw new Error(`Gemini judge retorno vazio: ${JSON.stringify(data).slice(0, 300)}`);
  }
  const isPass = text.toUpperCase().startsWith('PASS');
  const reason = text.replace(/^(PASS|FAIL)\s*[—-]\s*/i, '').trim() || text;

  return { passed: isPass, reason };
}
