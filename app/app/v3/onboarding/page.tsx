// /v3/onboarding — wizard de cadastro no brand Luxury Modular.
// Mantem a mesma API (/api/onboarding) e os mesmos campos obrigatorios
// do onboarding original (admin_phone obrigatorio, doctor_phone opcional).

import { Suspense } from 'react';
import { BrandHeader } from '../_components/BrandHeader';
import { BrandFooter } from '../_components/BrandFooter';
import { OnboardingClientV3 } from './OnboardingClientV3';

export const metadata = {
  title: 'Comecar · Singulare',
  description:
    'Cadastro rapido na Singulare. Em alguns minutos sua clinica esta com WhatsApp conectado, agenda integrada e IA configurada.',
};

export default function V3OnboardingPage() {
  return (
    <>
      <BrandHeader showNav={false} showCTA={false} />
      <Suspense fallback={null}>
        <OnboardingClientV3 />
      </Suspense>
      <BrandFooter />
    </>
  );
}
