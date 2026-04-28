import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { sendPushToUser } from '@/lib/push-server';

// Manda uma push de teste pra todos os endpoints do user logado.
export async function POST() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const result = await sendPushToUser(auth.ctx.user.id, auth.ctx.tenant.tenant_id, {
    type: 'system',
    title: 'Singulare ativo',
    body: 'Push notifications estão funcionando neste dispositivo.',
    url: '/painel',
    priority: 'normal',
  });

  return NextResponse.json({ success: true, ...result });
}
