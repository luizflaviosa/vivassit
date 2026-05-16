'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';

const ACCENT = '#0F1B33';
const ACCENT_DEEP = '#0F1B33';
const ACCENT_SOFT = '#F5F3FF';

interface Props {
  tenantId: string;
  qrCodeBase64?: string | null;
  pairingCode?: string | null;
  phoneNumber?: string | null;
  /** Optional callback when connection is detected (for parent-managed flows) */
  onConnected?: () => void;
}

export function WhatsAppConnect({ tenantId, qrCodeBase64, pairingCode, phoneNumber, onConnected }: Props) {
  const hasQr = !!qrCodeBase64;
  const hasPair = !!pairingCode;
  const reducedMotion = useReducedMotion();

  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);

  // Polling — checks /api/onboarding/status every 4s until connected
  useEffect(() => {
    if (!tenantId || connected) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/onboarding/status?tenant_id=${encodeURIComponent(tenantId)}`);
        if (!res.ok) return;
        const json = await res.json();
        const s = json.evolution_status as string | undefined;
        if (!cancelled && (s === 'open' || s === 'connected')) {
          setConnected(true);
          clearInterval(interval);
          onConnected?.();
        }
      } catch {
        // best-effort polling
      }
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tenantId, connected, onConnected]);

  if (!hasQr && !hasPair) return null;

  const copyPair = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // CONNECTED — celebratory hero
  if (connected) {
    return (
      <div className="relative">
        {!reducedMotion && (
          <div className="pointer-events-none absolute inset-0 -m-12 overflow-hidden">
            {Array.from({ length: 14 }).map((_, i) => {
              const angle = (i / 14) * Math.PI * 2;
              const distance = 100 + Math.random() * 60;
              return (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance,
                    scale: [0, 1, 0.4],
                  }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: i * 0.015 }}
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                  style={{ background: i % 3 === 0 ? '#10b981' : ACCENT }}
                />
              );
            })}
          </div>
        )}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          className="relative text-center py-10 sm:py-14"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
            className="mx-auto mb-6 inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_12px_40px_-12px_rgba(16,185,129,0.55)]"
          >
            <Check className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={2.75} />
          </motion.div>
          <h2 className="text-[clamp(28px,6vw,40px)] tracking-[-0.02em] font-medium leading-[1.08] text-zinc-900 mb-3">
            <span className="font-serif italic font-normal text-zinc-600">Tudo pronto.</span>
          </h2>
          <p className="text-[15px] sm:text-[17px] text-zinc-500 max-w-md mx-auto leading-relaxed">
            Sua secretária IA já está atendendo no WhatsApp.
          </p>
        </motion.div>
      </div>
    );
  }

  // PAIR / QR — AirPods Pairing-style hero
  return (
    <div className="text-center">
      {/* Phone illustration — only in pair mode, not reduced motion */}
      {!reducedMotion && hasPair && !showQr && (
        <motion.div
          className="mx-auto mb-7 sm:mb-9"
          animate={{ y: [-2, 2, -2] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <PhoneIllustration accent={ACCENT} accentSoft={ACCENT_SOFT} />
        </motion.div>
      )}

      {/* Hero copy */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-[clamp(26px,5.5vw,38px)] tracking-[-0.02em] font-medium leading-[1.08] mb-2 text-zinc-900"
      >
        <span className="font-serif italic font-normal text-zinc-600">Pronto.</span>{' '}
        {showQr ? 'Aponte a câmera.' : 'Cole o código no WhatsApp.'}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="text-[14px] sm:text-[15px] text-zinc-500 mb-8 sm:mb-10"
      >
        {phoneNumber ? (
          <>
            Número: <span className="text-zinc-900 font-medium">{phoneNumber}</span>
          </>
        ) : (
          'Conecte o WhatsApp da clínica'
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
              className="group block mx-auto w-full max-w-md py-9 sm:py-12 px-4 bg-white rounded-3xl border border-black/[0.06] shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_40px_-12px_rgba(110,86,207,0.18)] transition-shadow"
              title="Toque pra copiar"
              aria-label={`Pair code ${pairingCode}, toque pra copiar`}
            >
              <code
                className="block font-mono font-semibold leading-none"
                style={{
                  color: ACCENT,
                  fontSize: 'clamp(38px, 11vw, 68px)',
                  letterSpacing: '0.16em',
                }}
              >
                {pairingCode}
              </code>
              <p className="mt-5 text-[11px] uppercase tracking-[0.14em] font-medium flex items-center justify-center gap-1.5">
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                    <span className="text-emerald-700">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-zinc-400" />
                    <span className="text-zinc-400">Toque pra copiar</span>
                  </>
                )}
              </p>
            </motion.button>

            <ol className="mt-9 sm:mt-10 max-w-sm mx-auto space-y-3.5 text-left">
              {[
                'Abra o WhatsApp no celular da clínica',
                <>
                  Vá em{' '}
                  <strong className="text-zinc-900 font-medium">
                    Aparelhos conectados → Conectar com número
                  </strong>
                </>,
                'Cole o código',
              ].map((step, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-[14px] sm:text-[15px] text-zinc-600 leading-relaxed"
                >
                  <span
                    className="flex-shrink-0 mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold"
                    style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
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
            <div className="mx-auto inline-block bg-white p-4 rounded-3xl border border-black/[0.06] shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeBase64!}
                alt="QR Code WhatsApp"
                className="w-56 h-56 sm:w-64 sm:h-64"
              />
            </div>
            <ol className="mt-9 sm:mt-10 max-w-sm mx-auto space-y-3.5 text-left">
              {[
                'Abra o WhatsApp no celular da clínica',
                <>
                  Vá em{' '}
                  <strong className="text-zinc-900 font-medium">
                    Aparelhos conectados → Conectar dispositivo
                  </strong>
                </>,
                'Aponte a câmera pro QR Code',
              ].map((step, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-[14px] sm:text-[15px] text-zinc-600 leading-relaxed"
                >
                  <span
                    className="flex-shrink-0 mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold"
                    style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
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

      {/* Status + toggle row */}
      <div className="mt-10 sm:mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[12px] text-zinc-500">
        <span className="inline-flex items-center gap-2" aria-live="polite">
          <motion.span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: ACCENT }}
            animate={reducedMotion ? {} : { opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          Aguardando conexão
        </span>
        {hasQr && hasPair && (
          <button
            onClick={() => setShowQr(!showQr)}
            className="hover:text-zinc-900 transition-colors underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
          >
            {showQr ? 'Voltar pro código' : 'Prefiro QR Code'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Small SVG phone with breathing wifi-pulse on screen.
 * Decorative only — aria-hidden.
 */
function PhoneIllustration({ accent, accentSoft }: { accent: string; accentSoft: string }) {
  return (
    <svg
      width="60"
      height="84"
      viewBox="0 0 60 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="opacity-90"
    >
      <rect x="3" y="3" width="54" height="78" rx="10" fill="white" stroke={accent} strokeWidth="1.5" />
      <rect x="24" y="6.5" width="12" height="2" rx="1" fill={accent} opacity="0.35" />
      {/* concentric pulses */}
      <motion.circle
        cx="30"
        cy="42"
        r="20"
        stroke={accent}
        strokeWidth="0.8"
        fill="none"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: [0, 0.45, 0], scale: [0.7, 1.1, 1.4] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
        style={{ transformOrigin: '30px 42px' }}
      />
      <motion.circle
        cx="30"
        cy="42"
        r="13"
        stroke={accent}
        strokeWidth="1"
        fill="none"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: [0, 0.6, 0], scale: [0.7, 1.1, 1.4] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
        style={{ transformOrigin: '30px 42px' }}
      />
      <motion.circle
        cx="30"
        cy="42"
        r="6"
        fill={accent}
        animate={{ opacity: [0.35, 0.8, 0.35], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '30px 42px' }}
      />
      <rect x="22" y="74" width="16" height="2" rx="1" fill={accent} opacity="0.3" />
    </svg>
  );
}
