'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, ArrowRight, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type OAuthProvider = 'google';
type Step = 'email' | 'otp';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

// Bypass de OTP pra demos ao vivo (precisa ser igual ao backend)
const DEMO_EMAIL = 'demo@singulare.org';

function LoginInner() {
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') ?? '/painel';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // erro vindo do callback (OAuth ou link clicável que falhou)
  useEffect(() => {
    const callbackErr = searchParams?.get('error');
    if (callbackErr) setError(decodeURIComponent(callbackErr));
  }, [searchParams]);

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
        },
      });
      if (err) throw err;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível continuar com o Google.');
      setOauthLoading(null);
    }
  };

  const sendOtp = async (targetEmail: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        // SEM emailRedirectTo → Supabase envia OTP de 6 dígitos (não magic link).
        // shouldCreateUser=true permite primeiro acesso de novos owners/membros.
        shouldCreateUser: true,
      },
    });
    if (err) throw err;
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      // Bypass demo: pula OTP, faz login server-side direto
      if (target === DEMO_EMAIL) {
        const res = await fetch('/api/auth/demo-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: target }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? 'Falha no login demo');
        window.location.href = json?.redirect ?? next;
        return;
      }
      await sendOtp(target);
      setEmail(target);
      setCode('');
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o código.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending || !email) return;
    setResending(true);
    setError(null);
    try {
      await sendOtp(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível reenviar.');
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async (codeToCheck?: string) => {
    const token = (codeToCheck ?? code).trim();
    if (!/^\d{6}$/.test(token)) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? 'Código inválido ou expirado.');
      }
      // session cookies foram setadas server-side; full reload para o middleware ler
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido ou expirado.');
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/landing" className="inline-flex">
            <Image
              src="/logos/singulare-a.svg"
              alt="Singulare"
              width={240}
              height={80}
              className="h-20 sm:h-22 w-auto"
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
          <AnimatePresence mode="wait" initial={false}>
            {step === 'email' ? (
              <motion.div
                key="step-email"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="p-8 pb-5">
                  <h1 className="text-[26px] font-medium tracking-[-0.025em] text-zinc-900 mb-1.5">
                    Bem-vindo de volta
                  </h1>
                  <p className="text-[14px] text-zinc-500 leading-relaxed">
                    Acesse sua clínica com o email do administrador.
                  </p>
                </div>

                {/* OAuth Google */}
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
                  <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-400">ou por email</span>
                  <div className="flex-1 h-px bg-black/[0.07]" />
                </div>

                <form onSubmit={handleSendEmail} className="px-8 pb-6 space-y-3">
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
                      <><Loader2 className="w-4 h-4 animate-spin" />Enviando código…</>
                    ) : (
                      <>Receber código por email<ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                  <p className="text-[12px] text-zinc-500 leading-relaxed text-center pt-1">
                    Sem senhas. Você recebe um código de 6 dígitos.
                  </p>
                </form>

                <div className="px-8 py-4 bg-zinc-50/60 border-t border-black/[0.06] flex items-center gap-2 text-[12px] text-zinc-500">
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-md flex-shrink-0"
                    style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
                  >
                    <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
                  </span>
                  Acesso protegido. Seus dados ficam só com você.
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step-otp"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <OtpStep
                  email={email}
                  code={code}
                  setCode={setCode}
                  verifying={verifying}
                  resending={resending}
                  error={error}
                  onVerify={handleVerify}
                  onResend={handleResend}
                  onBack={() => {
                    setStep('email');
                    setCode('');
                    setError(null);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="text-center text-[13px] text-zinc-500 mt-6">
          Ainda não conhece a Singulare?{' '}
          <Link href="/landing" className="font-semibold underline" style={{ color: ACCENT_DEEP }}>
            Comece grátis
          </Link>
        </p>
      </div>
    </div>
  );
}

function OtpStep({
  email,
  code,
  setCode,
  verifying,
  resending,
  error,
  onVerify,
  onResend,
  onBack,
}: {
  email: string;
  code: string;
  setCode: (c: string) => void;
  verifying: boolean;
  resending: boolean;
  error: string | null;
  onVerify: (codeOverride?: string) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // auto-verify quando completa 6 dígitos
  useEffect(() => {
    if (code.length === 6 && !verifying) {
      onVerify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
  };

  return (
    <>
      <div className="p-8 pb-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Trocar email
        </button>
        <h1 className="text-[26px] font-medium tracking-[-0.025em] text-zinc-900 mb-1.5">
          Digite o código
        </h1>
        <p className="text-[14px] text-zinc-500 leading-relaxed">
          Enviamos um código de 6 dígitos para{' '}
          <strong className="text-zinc-900">{email}</strong>.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onVerify();
        }}
        className="px-8 pb-6 space-y-3"
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          placeholder="• • • • • •"
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          disabled={verifying}
          className="w-full h-14 px-4 bg-white text-center text-[28px] tracking-[0.5em] font-medium text-zinc-900 placeholder:text-zinc-300 placeholder:tracking-[0.4em] rounded-xl border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all disabled:opacity-60"
        />

        {error && <p className="text-[13px] text-rose-600 px-1 leading-relaxed">{error}</p>}

        <button
          type="submit"
          disabled={verifying || code.length !== 6}
          className="w-full h-12 rounded-xl text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-70"
          style={{
            background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
            boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 8px 24px -8px rgba(110,86,207,0.55)',
          }}
        >
          {verifying ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Verificando…</>
          ) : (
            <>Entrar<ArrowRight className="w-4 h-4" /></>
          )}
        </button>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onResend}
            disabled={resending || verifying}
            className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {resending ? (
              <><Loader2 className="w-3 h-3 animate-spin" />Reenviando…</>
            ) : (
              'Não recebeu? Reenviar código'
            )}
          </button>
        </div>
      </form>

      <div className="px-8 py-4 bg-zinc-50/60 border-t border-black/[0.06] flex items-center gap-2 text-[12px] text-zinc-500">
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-md flex-shrink-0"
          style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
        >
          <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
        </span>
        O código expira em 1 hora.
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><Loader2 className="w-6 h-6 text-zinc-400 animate-spin" /></div>}>
      <LoginInner />
    </Suspense>
  );
}
