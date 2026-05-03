'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check } from 'lucide-react';

const ACCENT = '#6E56CF';

interface Props {
  tenantId: string;
  qrCodeBase64?: string | null;
  pairingCode?: string | null;
  phoneNumber?: string | null;
  /** Optional callback when connection is detected (for parent-managed flows) */
  onConnected?: () => void;
}

type Method = 'pair' | 'qr';

export function WhatsAppConnect({ tenantId, qrCodeBase64, pairingCode, phoneNumber, onConnected }: Props) {
  const hasQr = !!qrCodeBase64;
  const hasPair = !!pairingCode;

  const [method, setMethod] = useState<Method>(hasPair ? 'pair' : 'qr');
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (hasPair) setMethod('pair');
    else if (hasQr) setMethod('qr');
  }, [hasPair, hasQr]);

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
          if (onConnected) onConnected();
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

  if (connected) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
        className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 to-white p-6 sm:p-7 text-center"
      >
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05, type: 'spring', stiffness: 260, damping: 18 }}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.55)] mb-4"
        >
          <Check className="w-6 h-6" strokeWidth={3} />
        </motion.div>
        <p className="text-[20px] sm:text-[22px] tracking-[-0.01em] font-medium text-emerald-950">
          <span className="font-serif italic font-normal">Tudo pronto.</span> Sua secretária IA já está atendendo.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/[0.07] bg-white p-6 sm:p-7">
      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-[0.1em] text-zinc-400 font-medium mb-1.5">
          Conectar WhatsApp
        </p>
        <p className="text-[15px] text-zinc-900 font-medium leading-snug">
          {phoneNumber ? `Cole o código no WhatsApp ${phoneNumber}` : 'Cole o código no WhatsApp da clínica'}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {method === 'pair' && hasPair && (
          <motion.div
            key="pair"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <button
              onClick={copyPair}
              className="group w-full flex items-center justify-center gap-3 mb-5 py-8 bg-zinc-50 hover:bg-zinc-100 rounded-xl border border-black/[0.04] transition-colors"
              title="Toque pra copiar"
            >
              <code
                className="font-mono text-[30px] sm:text-[36px] tracking-[0.18em] font-semibold"
                style={{ color: ACCENT }}
              >
                {pairingCode}
              </code>
              <span className="h-11 w-11 rounded-md border border-black/[0.08] flex items-center justify-center bg-white">
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />
                ) : (
                  <Copy className="w-4 h-4 text-zinc-600" />
                )}
              </span>
            </button>

            <ol className="text-[14px] text-zinc-700 space-y-2.5 leading-relaxed">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-semibold flex items-center justify-center">1</span>
                <span>Abra o WhatsApp no celular da clínica</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-semibold flex items-center justify-center">2</span>
                <span>Vá em <strong>Aparelhos conectados → Conectar com número</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-semibold flex items-center justify-center">3</span>
                <span>Digite o código acima</span>
              </li>
            </ol>
          </motion.div>
        )}

        {method === 'qr' && hasQr && (
          <motion.div
            key="qr"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex justify-center mb-5 bg-white p-3 rounded-xl border border-black/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeBase64!} alt="QR Code WhatsApp" className="w-56 h-56" />
            </div>
            <ol className="text-[14px] text-zinc-700 space-y-2.5 leading-relaxed">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-semibold flex items-center justify-center">1</span>
                <span>Abra o WhatsApp no celular da clínica</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-semibold flex items-center justify-center">2</span>
                <span>Vá em <strong>Aparelhos conectados → Conectar dispositivo</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-semibold flex items-center justify-center">3</span>
                <span>Aponte a câmera pro QR Code</span>
              </li>
            </ol>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 pt-4 border-t border-black/[0.05] flex items-center justify-between gap-3">
        <p className="text-[12px] text-zinc-500 flex items-center gap-2">
          <motion.span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: ACCENT }}
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          Conectando...
        </p>
        {hasQr && hasPair && (
          <button
            onClick={() => setMethod(method === 'pair' ? 'qr' : 'pair')}
            className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors underline-offset-2 hover:underline"
          >
            {method === 'pair' ? 'Prefiro QR Code' : 'Prefiro código'}
          </button>
        )}
      </div>
    </div>
  );
}
