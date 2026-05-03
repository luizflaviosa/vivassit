'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, QrCode, Copy, Check } from 'lucide-react';

const ACCENT = '#6E56CF';

interface Props {
  tenantId: string;
  qrCodeBase64?: string | null;
  pairingCode?: string | null;
  phoneNumber?: string | null;
}

type Method = 'pair' | 'qr';

function detectMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
}

export function WhatsAppConnect({ tenantId, qrCodeBase64, pairingCode, phoneNumber }: Props) {
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
        }
      } catch {
        // best-effort polling
      }
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tenantId, connected]);

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
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 flex items-center gap-3"
      >
        <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-[0_4px_12px_-4px_rgba(16,185,129,0.45)]">
          <Check className="w-5 h-5" strokeWidth={3} />
        </div>
        <div>
          <p className="font-medium text-emerald-900">WhatsApp conectado</p>
          <p className="text-[13px] text-emerald-700">A IA já pode atender pacientes nesse número.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-400 font-medium mb-1">
            Conectar WhatsApp
          </p>
          <p className="text-[13px] text-zinc-600">
            {phoneNumber ? `Número: ${phoneNumber}` : 'Conecte o WhatsApp da clínica'}
          </p>
        </div>
        {hasQr && hasPair && (
          <div className="inline-flex rounded-md border border-black/[0.08] p-0.5 text-[12px] flex-shrink-0">
            <button
              onClick={() => setMethod('pair')}
              className={`px-2.5 py-1 rounded transition-colors ${
                method === 'pair' ? 'bg-zinc-900 text-white' : 'text-zinc-600'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 inline mr-1" /> Código
            </button>
            <button
              onClick={() => setMethod('qr')}
              className={`px-2.5 py-1 rounded transition-colors ${
                method === 'qr' ? 'bg-zinc-900 text-white' : 'text-zinc-600'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 inline mr-1" /> QR
            </button>
          </div>
        )}
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
            <div className="flex items-center justify-center gap-2 mb-4 py-7 bg-zinc-50 rounded-lg border border-black/[0.04]">
              <code
                className="font-mono text-[28px] sm:text-[32px] tracking-[0.18em] font-semibold text-zinc-900"
                style={{ color: ACCENT }}
              >
                {pairingCode}
              </code>
              <button
                onClick={copyPair}
                className="ml-2 h-9 w-9 rounded-md border border-black/[0.08] hover:border-black/20 flex items-center justify-center transition-colors"
                title="Copiar código"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-600" />
                )}
              </button>
            </div>
            <ol className="text-[13px] text-zinc-600 space-y-1.5 list-decimal list-inside">
              <li>Abra o WhatsApp no celular</li>
              <li>
                Toque em{' '}
                <strong className="text-zinc-900">
                  Configurações → Aparelhos conectados → Conectar dispositivo
                </strong>
              </li>
              <li>
                Escolha <strong className="text-zinc-900">&ldquo;Conectar com número de telefone&rdquo;</strong>
              </li>
              <li>Digite o código acima</li>
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
            <div className="flex justify-center mb-4 bg-white p-3 rounded-lg border border-black/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeBase64!} alt="QR Code WhatsApp" className="w-56 h-56" />
            </div>
            <ol className="text-[13px] text-zinc-600 space-y-1.5 list-decimal list-inside">
              <li>Abra o WhatsApp no celular</li>
              <li>
                Toque em{' '}
                <strong className="text-zinc-900">
                  Configurações → Aparelhos conectados → Conectar dispositivo
                </strong>
              </li>
              <li>Aponte a câmera pra esse QR Code</li>
            </ol>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-4 text-[11px] text-zinc-400 flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
        Aguardando conexão... O código expira em ~3 minutos. Atualize a página se vencer.
      </p>
    </div>
  );
}
