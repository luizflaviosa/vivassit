import { redirect } from 'next/navigation';

/**
 * Legacy /landing route — redirects to V6 static landing page.
 * Old React landing (937 lines) backed up as landing-page-legacy.tsx.bak
 */
export default function LandingRedirect() {
  redirect('/v6.html');
}
