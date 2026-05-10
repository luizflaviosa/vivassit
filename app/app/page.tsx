import { redirect } from 'next/navigation';

/**
 * Raiz singulare.org renderiza a landing v8 (HTML estatico em /public/v8.html).
 * Redirect 307 (temporario) — facil reverter se quisermos voltar pra V2 React
 * ou promover outra versao depois.
 *
 * Historico:
 *   - originalmente: redirect 307 -> /v6.html
 *   - 13bdc9eff (09/05): trocou pra renderizar componentes V2 React em /
 *   - hoje: redirect 307 -> /v8.html (proximo iterations da landing oficial)
 */
export default function HomePage() {
  redirect('/v8.html');
}
