// Rate limiter simples in-memory baseado em sliding window.
// Adequado pra MVP em Vercel serverless: cada cold start zera o estado,
// mas dentro de uma instancia "quente" funciona pra abuse rapido.
//
// Pra producao em escala, migrar pra Upstash Redis ou Vercel KV.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Limpa buckets expirados periodicamente (evita memory leak)
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  options: { max: number; windowMs: number }
): RateLimitResult {
  cleanup();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    const newBucket: Bucket = { count: 1, resetAt: now + options.windowMs };
    buckets.set(key, newBucket);
    return {
      allowed: true,
      remaining: options.max - 1,
      resetAt: newBucket.resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (bucket.count >= options.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: options.max - bucket.count,
    resetAt: bucket.resetAt,
    retryAfterSeconds: 0,
  };
}

// Helper pra extrair IP do request
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}
