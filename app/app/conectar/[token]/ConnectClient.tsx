'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, Copy, Loader2, RefreshCw } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';

const CONNECTED_STATUSES = new Set(['open', 'connected']);

interface Props {
  token: string;
  clinicName: string | null;
  doctorName: string | null;
  initialStatus: string;
  initialQrCode: string | null;
  initialPairingCode: string | null;
  phoneNumber: string | null;
}

interface StatusResponse {
  connected: boolean;
  evolution_status: string;
  evolution_qr_code: string | null;
  evolution_pairing_code: string | null;
  evolution_phone_number: string | null;
  redirect_url: string | null;
}

interface RefreshResponse {
  connected: boolean;
  evolution_status: string;
  evolution_qr_code: string | null;
  evolution_pairing_code: string | null;
}

export function ConnectClient({
  token,
  clinicName,
  doctorName,
  initialStatus,
  initialQrCode,
  initialPairingCode,
  phoneNumber,
}: Props) {
  const reducedMotion = useReducedMotion();

  const [qrCode, setQrCode] = useState<string | null>(initialQrCode);
  const [pairingCode, setPairingCode] = useState<string | null>(initialPairingCode);
  const [status, setStatus] = useState<string>(initialStatus);
  const [showQr, setShowQr] = useState<boolean>(!initialPairingCode);
  const [copied, setCopied] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const connected = CONNECTED_STATUSES.has((status ?? '').toLowerCase());

  const refreshQr = async () => {
    if (refreshing || connected) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch(`/api/conectar/${token}/refresh-qr`, {
        method: 'POST',
        cache: 'no-store',
      });
      if (!res.ok) {
        if (res.status === 429) {
          setRefreshError('Devagar — espera alguns segundos.');
        } else if (res.status === 409) {
          setRefreshError('Sua instancia esta sendo preparada. Aguarde.');
        } else {
          setRefreshError('Falha ao atualizar. Tente de novo.');
        }
        return;
      }
      const json = (await res.json()) as RefreshResponse;
      if (json.evolution_status) setStatus(json.evolution_status);
      if (json.evolution_qr_code) setQrCode(json.evolution_qr_code);
      if (json.evolution_pairing_code) setPairingCode(json.evolution_pairing_code);
    } catch {
      setRefreshError('Sem conexao. Verifique sua internet.');
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-refresh ao montar: o QR cacheado no DB e do momento do onboarding
  // (provavelmente ja expirou se o cliente abriu o email minutos depois).
  // Pedimos QR fresh em background sem bloquear a primeira renderizacao.
  useEffect(() => {
    if (connected) return;
    refreshQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling pra detectar conexao + atualizar QR/pair caso o n8n popule depois
  useEffect(() => {
    if (connected) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/conectar/${token}/status`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as StatusResponse;
        if (cancelled) return;

        setStatus(json.evolution_status);
        if (json.evolution_qr_code) setQrCode(json.evolution_qr_code);
        if (json.evolution_pairing_code) setPairingCode(json.evolution_pairing_code);

        if (json.connected && json.redirect_url) {
          setRedirecting(true);
          // Pequeno delay pro usuario ver o estado "conectado" antes do redirect
          setTimeout(() => {
            window.location.href = json.redirect_url!;
          }, 1400);
        }
      } catch {
        // best-effort polling
      }
    };

    const interval = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, connected]);

  const copyPair = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const hasQr = !!qrCode;
  const hasPair = !!pairingCode;
  const waitingForCode = !hasQr && !hasPair && !connected;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/logos/singulare-b.svg"
              alt="Singulare"
              width={140}
              height={40}
              className="h-9 sm:h-10 w-auto"
              priority
            />
          </Link>
          <span className="text-[12px] tracking-[0.04em] uppercase text-zinc-500">
            WhatsApp
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-5 sm:px-6 py-12 sm:py-20">
        <div className="w-full max-w-md mx-auto">
          {/* Connected — celebracao + redirect em andamento */}
          {connected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
                className="mx-auto mb-7 inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
              >
                <Check className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={2.5} />
              </motion.div>
              <h1 className="text-[clamp(28px,6vw,40px)] tracking-[-0.02em] font-medium leading-[1.08] text-zinc-50 mb-3">
                <span className="font-serif italic font-normal text-zinc-400">Tudo pronto.</span>
              </h1>
              <p className="text-[15px] sm:text-[17px] text-zinc-400 max-w-sm mx-auto leading-relaxed mb-8">
                Sua secretária IA já está atendendo no WhatsApp.
              </p>
              {redirecting && (
                <p className="inline-flex items-center gap-2 text-[13px] text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Levando você ao painel
                </p>
              )}
            </motion.div>
          )}

          {/* Aguardando que o N8N popule QR/pair (raro, mas possivel) */}
          {!connected && waitingForCode && (
            <div className="text-center">
              <h1 className="text-[clamp(28px,6vw,40px)] tracking-[-0.02em] font-medium leading-[1.06] text-zinc-50 mb-4">
                <span className="font-serif italic font-normal text-zinc-400">Quase lá.</span>{' '}
                Preparando seu QR Code.
              </h1>
              <p className="text-[15px] text-zinc-500 mb-10 max-w-sm mx-auto leading-relaxed">
                Em poucos instantes o código aparece aqui. Pode deixar essa página aberta.
              </p>
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-zinc-600" />
            </div>
          )}

          {/* Estado principal: QR ou pairing code */}
          {!connected && !waitingForCode && (
            <div className="text-center">
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="text-[clamp(28px,6vw,42px)] tracking-[-0.02em] font-medium leading-[1.06] text-zinc-50 mb-3"
              >
                <span className="font-serif italic font-normal text-zinc-400">Conecte</span>{' '}
                seu WhatsApp
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-[14px] sm:text-[15px] text-zinc-500 mb-10"
              >
                {clinicName ? (
                  <>
                    Clínica:{' '}
                    <span className="text-zinc-300 font-medium">{clinicName}</span>
                  </>
                ) : doctorName ? (
                  <>
                    Para{' '}
                    <span className="text-zinc-300 font-medium">{doctorName}</span>
                  </>
                ) : (
                  'Em segundos sua secretária IA começa a atender'
                )}
              </motion.p>

              <AnimatePresence mode="wait">
                {!showQr && hasPair && (
                  <motion.div
                    key="pair"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    <motion.button
                      onClick={copyPair}
                      whileHover={{ scale: 1.012 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                      className="group block mx-auto w-full max-w-md py-9 sm:py-12 px-4 bg-zinc-900/60 rounded-3xl border border-white/[0.08] shadow-[0_2px_30px_-4px_rgba(110,86,207,0.18)] hover:border-white/[0.14] transition-colors"
                      title="Toque pra copiar"
                      aria-label={`Pair code ${pairingCode}, toque pra copiar`}
                    >
                      <code
                        className="block font-mono font-semibold leading-none"
                        style={{
                          color: '#A78BFA',
                          fontSize: 'clamp(38px, 11vw, 68px)',
                          letterSpacing: '0.16em',
                        }}
                      >
                        {pairingCode}
                      </code>
                      <p className="mt-5 text-[11px] uppercase tracking-[0.14em] font-medium flex items-center justify-center gap-1.5">
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={3} />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 text-zinc-500" />
                            <span className="text-zinc-500">Toque pra copiar</span>
                          </>
                        )}
                      </p>
                    </motion.button>

                    <ol className="mt-10 max-w-sm mx-auto space-y-3.5 text-left">
                      {[
                        'Abra o WhatsApp no celular da clínica',
                        <>
                          Vá em{' '}
                          <strong className="text-zinc-200 font-medium">
                            Aparelhos conectados → Conectar com número
                          </strong>
                        </>,
                        'Cole o código',
                      ].map((step, i) => (
                        <li
                          key={i}
                          className="flex gap-3 text-[14px] sm:text-[15px] text-zinc-400 leading-relaxed"
                        >
                          <span
                            className="flex-shrink-0 mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold bg-white/[0.06] text-zinc-200 ring-1 ring-white/[0.06]"
                          >
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </motion.div>
                )}

                {showQr && hasQr && (
                  <motion.div
                    key="qr"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="mx-auto inline-block bg-white p-4 rounded-3xl border border-white/[0.08] shadow-[0_2px_30px_-4px_rgba(110,86,207,0.18)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCode!}
                        alt="QR Code WhatsApp"
                        className="w-60 h-60 sm:w-64 sm:h-64 block"
                      />
                    </div>
                    <ol className="mt-10 max-w-sm mx-auto space-y-3.5 text-left">
                      {[
                        'Abra o WhatsApp no celular da clínica',
                        <>
                          Vá em{' '}
                          <strong className="text-zinc-200 font-medium">
                            Aparelhos conectados → Conectar dispositivo
                          </strong>
                        </>,
                        'Aponte a câmera pro QR Code',
                      ].map((step, i) => (
                        <li
                          key={i}
                          className="flex gap-3 text-[14px] sm:text-[15px] text-zinc-400 leading-relaxed"
                        >
                          <span
                            className="flex-shrink-0 mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold bg-white/[0.06] text-zinc-200 ring-1 ring-white/[0.06]"
                          >
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Status + acoes */}
              <div className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-[12px] text-zinc-500">
                <span className="inline-flex items-center gap-2" aria-live="polite">
                  <motion.span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: ACCENT }}
                    animate={reducedMotion ? {} : { opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  Aguardando conexão
                </span>

                <button
                  onClick={refreshQr}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 hover:text-zinc-300 transition-colors underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label="Gerar novo QR Code"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`}
                    strokeWidth={2}
                  />
                  {refreshing ? 'Atualizando' : 'Atualizar QR'}
                </button>

                {hasQr && hasPair && (
                  <button
                    onClick={() => setShowQr(!showQr)}
                    className="hover:text-zinc-300 transition-colors underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {showQr ? 'Prefiro código' : 'Prefiro QR Code'}
                  </button>
                )}

                {phoneNumber && (
                  <span className="text-zinc-600">
                    Número: <span className="text-zinc-400">{phoneNumber}</span>
                  </span>
                )}
              </div>

              {refreshError && (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-4 text-[12px] text-amber-300/80"
                >
                  {refreshError}
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-5 flex items-center justify-between text-[12px] text-zinc-600">
          <span>Singulare {new Date().getFullYear()}</span>
          <Link
            href="/privacidade"
            className="hover:text-zinc-400 transition-colors"
          >
            Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
