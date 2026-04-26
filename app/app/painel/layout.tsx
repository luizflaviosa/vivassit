'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  Users,
  UserPlus,
  Settings as SettingsIcon,
  CreditCard,
  Calendar,
  MessageCircle,
  FileText,
  Star,
  Megaphone,
  Menu,
  X,
  ChevronRight,
  Lock,
} from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  hint?: string;
}

function PainelLayoutInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const tenantId = searchParams?.get('tenant') ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persiste tenant na localStorage para sobreviver entre cliques internos
  useEffect(() => {
    if (tenantId && typeof window !== 'undefined') {
      localStorage.setItem('vivassit_tenant_id', tenantId);
    }
  }, [tenantId]);

  const effectiveTenant =
    tenantId ||
    (typeof window !== 'undefined' ? localStorage.getItem('vivassit_tenant_id') ?? '' : '');

  const navItems: NavItem[] = [
    { href: '/painel', label: 'Visão geral', icon: <LayoutGrid className="w-4 h-4" />, enabled: true },
    { href: '/painel/profissionais', label: 'Profissionais', icon: <Users className="w-4 h-4" />, enabled: true },
    { href: '/painel/pacientes', label: 'Pacientes', icon: <UserPlus className="w-4 h-4" />, enabled: true },
    { href: '/painel/configuracoes', label: 'Configurações', icon: <SettingsIcon className="w-4 h-4" />, enabled: true },
    { href: '/painel/cobrancas', label: 'Cobranças', icon: <CreditCard className="w-4 h-4" />, enabled: false, hint: 'Em breve' },
    { href: '/painel/agenda', label: 'Agenda', icon: <Calendar className="w-4 h-4" />, enabled: false, hint: 'Em breve' },
    { href: '/painel/mensagens', label: 'Mensagens', icon: <MessageCircle className="w-4 h-4" />, enabled: false, hint: 'Em breve' },
    { href: '/painel/nf', label: 'Notas fiscais', icon: <FileText className="w-4 h-4" />, enabled: false, hint: 'Em breve' },
    { href: '/painel/feedback', label: 'NPS / feedback', icon: <Star className="w-4 h-4" />, enabled: false, hint: 'Em breve' },
    { href: '/painel/visibilidade', label: 'Visibilidade', icon: <Megaphone className="w-4 h-4" />, enabled: false, hint: 'Tráfego pago, SEO e captação' },
  ];

  const linkWith = (path: string) =>
    effectiveTenant ? `${path}?tenant=${encodeURIComponent(effectiveTenant)}` : path;

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-zinc-900">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden h-9 w-9 -ml-2 inline-flex items-center justify-center rounded-md hover:bg-black/[0.04]"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5 text-zinc-700" />
            </button>
            <Link href={linkWith('/painel')} className="flex items-center gap-2">
              <Image
                src="https://cdn.abacus.ai/images/904c7894-74de-41eb-a89d-950fb291aeda.png"
                alt="Vivassit"
                width={120}
                height={40}
                className="h-7 w-auto"
                priority
              />
              <span className="hidden sm:inline text-[12px] uppercase tracking-[0.1em] font-semibold text-zinc-400">
                Painel
              </span>
            </Link>
          </div>

          {/* Beta banner inline */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-500">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-semibold"
              style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
            >
              <Lock className="w-3 h-3" strokeWidth={2.5} />
              Beta
            </span>
            <span>Login por email em breve</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex gap-0 sm:gap-6 px-0 sm:px-6">
        {/* Sidebar desktop */}
        <aside className="hidden md:block w-60 flex-shrink-0 py-8 sticky top-14 h-[calc(100vh-3.5rem)]">
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return item.enabled ? (
                <Link
                  key={item.href}
                  href={linkWith(item.href)}
                  className={`group flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-all ${
                    active
                      ? 'text-zinc-900'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.03]'
                  }`}
                  style={active ? { background: ACCENT_SOFT, color: ACCENT_DEEP } : undefined}
                >
                  <span className={active ? '' : 'text-zinc-400 group-hover:text-zinc-600'}>{item.icon}</span>
                  {item.label}
                </Link>
              ) : (
                <div
                  key={item.href}
                  className="group flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-zinc-300 cursor-not-allowed"
                  title={item.hint}
                >
                  <span className="text-zinc-300">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="text-[9px] uppercase tracking-[0.08em] font-semibold text-zinc-300">Em breve</span>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Sidebar mobile (drawer) */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                className="md:hidden fixed inset-0 z-40 bg-black/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white p-5 overflow-y-auto"
                initial={{ x: -288 }}
                animate={{ x: 0 }}
                exit={{ x: -288 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <Image
                    src="https://cdn.abacus.ai/images/904c7894-74de-41eb-a89d-950fb291aeda.png"
                    alt="Vivassit"
                    width={120}
                    height={40}
                    className="h-7 w-auto"
                  />
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="h-9 w-9 -mr-2 inline-flex items-center justify-center rounded-md hover:bg-black/[0.04]"
                  >
                    <X className="w-5 h-5 text-zinc-700" />
                  </button>
                </div>
                <nav className="space-y-0.5">
                  {navItems.map((item) => {
                    const active = pathname === item.href;
                    return item.enabled ? (
                      <Link
                        key={item.href}
                        href={linkWith(item.href)}
                        onClick={() => setMobileOpen(false)}
                        className={`group flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] font-medium transition-all min-h-[44px] ${
                          active ? 'text-zinc-900' : 'text-zinc-700 hover:bg-black/[0.04]'
                        }`}
                        style={active ? { background: ACCENT_SOFT, color: ACCENT_DEEP } : undefined}
                      >
                        {item.icon}
                        <span className="flex-1">{item.label}</span>
                        {active && <ChevronRight className="w-4 h-4" />}
                      </Link>
                    ) : (
                      <div
                        key={item.href}
                        className="flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] font-medium text-zinc-300"
                      >
                        {item.icon}
                        <span className="flex-1">{item.label}</span>
                        <span className="text-[10px] uppercase tracking-[0.08em] font-semibold">Em breve</span>
                      </div>
                    );
                  })}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main */}
        <main className="flex-1 min-w-0 px-4 sm:px-0 py-6 sm:py-8 pb-20">
          {!effectiveTenant && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6">
              <p className="text-[14px] font-semibold text-amber-900">
                Acesso ao painel exige um tenant na URL.
              </p>
              <p className="text-[13px] text-amber-700 mt-1">
                Use o link enviado por email após o onboarding (formato:
                <code className="font-mono">{' '}/painel?tenant=seu-tenant-id</code>)
              </p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PainelLayoutInner>{children}</PainelLayoutInner>
    </Suspense>
  );
}
