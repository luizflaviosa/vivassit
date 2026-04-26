'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';

interface Variant {
  id: 'a' | 'b' | 'c';
  name: string;
  tagline: string;
  description: string;
  bg: string; // preview bg
  src: string;
  notes: string[];
}

const VARIANTS: Variant[] = [
  {
    id: 'a',
    name: 'Refined',
    tagline: 'Apple · Linear · clean',
    description:
      'Quadrados em linha violeta sobre fundo claro. Wordmark sans com tracking alto. Premium e neutro — funciona em qualquer contexto.',
    bg: '#FAFAF7',
    src: '/logos/singulare-a.svg',
    notes: ['Sans-serif moderna', 'Hairline 2.2px violet', 'Letter-spacing alto'],
  },
  {
    id: 'b',
    name: 'Editorial',
    tagline: 'Vercel · Stripe · sophisticated',
    description:
      'Fundo dark, gradient sutil violet→pink, descritor serif italic abaixo. Posicionamento mais "tech editorial" — rico em personalidade.',
    bg: '#18181B',
    src: '/logos/singulare-b.svg',
    notes: ['Dark mode nativo', 'Gradient violet→pink', 'Serif italic descritor'],
  },
  {
    id: 'c',
    name: 'Soft',
    tagline: 'Cuidado · warm · healthcare',
    description:
      'Quadrados arredondados com transparências em camadas. Tipografia mista (capital + descritor pequeno). Mais aproximável — bom pra contexto clínico/saúde.',
    bg: '#FAFAF7',
    src: '/logos/singulare-c.svg',
    notes: ['Cantos arredondados', 'Camadas com opacidade', 'Tom mais humano'],
  },
];

export default function LogosPage() {
  const [picked, setPicked] = useState<Variant['id'] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-zinc-900">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="mb-12">
          <span
            className="inline-block text-[11px] font-semibold uppercase tracking-[0.14em] mb-3"
            style={{ color: ACCENT_DEEP }}
          >
            Identidade visual
          </span>
          <h1 className="text-[40px] sm:text-[52px] leading-[1.05] tracking-[-0.03em] font-medium text-zinc-900 mb-3">
            Logo <span className="font-serif italic font-normal text-zinc-700">Singulare</span>
          </h1>
          <p className="text-[16px] text-zinc-500 max-w-xl leading-relaxed">
            3 propostas, mesma assinatura (3 quadrados sobrepostos). Escolhe a que mais combina e
            implemento globalmente — landing, painel, login, emails.
          </p>
        </div>

        <div className="grid gap-6">
          {VARIANTS.map((v) => {
            const isPicked = picked === v.id;
            return (
              <div
                key={v.id}
                className={`group rounded-2xl border bg-white overflow-hidden transition-all ${
                  isPicked
                    ? 'border-violet-300 shadow-[0_0_0_4px_rgba(110,86,207,0.10)]'
                    : 'border-black/[0.07] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-black/[0.12]'
                }`}
              >
                <div
                  className="px-8 sm:px-12 py-12 sm:py-14 flex items-center justify-center min-h-[220px]"
                  style={{ background: v.bg }}
                >
                  <Image
                    src={v.src}
                    alt={`Singulare ${v.name}`}
                    width={480}
                    height={160}
                    className="max-w-full h-auto"
                    priority
                  />
                </div>

                <div className="p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-white text-[13px] font-bold uppercase"
                        style={{ background: ACCENT_DEEP }}
                      >
                        {v.id}
                      </span>
                      <h3 className="text-[20px] font-medium tracking-[-0.015em] text-zinc-900">
                        {v.name}
                      </h3>
                      <span className="text-[12px] text-zinc-400 font-medium">— {v.tagline}</span>
                    </div>
                    <p className="text-[14px] text-zinc-600 leading-relaxed mb-2">
                      {v.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {v.notes.map((n) => (
                        <span
                          key={n}
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(v.src)}
                      className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-[12.5px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                      title="Copiar caminho"
                    >
                      {copied === v.src ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copied === v.src ? 'Copiado' : 'Path'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPicked(v.id)}
                      className={`h-10 px-5 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-semibold transition-all ${
                        isPicked
                          ? 'text-white'
                          : 'text-zinc-900 border border-zinc-300 hover:border-zinc-900'
                      }`}
                      style={
                        isPicked
                          ? {
                              background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                              boxShadow:
                                '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 6px 18px -6px rgba(110,86,207,0.45)',
                            }
                          : undefined
                      }
                    >
                      {isPicked ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Escolhida
                        </>
                      ) : (
                        'Escolher essa'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {picked && (
          <div className="mt-8 rounded-xl border border-violet-200 bg-violet-50/40 p-5">
            <p className="text-[14px] text-zinc-700 leading-relaxed">
              <strong>Variant {picked.toUpperCase()}</strong> escolhida. Me avisa no chat e eu
              substituo o logo da CDN antiga em todas as telas (landing, painel, login,
              onboarding, configurar-senha, checkout, termos, privacidade).
            </p>
          </div>
        )}

        <p className="text-center text-[12px] text-zinc-400 mt-12">
          Página interna de preview · não indexada
        </p>
      </div>
    </div>
  );
}
