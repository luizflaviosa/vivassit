'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, ArrowRight, Loader2, Check, Lock, KeyRound, Sparkles } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type OAuthProvider = 'google';
type Mode = 'password' | 'magic';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

function LoginInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams?.get('next') ?? '/painel';

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          // Login = só identidade. Agenda usa Service Account compartilhado (lib/google-calendar)
        },
      });
      if (err) throw err;
    } catch (err) {
      setError(err instanceof Error ? err.message : `Não foi possível entrar com ${provider}`);
      setOauthLoading(null);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      router.replace(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível entrar';
      // Mensagens em pt-BR
      if (/invalid login credentials/i.test(msg)) {
        setError('Email ou senha incorretos. Se ainda não definiu senha, use "Esqueci minha senha" abaixo.');
      } else if (/email not confirmed/i.test(msg)) {
        setError('Confirme seu email primeiro (cheque sua caixa de entrada).');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (err) throw err;
      setMagicSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o link');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError('Digite seu email primeiro.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/callback?next=/configurar-senha`,
      });
      if (err) throw err;
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o email');
    } finally {
      setSubmitting(false);
    }
  };

  const showSuccessCard = magicSent || resetSent;
  const successTitle = resetSent ? 'Email enviado' : 'Link enviado';
  const successBody = resetSent
    ? 'Cheque sua caixa de entrada e clique no link pra definir uma nova senha.'
    : 'Cheque sua caixa de entrada e clique no link pra entrar.';

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/landing" className="inline-flex">
            <Image
              src="/logos/singulare-a.svg"
              alt="Singulare"
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
          {showSuccessCard ? (
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
                {successTitle}
              </h1>
              <p className="text-[14px] text-zinc-500 leading-relaxed">
                {successBody.split(' ').slice(0, 5).join(' ')}{' '}
                <strong className="text-zinc-900">{email}</strong>{' '}
                {successBody.split(' ').slice(5).join(' ')}
              </p>
              <button
                type="button"
                onClick={() => { setMagicSent(false); setResetSent(false); setEmail(''); setPassword(''); }}
                className="mt-6 text-[13px] font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Voltar
              </button>
            </div>
          ) : (
            <>
              <div className="p-8 pb-5">
                <h1 className="text-[26px] font-medium tracking-[-0.025em] text-zinc-900 mb-1.5">
                  Entrar no <span className="font-serif italic font-normal text-zinc-700">painel</span>
                </h1>
                <p className="text-[14px] text-zinc-500 leading-relaxed">
                  Use o email do administrador da clínica.
                </p>
              </div>

              {/* OAuth */}
              <div className="px-8 pb-3">
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  disabled={!!oauthLoading || submitting}
                  className="w-full h-12 rounded-xl bg-white border border-black/[0.10] hover:border-black/30 hover:bg-black/[0.02] text-[14px] font-semibold text-zinc-900 inline-flex items-center justify-center gap-2.5 transition-all disabled:opacity-60"
                >
                  {oauthLoading === 'google' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  Continuar com Google
                </button>
              </div>

              {/* Divider */}
              <div className="px-8 pb-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-black/[0.07]" />
                <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-400">ou</span>
                <div className="flex-1 h-px bg-black/[0.07]" />
              </div>

              {/* Mode tabs */}
              <div className="px-8 pb-4">
                <div className="grid grid-cols-2 p-0.5 bg-zinc-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => { setMode('password'); setError(null); }}
                    className={`h-8 text-[12px] font-semibold rounded-md inline-flex items-center justify-center gap-1.5 transition-all ${
                      mode === 'password' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Senha
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('magic'); setError(null); }}
                    className={`h-8 text-[12px] font-semibold rounded-md inline-flex items-center justify-center gap-1.5 transition-all ${
                      mode === 'magic' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Link mágico
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {mode === 'password' ? (
                  <motion.form
                    key="pw"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                    onSubmit={handlePasswordLogin}
                    className="px-8 pb-6 space-y-2.5"
                  >
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
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="password"
                        required
                        placeholder="Sua senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        className="w-full h-12 pl-10 pr-4 bg-white text-[16px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
                      />
                    </div>

                    {error && <p className="text-[13px] text-rose-600 px-1 leading-relaxed">{error}</p>}

                    <button
                      type="submit"
                      disabled={submitting || !!oauthLoading}
                      className="w-full h-12 rounded-xl text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-70"
                      style={{
                        background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                        boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 8px 24px -8px rgba(110,86,207,0.55)',
                      }}
                    >
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Entrando…</>
                      ) : (
                        <>Entrar<ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={submitting}
                      className="w-full text-center text-[12.5px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors py-1"
                    >
                      Esqueci minha senha · definir nova
                    </button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="ml"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                    onSubmit={handleMagicLink}
                    className="px-8 pb-6 space-y-3"
                  >
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="email"
                        required
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        className="w-full h-12 pl-10 pr-4 bg-white text-[16px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
                      />
                    </div>

                    {error && <p className="text-[13px] text-rose-600 px-1">{error}</p>}

                    <button
                      type="submit"
                      disabled={submitting || !!oauthLoading}
                      className="w-full h-12 rounded-xl text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-70"
                      style={{
                        background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                        boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 8px 24px -8px rgba(110,86,207,0.55)',
                      }}
                    >
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Enviando…</>
                      ) : (
                        <>Enviar link mágico<ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="px-8 py-4 bg-zinc-50/60 border-t border-black/[0.06] flex items-center gap-2 text-[12px] text-zinc-500">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md flex-shrink-0"
                  style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
                >
                  <Lock className="w-3 h-3" strokeWidth={2.5} />
                </span>
                Senha, Google ou link mágico — escolha o que preferir.
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
