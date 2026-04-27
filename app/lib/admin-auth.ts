// Lista de emails com acesso ao /admin (dashboard de operação da plataforma).
// Mantenha curta e versionada no código (não em DB) pra evitar escalation acidental.
//
// Pra adicionar admin novo: adicione o email aqui e faça push.
const ADMIN_EMAILS = new Set<string>([
  'luizflaviosa.lfx@gmail.com',
  'luizflaviosa@yahoo.com.br',
  'singulareempresa@gmail.com',
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase().trim());
}
