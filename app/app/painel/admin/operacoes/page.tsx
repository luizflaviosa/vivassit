import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin-auth';
import { OperacoesClient } from './OperacoesClient';

export const dynamic = 'force-dynamic';

export default async function OperacoesPage() {
  // Admin-only. Cliente normal (admin de clínica) não tem acesso.
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect('/painel');
  }
  return <OperacoesClient />;
}
