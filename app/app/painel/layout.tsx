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
  Headphones,
  FileText,
  Star,
  Megaphone,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Loader2,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { MeContext, type MeData } from '@/lib/painel-context';
import WelcomeTour from './components/welcome-tour';
import ChatDrawer from './components/chat-drawer';
import InstallPrompt from './components/install-prompt';
import CommandPalette from './components/command-palette';
import TenantSwitcher from './components/tenant-switcher';

const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

type SectionGroup = 'default' | 'daily' | 'consultation' | 'clinic' | 'growth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  hint?: string;
  exact?: boolean;
}

interface NavSection {
  group: SectionGroup;
  label: string | null;
  items: NavItem[];
}

const ROUTE_GROUP: Array<[string, SectionGroup]> = [
  ['/painel/agenda', 'daily'],
  ['/painel/pacientes', 'daily'],
  ['/painel/mensagens', 'daily'],
  ['/painel/atendimento', 'daily'],
  ['/painel/docs', 'consultation'],
  ['/painel/cobrancas', 'consultation'],
  ['/painel/nf', 'consultation'],
  ['/painel/profissionais', 'clinic'],
  ['/painel/equipe', 'clinic'],
  ['/painel/pagamentos', 'clinic'],
  ['/painel/feedback', 'growth'],
  ['/painel/marketing', 'growth'],
];

function resolveGroup(pathname: string): SectionGroup {
  return ROUTE_GROUP.find(([path]) => pathname.startsWith(path))?.[1] ?? 'default';
}

function PainelLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

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

  const group = resolveGroup(pathname);

  const navSections: NavSection[] = [
    {
      group: 'default',
      label: null,
      items: [
        { href: '/painel', label: 'Visão geral', icon: <LayoutGrid className="w-4 h-4" />, enabled: true, exact: true },
      ],
    },
    {
      group: 'daily',
      label: 'Todo dia',
      items: [
        { href: '/painel/agenda', label: 'Agenda', icon: <Calendar className="w-4 h-4" />, enabled: true },
        { href: '/painel/pacientes', label: 'Pacientes', icon: <UserPlus className="w-4 h-4" />, enabled: true },
        { href: '/painel/mensagens', label: 'Mensagens', icon: <MessageCircle className="w-4 h-4" />, enabled: true },
        { href: '/painel/atendimento', label: 'Atendimento', icon: <Headphones className="w-4 h-4" />, enabled: true },
      ],
    },
    {
      group: 'consultation',
      label: 'Por consulta',
      items: [
        { href: '/painel/docs', label: 'Documentos', icon: <FileText className="w-4 h-4" />, enabled: true },
        { href: '/painel/cobrancas', label: 'Cobranças', icon: <CreditCard className="w-4 h-4" />, enabled: true },
        { href: '/painel/nf', label: 'Notas fiscais', icon: <FileText className="w-4 h-4" />, enabled: true },
      ],
    },
    {
      group: 'clinic',
      label: 'Clínica',
      items: [
        { href: '/painel/profissionais', label: 'Profissionais', icon: <Users className="w-4 h-4" />, enabled: true },
        { href: '/painel/equipe', label: 'Equipe', icon: <UserPlus className="w-4 h-4" />, enabled: true },
        { href: '/painel/pagamentos/ativar', label: 'Ativar pagamentos', icon: <CreditCard className="w-4 h-4" />, enabled: true },
      ],
    },
    {
      group: 'growth',
      label: 'Crescimento',
      items: [
        { href: '/painel/feedback', label: 'NPS / feedback', icon: <Star className="w-4 h-4" />, enabled: true },
        { href: '/painel/marketing', label: 'Marketing', icon: <Megaphone className="w-4 h-4" />, enabled: true },
      ],
    },
    {
      group: 'default',
      label: null,
      items: [
        { href: '/painel/configuracoes', label: 'Configurações', icon: <SettingsIcon className="w-4 h-4" />, enabled: true },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const renderNavItems = (items: NavItem[], mobile = false) =>
    items.map((item) => {
      const active = isActive(item);
      const base = mobile
        ? `group flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] font-medium transition-all min-h-[44px]`
        : `group flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-all`;
      return item.enabled ? (
        <Link
          key={item.href}
          href={item.href}
          onClick={mobile ? () => setMobileOpen(false) : undefined}
          className={`${base} ${
            active
              ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300'
              : mobile
                ? 'text-zinc-700 hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.05]'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.03] dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-white/[0.04]'
          }`}
        >
          <span className={active ? '' : mobile ? '' : 'text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300'}>
            {item.icon}
          </span>
          <span className="flex-1">{item.label}</span>
          {mobile && active && <ChevronRight className="w-4 h-4" />}
        </Link>
      ) : (
        <div
          key={item.href}
          className={`${base} text-zinc-300 dark:text-zinc-700 ${mobile ? '' : 'cursor-not-allowed'}`}
          title={item.hint}
        >
          <span>{item.icon}</span>
          <span className="flex-1 truncate">{item.label}</span>
          <span className="text-[9px] uppercase tracking-[0.08em] font-semibold">Em breve</span>
        </div>
      );
    });

  const renderSections = (mobile = false) =>
    navSections.map((section, i) => (
      <div key={i} className={section.label ? 'mt-4 first:mt-0' : ''}>
        {section.label && (
          <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-400 dark:text-zinc-600 select-none">
            {section.label}
          </p>
        )}
        <div className="space-y-0.5">
          {renderNavItems(section.items, mobile)}
        </div>
      </div>
    ));

  return (
    <MeContext.Provider value={me}>
      <div className="painel-root text-zinc-900" data-group={group}>
        <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/80 dark:bg-zinc-950/90 dark:border-white/[0.06] backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-[68px] flex items-center justify-between gap-3">
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
                  src="/logos/singulare-a.svg"
                  alt="Singulare"
                  width={200}
                  height={66}
                  className="h-10 sm:h-12 w-auto"
                  priority
                />
                <span className="hidden sm:inline text-[12px] uppercase tracking-[0.1em] font-semibold text-zinc-400">
                  Painel
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-1.5">
              {me && <TenantSwitcher />}
              <button
                type="button"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
                title={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              >
                {resolvedTheme === 'dark'
                  ? <Sun className="w-4 h-4" />
                  : <Moon className="w-4 h-4" />
                }
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="h-9 px-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-white/[0.06] rounded-md transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto flex gap-0 sm:gap-6 px-0 sm:px-6">
          <aside className="hidden md:block w-60 flex-shrink-0 py-8 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-black/[0.04] dark:border-white/[0.04]">
            <nav className="space-y-0">
              {renderSections(false)}
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
                  className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white dark:bg-zinc-950 p-5 overflow-y-auto border-r border-black/[0.06] dark:border-white/[0.06]"
                  initial={{ x: -288 }}
                  animate={{ x: 0 }}
                  exit={{ x: -288 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <Image
                      src="/logos/singulare-a.svg"
                      alt="Singulare"
                      width={120}
                      height={40}
                      className="h-10 w-auto"
                    />
                    <button
                      type="button"
                      onClick={() => setMobileOpen(false)}
                      className="h-9 w-9 -mr-2 inline-flex items-center justify-center rounded-md hover:bg-black/[0.04]"
                    >
                      <X className="w-5 h-5 text-zinc-700" />
                    </button>
                  </div>
                  <nav className="space-y-0">
                    {renderSections(true)}
                  </nav>
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          <main className="flex-1 min-w-0 px-4 sm:px-0 py-6 sm:py-8 pb-20">{children}</main>
        </div>

        {/* Tour de boas-vindas (so na primeira visita) */}
        {me && <WelcomeTour />}

        {/* Chat conversacional com a IA interna - bolha flutuante */}
        {me && <ChatDrawer />}

        {/* Install prompt PWA (mobile, after 30s) */}
        {me && <InstallPrompt />}

        {/* Cmd+K command palette */}
        {me && <CommandPalette />}
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
