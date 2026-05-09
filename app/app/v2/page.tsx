import { permanentRedirect } from 'next/navigation';

// /v2 era a landing experimental Apple-style. Promovemos pra ser a home (/),
// então /v2 redireciona permanente — preserva links históricos compartilhados.
export default function V2Redirect() {
  permanentRedirect('/');
}
