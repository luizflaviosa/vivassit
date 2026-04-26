'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  LogOut,
  Loader2,
} from 'lucide-react';
import { MeContext, type MeData } from '@/lib/painel-context';

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
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/painel/me', { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.success) {
          setMe(json.tenant);
        } else if (res.status === 401) {
          router.replace('/login?next=' + encodeURIComponent(pathname));
        } else if (res.status === 404) {
          router.replace('/landing');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.replace('/login');
  };

  const navItems: NavItem[] = [
    { href: '/painel', label: 'Visão geral', icon: <LayoutGrid className="w-4 h-4" />, enabled: true },
    { href: '/painel/profissionais', label: 'Profissionais', icon: <Users className="w-4 h-4" />, enabled: true },
    { href: '/painel/pacientes', label: 'Pacientes', icon: <UserPlus className="w-4 h-4" />, enabled: true },
    { href: '/painel/configuracoes', label: 'Configurações', icon: <SettingsIcon className="w-4 h-4" />, enabled: true },
    { href: '/painel/pagamentos/ativar', label: 'Ativar pagamentos', icon: <CreditCard className="w-4 h-4" />, enabled: true },
    { href: '/painel/cobrancas', label: 'Cobranças', icon: <CreditCard className="w-4 h-4" />, enabled: false, hint: 'Em breve' },
    { href: '/painel/agenda', label: 'Agenda', icon: <Calendar className="w-4 h-4" />, enabled: false, hint: 'Em breve' },
    { href: '/painel/mensagens', label: 'Mensagens', icon: <MessageCircle className="w-4 h-4" />, enabled: false, hint: 'Em breve' },
    { href: '/painel/nf', label: 'Notas fiscais', icon: <FileText className="w-4 h-4" />, enabled: false, hint: 'Em breve' },
    { href: '/painel/feedback', label: 'NPS / feedback', icon: <Star className="w-4 h-4" />, enabled: false, hint: 'Em breve' },
    { href: '/painel/visibilidade', label: 'Visibilidade', icon: <Megaphone className="w-4 h-4" />, enabled: false, hint: 'Tráfego pago e SEO' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-screen bg-[#FAFAF7] text-zinc-900">
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
              <Link href="/painel" className="flex items-center gap-2">
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

            <div className="flex items-center gap-3">
              {me && (
                <span className="hidden sm:inline-flex items-center gap-2 text-[12px] text-zinc-500">
                  <span className="font-medium text-zinc-900 truncate max-w-[200px]">{me.clinic_name}</span>
                  <span
                    className="text-[10px] uppercase tracking-[0.08em] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
                  >
                    {me.plan_type}
                  </span>
                </span>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="h-9 px-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04] rounded-md transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto flex gap-0 sm:gap-6 px-0 sm:px-6">
          <aside className="hidden md:block w-60 flex-shrink-0 py-8 sticky top-14 h-[calc(100vh-3.5rem)]">
            <nav className="space-y-0.5">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return item.enabled ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-all ${
                      active ? 'text-zinc-900' : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.03]'
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
                          href={item.href}
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

          <main className="flex-1 min-w-0 px-4 sm:px-0 py-6 sm:py-8 pb-20">{children}</main>
        </div>
      </div>
    </MeContext.Provider>
  );
}

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PainelLayoutInner>{children}</PainelLayoutInner>
    </Suspense>
  );
}
