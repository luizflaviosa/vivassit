'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Lock, ArrowRight, Loader2, Check, ShieldCheck } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

export default function ConfigurarSenhaPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authedEmail, setAuthedEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Garante que o usuário está logado (fluxo via recovery ou sessão ativa)
  useEffect(() => {
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (!data?.user?.email) {
        router.replace('/login?next=/configurar-senha');
        return;
      }
      setAuthedEmail(data.user.email);
      setChecking(false);
    })();
  }, [router]);

  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  })();
  const strengthLabel = ['', 'Fraca', 'Média', 'Boa', 'Forte'][strength];
  const strengthColor = ['#E4E4E7', '#F87171', '#FBBF24', '#A3E635', '#22C55E'][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      setTimeout(() => router.replace('/painel'), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a senha');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/painel" className="inline-flex">
            <Image
              src="/logos/singulare-a.svg"
              alt="Singulare"
              width={120}
              height={40}
              className="h-10 sm:h-11 w-auto"
              priority
            />
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-16px_rgba(0,0,0,0.10)] overflow-hidden"
        >
          {done ? (
            <div className="p-8 text-center">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-5 text-white"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
              >
                <Check className="w-6 h-6" strokeWidth={3} />
              </motion.div>
              <h1 className="text-[24px] font-medium tracking-[-0.02em] text-zinc-900 mb-2">
                Senha definida
              </h1>
              <p className="text-[14px] text-zinc-500 leading-relaxed">
                Pronto. Te mando pro painel em segundos.
              </p>
            </div>
          ) : (
            <>
              <div className="p-8 pb-5">
                <div
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg mb-3 text-white"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                >
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h1 className="text-[24px] font-medium tracking-[-0.025em] text-zinc-900 mb-1.5">
                  Definir <span className="font-serif italic font-normal text-zinc-700">senha</span>
                </h1>
                <p className="text-[14px] text-zinc-500 leading-relaxed">
                  Escolha uma senha pra entrar sem depender de email.
                  {authedEmail && (
                    <>
                      {' '}Conta: <strong className="text-zinc-900">{authedEmail}</strong>
                    </>
                  )}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="px-8 pb-6 space-y-3">
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="password"
                      required
                      placeholder="Nova senha (mín 8 caracteres)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      autoComplete="new-password"
                      className="w-full h-12 pl-10 pr-4 bg-white text-[16px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
                    />
                  </div>
                  {password && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: strengthColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(strength / 4) * 100}%` }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold tracking-wide" style={{ color: strengthColor }}>
                        {strengthLabel}
                      </span>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="password"
                    required
                    placeholder="Confirmar senha"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="w-full h-12 pl-10 pr-4 bg-white text-[16px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
                  />
                </div>

                {error && <p className="text-[13px] text-rose-600 px-1 leading-relaxed">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-xl text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-70"
                  style={{
                    background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                    boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 8px 24px -8px rgba(110,86,207,0.55)',
                  }}
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</>
                  ) : (
                    <>Salvar senha<ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="px-8 py-4 bg-zinc-50/60 border-t border-black/[0.06] flex items-center gap-2 text-[12px] text-zinc-500">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md flex-shrink-0"
                  style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
                >
                  <Lock className="w-3 h-3" strokeWidth={2.5} />
                </span>
                Você pode trocar a senha quando quiser dentro do painel.
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
