'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, ArrowRight, Loader2, Check, Lock } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

function LoginInner() {
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') ?? '/painel';
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o link');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/landing" className="inline-flex">
            <Image
              src="https://cdn.abacus.ai/images/904c7894-74de-41eb-a89d-950fb291aeda.png"
              alt="Vivassit"
              width={120}
              height={40}
              className="h-9 w-auto"
              priority
            />
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-16px_rgba(0,0,0,0.10)] overflow-hidden"
        >
          {sent ? (
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
                Link enviado
              </h1>
              <p className="text-[14px] text-zinc-500 leading-relaxed">
                Cheque sua caixa de entrada de <strong className="text-zinc-900">{email}</strong>{' '}
                e clique no link mágico pra entrar.
              </p>
              <button
                type="button"
                onClick={() => { setSent(false); setEmail(''); }}
                className="mt-6 text-[13px] font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Usar outro email
              </button>
            </div>
          ) : (
            <>
              <div className="p-8 pb-6">
                <h1 className="text-[26px] font-medium tracking-[-0.025em] text-zinc-900 mb-1.5">
                  Entrar no <span className="font-serif italic font-normal text-zinc-700">painel</span>
                </h1>
                <p className="text-[14px] text-zinc-500 leading-relaxed">
                  Use o email do administrador da clínica. Enviaremos um link mágico.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="email"
                    required
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    autoComplete="email"
                    className="w-full h-12 pl-10 pr-4 bg-white text-[16px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
                  />
                </div>

                {error && (
                  <p className="text-[13px] text-rose-600 px-1">{error}</p>
                )}

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
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      Enviar link mágico
                      <ArrowRight className="w-4 h-4" />
                    </>
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
                Sem senha, sem reset. Só email.
              </div>
            </>
          )}
        </motion.div>

        <p className="text-center text-[13px] text-zinc-500 mt-6">
          Ainda não tem conta?{' '}
          <Link href="/landing" className="font-semibold underline" style={{ color: ACCENT_DEEP }}>
            Comece grátis
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><Loader2 className="w-6 h-6 text-zinc-400 animate-spin" /></div>}>
      <LoginInner />
    </Suspense>
  );
}
