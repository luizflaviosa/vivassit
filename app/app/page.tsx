import { redirect } from 'next/navigation';

/**
 * DEAD CODE (2026-05-17) — rota '/' agora e interceptada por
 * `rewrites().beforeFiles` no next.config.js, que serve /v8.html
 * diretamente SEM 307 (economiza 1 round-trip, ~100-200ms TTFB).
 *
 * Mantido como fallback: se o rewrite for removido por engano, esta
 * funcao volta a atender a rota com redirect 307.
 *
 * Historico:
 *   - originalmente: redirect 307 -> /v6.html
 *   - 13bdc9eff (09/05): renderizava componentes V2 React em /
 *   - ate 2026-05-17: redirect 307 -> /v8.html
 *   - 2026-05-17 (vercel-performance-engineer skill): substituido por rewrite
 */
export default function HomePage() {
  redirect('/v8.html');
}
