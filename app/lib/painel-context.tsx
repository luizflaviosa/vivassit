'use client';

import { createContext, useContext } from 'react';

export interface MeData {
  tenant_id: string;
  clinic_name: string;
  plan_type: string;
  subscription_status: string;
  admin_email: string;
  chatwoot_url?: string | null;
  chatwoot_account_id?: string | number | null;
  // Admin de plataforma (lista hardcoded em lib/admin-auth.ts). Usado pra
  // mostrar grupo "Administração" no menu lateral.
  is_admin?: boolean;
  // Feature flag do modulo Seguimento de Tratamento (RPM). Quando true,
  // libera o item "Seguimento" no menu lateral e acesso a /painel/seguimento.
  addon_rpm?: boolean;
}

export const MeContext = createContext<MeData | null>(null);

export function useMe(): MeData | null {
  return useContext(MeContext);
}
