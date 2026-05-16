'use client';

// Client componente do /v3/conectar/[token]. Polling em /api/conectar/[token]/status
// a cada 4s. Quando responde { status: 'connected' | 'open' }, mostra estado
// celebratorio e redireciona pro /painel apos 1.8s. Antes disso, exibe QR Code
// (base64) ou codigo de pareamento, com 3 passos numerados em gold.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BRAND_COLORS } from '../../_components/tokens';
import { EyebrowDash } from '../../_components/EyebrowDash';
import { Logo3Squares } from '../../_components/Logo3Squares';
import { CTAGoldOutline } from '../../_components/CTAGoldOutline';

interface ConnectClientV3Props {
  token: string;
}

type ConnectionState = 'loading' | 'awaiting' | 'connected' | 'error';

interface StatusResponse {
  status?: 'awaiting' | 'connected' | 'open' | 'error' | string;
  qr_code_base64?: string | null;
  qr_string?: string | null;
  pairing_code?: string | null;
  phone_number?: string | null;
  clinic_name?: string | null;
  redirect_to?: string | null;
  message?: string | null;
}

const STATUS_POLL_MS = 4000;

export function ConnectClientV3({ token }: ConnectClientV3Props) {
  const router = useRouter();
  const [state, setState] = useState<ConnectionState>('loading');
  const [data, setData] = useState<StatusResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const statusUrl = useMemo(
    () => `/api/conectar/${encodeURIComponent(token)}/status`,
    [token],
  );
  const refreshUrl = useMemo(
    () => `/api/conectar/${encodeURIComponent(token)}/refresh-qr`,
    [token],
  );

  useEffect(() => {
    if (state === 'connected') return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(statusUrl, { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) {
            setState('error');
            setData({ message: `Nao foi possivel ler o status (${res.status}).` });
          }
          return;
        }
        const json: StatusResponse = await res.json();
        if (cancelled) return;
        setData(json);
        const s = (json.status || '').toLowerCase();
        if (s === 'connected' || s === 'open') {
          setState('connected');
        } else if (s === 'error') {
          setState('error');
        } else {
          setState('awaiting');
        }
      } catch (err) {
        if (!cancelled) {
          setState('error');
          setData({ message: err instanceof Error ? err.message : 'Erro de rede.' });
        }
      }
    };

    tick();
    const id = setInterval(tick, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [state, statusUrl]);

  useEffect(() => {
    if (state !== 'connected') return;
    const id = setTimeout(() => {
      router.push(data?.redirect_to || '/painel');
    }, 1800);
    return () => clearTimeout(id);
  }, [state, data, router]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(refreshUrl, {
        method: 'POST',
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        setData((prev) => ({ ...(prev || {}), ...json }));
      }
    } catch {
      // best-effort
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyPair = () => {
    if (!data?.pairing_code) return;
    navigator.clipboard.writeText(data.pairing_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <main
      style={{
        background: BRAND_COLORS.sand,
        minHeight: 'calc(100vh - 240px)',
        paddingTop: 56,
        paddingBottom: 96,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '0 clamp(20px, 5vw, 32px)',
        }}
      >
        {state === 'connected' ? (
          <ConnectedView clinicName={data?.clinic_name || null} />
        ) : (
          <AwaitingView
            state={state}
            data={data}
            copied={copied}
            refreshing={refreshing}
            onCopyPair={handleCopyPair}
            onRefresh={handleRefresh}
          />
        )}
      </div>
    </main>
  );
}

function ConnectedView({ clinicName }: { clinicName: string | null }) {
  return (
    <section
      style={{
        background: BRAND_COLORS.navy,
        color: BRAND_COLORS.sand,
        borderRadius: 8,
        padding: 'clamp(40px, 6vw, 64px)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255, 198, 47, 0.22), transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            background: BRAND_COLORS.gold,
            color: BRAND_COLORS.navy,
            borderRadius: '50%',
            marginBottom: 32,
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 36,
          }}
        >
          ✓
        </div>
        <div style={{ marginBottom: 18 }}>
          <EyebrowDash color={BRAND_COLORS.gold}>Tudo pronto</EyebrowDash>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 'clamp(28px, 5vw, 44px)',
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            color: BRAND_COLORS.sand,
            margin: 0,
            maxWidth: '20ch',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {clinicName ? `${clinicName} ` : ''}WhatsApp{' '}
          <span style={{ color: BRAND_COLORS.gold }}>conectado</span>.
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 16,
            color: 'rgba(244, 239, 230, 0.7)',
            marginTop: 18,
          }}
        >
          Sua secretaria IA ja esta atendendo. Estamos te levando pro painel.
        </p>
      </div>
    </section>
  );
}

function AwaitingView({
  state,
  data,
  copied,
  refreshing,
  onCopyPair,
  onRefresh,
}: {
  state: ConnectionState;
  data: StatusResponse | null;
  copied: boolean;
  refreshing: boolean;
  onCopyPair: () => void;
  onRefresh: () => void;
}) {
  const hasQr = !!data?.qr_code_base64;
  const hasPair = !!data?.pairing_code;

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <EyebrowDash>Pra comecar</EyebrowDash>
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-poppins)',
          fontWeight: 700,
          fontSize: 'clamp(32px, 5vw, 52px)',
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          color: BRAND_COLORS.navy,
          margin: 0,
          maxWidth: '20ch',
        }}
      >
        Conecte o WhatsApp{' '}
        <span style={{ color: BRAND_COLORS.gold }}>da clinica</span>.
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-space-grotesk)',
          fontSize: 16,
          lineHeight: 1.6,
          color: 'rgba(15, 27, 51, 0.7)',
          marginTop: 18,
          maxWidth: '50ch',
        }}
      >
        Abra o WhatsApp no celular, aponte a camera pra este QR ou cole o
        codigo de pareamento. A pagina atualiza sozinha quando conectar.
      </p>

      <div
        style={{
          marginTop: 40,
          background: '#fff',
          border: `1px solid rgba(15, 27, 51, 0.12)`,
          borderRadius: 8,
          padding: 'clamp(28px, 4vw, 44px)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 48,
          alignItems: 'center',
        }}
        className="v3-conectar-card"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
          }}
        >
          <QrPanel
            qrBase64={data?.qr_code_base64 || null}
            state={state}
          />
          {hasPair && (
            <div
              style={{
                width: '100%',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'rgba(15, 27, 51, 0.5)',
                  marginBottom: 10,
                }}
              >
                ou use o codigo
              </p>
              <button
                type="button"
                onClick={onCopyPair}
                style={{
                  background: BRAND_COLORS.sand,
                  border: `1px solid ${BRAND_COLORS.gold}`,
                  borderRadius: 999,
                  padding: '12px 22px',
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.18em',
                  color: BRAND_COLORS.navy,
                  cursor: 'pointer',
                }}
              >
                {copied ? 'Copiado!' : data?.pairing_code}
              </button>
            </div>
          )}
        </div>

        <ol
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {[
            {
              title: 'Abra o WhatsApp no celular da clinica',
              body: 'Toque nos tres pontos > Aparelhos conectados.',
            },
            {
              title: hasQr ? 'Toque em "Conectar aparelho" e escaneie o QR' : 'Cole o codigo de pareamento',
              body: hasQr
                ? 'Aponte a camera pro QR Code ao lado. Aguarde a confirmacao.'
                : 'Toque em "Conectar com numero" e insira o codigo do botao ao lado.',
            },
            {
              title: 'A pagina atualiza sozinha',
              body: 'Assim que o WhatsApp pareia, levamos voce pro painel.',
            },
          ].map((step, idx) => (
            <li key={idx} style={{ display: 'flex', gap: 14 }}>
              <span
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: BRAND_COLORS.gold,
                  color: BRAND_COLORS.navy,
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {idx + 1}
              </span>
              <div>
                <p
                  style={{
                    fontFamily: 'var(--font-poppins)',
                    fontWeight: 700,
                    fontSize: 15,
                    color: BRAND_COLORS.navy,
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {step.title}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-space-grotesk)',
                    fontSize: 13,
                    color: 'rgba(15, 27, 51, 0.65)',
                    margin: '6px 0 0 0',
                    lineHeight: 1.55,
                  }}
                >
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div
        style={{
          marginTop: 24,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 13,
            color: 'rgba(15, 27, 51, 0.55)',
          }}
        >
          {state === 'loading'
            ? 'Carregando codigo...'
            : state === 'error'
              ? data?.message || 'Erro de conexao. Tente atualizar.'
              : 'Aguardando voce parear o WhatsApp...'}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            background: 'transparent',
            border: `1px solid ${BRAND_COLORS.navy}`,
            borderRadius: 999,
            padding: '10px 18px',
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: BRAND_COLORS.navy,
            cursor: refreshing ? 'wait' : 'pointer',
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          {refreshing ? 'Atualizando...' : 'Atualizar QR'}
        </button>
      </div>

      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <CTAGoldOutline
          href="/v3/bem-vindo"
          label="Duvidas? Ver guia rapido"
          size="sm"
          color={BRAND_COLORS.navy}
        />
      </div>

      <style>{`
        @media (max-width: 720px) {
          .v3-conectar-card {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </>
  );
}

function QrPanel({
  qrBase64,
  state,
}: {
  qrBase64: string | null;
  state: ConnectionState;
}) {
  if (qrBase64) {
    const src = qrBase64.startsWith('data:')
      ? qrBase64
      : `data:image/png;base64,${qrBase64}`;
    return (
      <div
        style={{
          background: BRAND_COLORS.sand,
          border: `1px solid rgba(15, 27, 51, 0.12)`,
          borderRadius: 8,
          padding: 16,
          width: 240,
          height: 240,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="QR Code WhatsApp"
          width={208}
          height={208}
          style={{ display: 'block', maxWidth: '100%' }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        background: BRAND_COLORS.sand,
        border: `1px solid rgba(15, 27, 51, 0.12)`,
        borderRadius: 8,
        width: 240,
        height: 240,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
    >
      <Logo3Squares size={42} color={BRAND_COLORS.navy} ariaHidden />
      <p
        style={{
          fontFamily: 'var(--font-space-grotesk)',
          fontSize: 13,
          color: 'rgba(15, 27, 51, 0.6)',
          textAlign: 'center',
          padding: '0 24px',
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {state === 'error'
          ? 'QR indisponivel. Toque em "Atualizar QR".'
          : 'Gerando QR Code...'}
      </p>
    </div>
  );
}
