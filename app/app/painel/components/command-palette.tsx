'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ArrowRight, Command as CommandIcon, CornerDownLeft,
  LayoutGrid, Users, UserPlus, Settings, CreditCard, Calendar as CalendarIcon,
  MessageCircle, FileText, Star, LogOut, Bot, Plus, ExternalLink,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface CmdItem {
  id: string;
  label: string;
  hint?: string;
  group: 'navegação' | 'ação' | 'paciente' | 'externo';
  icon: React.ReactNode;
  keywords?: string[];
  onSelect: () => void;
}

interface PatientLite { id: number; name: string | null; phone: string }

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Foco automático ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setActiveIdx(0);
    } else {
      setQuery('');
    }
  }, [open]);

  // Carrega top pacientes 1x ao abrir
  useEffect(() => {
    if (!open || patients.length > 0) return;
    fetch('/api/painel/pacientes?limit=50')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setPatients(
            (j.patients ?? []).slice(0, 30).map((p: { id: number; name: string | null; phone: string }) => ({
              id: p.id,
              name: p.name,
              phone: p.phone,
            }))
          );
        }
      })
      .catch(() => {});
  }, [open, patients.length]);

  const navItems: CmdItem[] = useMemo(
    () => [
      { id: 'nav-home', label: 'Visão geral', group: 'navegação', icon: <LayoutGrid className="w-4 h-4" />, keywords: ['dashboard', 'home'], onSelect: () => router.push('/painel') },
      { id: 'nav-prof', label: 'Profissionais', group: 'navegação', icon: <Users className="w-4 h-4" />, keywords: ['medicos', 'doctors'], onSelect: () => router.push('/painel/profissionais') },
      { id: 'nav-pac', label: 'Pacientes', group: 'navegação', icon: <UserPlus className="w-4 h-4" />, keywords: ['crm'], onSelect: () => router.push('/painel/pacientes') },
      { id: 'nav-conf', label: 'Configurações', group: 'navegação', icon: <Settings className="w-4 h-4" />, keywords: ['ia', 'prompt', 'agente'], onSelect: () => router.push('/painel/configuracoes') },
      { id: 'nav-cob', label: 'Cobranças', group: 'navegação', icon: <CreditCard className="w-4 h-4" />, keywords: ['pagamentos', 'asaas'], onSelect: () => router.push('/painel/cobrancas') },
      { id: 'nav-agenda', label: 'Agenda', group: 'navegação', icon: <CalendarIcon className="w-4 h-4" />, keywords: ['calendario', 'consultas'], onSelect: () => router.push('/painel/agenda') },
      { id: 'nav-msg', label: 'Mensagens', group: 'navegação', icon: <MessageCircle className="w-4 h-4" />, keywords: ['whatsapp', 'historico'], onSelect: () => router.push('/painel/mensagens') },
      { id: 'nav-nf', label: 'Notas fiscais', group: 'navegação', icon: <FileText className="w-4 h-4" />, keywords: ['nf', 'fiscal'], onSelect: () => router.push('/painel/nf') },
      { id: 'nav-fb', label: 'NPS / feedback', group: 'navegação', icon: <Star className="w-4 h-4" />, keywords: ['nps', 'satisfacao'], onSelect: () => router.push('/painel/feedback') },
      { id: 'nav-pag', label: 'Ativar pagamentos', group: 'navegação', icon: <CreditCard className="w-4 h-4" />, keywords: ['marketplace', 'kyc', 'asaas'], onSelect: () => router.push('/painel/pagamentos/ativar') },
      { id: 'act-novo-prof', label: 'Cadastrar novo profissional', group: 'ação', icon: <Plus className="w-4 h-4" />, keywords: ['adicionar', 'medico'], onSelect: () => router.push('/painel/profissionais') },
      { id: 'act-chat', label: 'Falar com a IA interna', hint: 'abre chat', group: 'ação', icon: <Bot className="w-4 h-4" />, keywords: ['assistente', 'gpt', 'chat'], onSelect: () => {
        // Dispara abertura do chat-drawer via evento custom
        window.dispatchEvent(new CustomEvent('singulare:open-chat'));
      } },
      { id: 'act-logout', label: 'Sair', group: 'ação', icon: <LogOut className="w-4 h-4" />, keywords: ['logout', 'sair'], onSelect: async () => {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        router.replace('/login');
      } },
      { id: 'ext-cal', label: 'Abrir Google Calendar', group: 'externo', icon: <ExternalLink className="w-4 h-4" />, onSelect: () => window.open('https://calendar.google.com', '_blank') },
    ],
    [router]
  );

  const allItems: CmdItem[] = useMemo(() => {
    const patientItems: CmdItem[] = patients.map((p) => ({
      id: `pac-${p.id}`,
      label: p.name ?? p.phone,
      hint: p.phone,
      group: 'paciente' as const,
      icon: <UserPlus className="w-4 h-4" />,
      keywords: [p.phone, p.name ?? ''],
      onSelect: () => router.push(`/painel/pacientes?focus=${p.id}`),
    }));
    return [...navItems, ...patientItems];
  }, [navItems, patients, router]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase().trim();
    return allItems.filter((it) => {
      const hay = [it.label, it.hint ?? '', ...(it.keywords ?? [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [allItems, query]);

  // Reset índice ativo quando muda filtro
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Navegação por teclado
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIdx];
        if (item) {
          item.onSelect();
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, activeIdx]);

  // Agrupa por grupo
  const grouped = useMemo(() => {
    const map: Record<string, CmdItem[]> = {};
    filtered.forEach((it) => {
      if (!map[it.group]) map[it.group] = [];
      map[it.group].push(it);
    });
    return map;
  }, [filtered]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-2xl border border-black/[0.07] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.30)] overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-black/[0.06]">
              <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pra onde vamos? Digite o nome de uma página, ação ou paciente…"
                className="flex-1 h-full bg-transparent text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-400 bg-zinc-100 rounded px-1.5 py-0.5">
                ESC
              </kbd>
            </div>

            <div className="max-h-[55vh] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <div className="px-4 py-10 text-center text-[13px] text-zinc-500">
                  Nada encontrado para <strong>“{query}”</strong>.
                </div>
              ) : (
                Object.entries(grouped).map(([group, items]) => (
                  <div key={group} className="py-1">
                    <div className="px-4 pb-1 text-[10px] uppercase tracking-[0.12em] font-bold text-zinc-400">
                      {group}
                    </div>
                    {items.map((it) => {
                      const idx = filtered.indexOf(it);
                      const active = idx === activeIdx;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => { it.onSelect(); setOpen(false); }}
                          className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${
                            active ? 'bg-violet-50' : 'hover:bg-zinc-50'
                          }`}
                          style={active ? { color: ACCENT_DEEP } : undefined}
                        >
                          <span
                            className="flex-shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md"
                            style={{
                              background: active ? ACCENT_SOFT : '#F4F4F5',
                              color: active ? ACCENT_DEEP : '#71717A',
                            }}
                          >
                            {it.icon}
                          </span>
                          <span className="flex-1 min-w-0 text-[14px] font-medium truncate">
                            {it.label}
                          </span>
                          {it.hint && (
                            <span className="text-[11px] text-zinc-400 truncate max-w-[140px]">{it.hint}</span>
                          )}
                          {active && <CornerDownLeft className="w-3.5 h-3.5 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-black/[0.06] bg-zinc-50/60 flex items-center justify-between text-[11px] text-zinc-500">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <kbd className="font-mono bg-white border border-black/10 rounded px-1">↑↓</kbd>
                  navegar
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="font-mono bg-white border border-black/10 rounded px-1">↵</kbd>
                  selecionar
                </span>
              </div>
              <div className="inline-flex items-center gap-1">
                <CommandIcon className="w-3 h-3" />K abre essa
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
