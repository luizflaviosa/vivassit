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
}

export const MeContext = createContext<MeData | null>(null);

export function useMe(): MeData | null {
  return useContext(MeContext);
}
