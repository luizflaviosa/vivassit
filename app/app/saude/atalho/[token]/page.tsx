'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { HeartPulse, Copy, Check, Loader2, ChevronRight, Smartphone } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';

interface PageState {
  loading: boolean;
  error: string | null;
  firstName: string;
  ingestUrl: string;
}

export default function AtalhoIosPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [state, setState] = useState<PageState>({
    loading: true,
    error: null,
    firstName: '',
    ingestUrl: '',
  });
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/saude/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setState({
            loading: false,
            error: null,
            firstName: j.patient.first_name,
            ingestUrl: `${window.location.origin}/api/saude/${token}/ingest`,
          });
        } else {
          setState({ loading: false, error: j.error ?? 'unknown_error', firstName: '', ingestUrl: '' });
        }
      })
      .catch((e) => setState({ loading: false, error: String(e), firstName: '', ingestUrl: '' }));
  }, [token]);

  const copy = async (text: string, stepId: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedStep(stepId);
    setTimeout(() => setCopiedStep(null), 2500);
  };

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-6">
        <div className="max-w-sm text-center">
          <div className="text-[48px] mb-4" style={{ color: ACCENT }}>—</div>
          <h1 className="text-[20px] font-semibold text-zinc-900 mb-2">Link invalido ou expirado</h1>
          <p className="text-[13px] text-zinc-500">
            Pede pra sua clinica gerar um novo link.
          </p>
        </div>
      </div>
    );
  }

  const requestBodyTemplate = `{
  "observations": [
    { "loinc_code": "8867-4", "value": [VARIAVEL_FC] },
    { "loinc_code": "55423-8", "value": [VARIAVEL_PASSOS] },
    { "loinc_code": "29463-7", "value": [VARIAVEL_PESO] }
  ]
}`;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-black/[0.06] px-5 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <HeartPulse className="w-5 h-5" style={{ color: ACCENT }} />
          <span className="text-[13px] uppercase tracking-[0.12em] font-semibold text-zinc-500">
            Singulare Saude · Atalho iOS
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8">
        <div className="mb-8">
          <h1 className="text-[28px] font-medium tracking-[-0.02em] text-zinc-900 mb-2">
            Ola, {state.firstName}
          </h1>
          <p className="text-[15px] text-zinc-600 leading-relaxed">
            Voce vai criar um <strong>Atalho no iPhone</strong> que envia automaticamente seus dados de saude pra clinica todo dia, sem precisar abrir nenhum app. Funciona com o app <strong>Atalhos</strong> que ja vem instalado no seu iPhone.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 text-violet-800">
            <Smartphone className="w-3.5 h-3.5" />
            <span className="text-[12px] font-medium">Voce precisa de um iPhone com iOS 14 ou superior</span>
          </div>
        </div>

        <ol className="space-y-6">
          <Step n={1} title="Abrir o app Atalhos">
            <p>No seu iPhone, abra o app <strong>Atalhos</strong> (icone roxo com 2 quadrados sobrepostos). Ele ja vem instalado de fabrica.</p>
            <p className="text-[12px] text-zinc-500 italic">Se nao encontrou, busque por &ldquo;Atalhos&rdquo; no Spotlight (arrasta tela inicial pra baixo).</p>
          </Step>

          <Step n={2} title="Criar novo atalho">
            <p>Toque no <strong>+</strong> no canto superior direito.</p>
            <p>Toque em <strong>Adicionar Acao</strong>.</p>
          </Step>

          <Step n={3} title="Adicionar leitura da frequencia cardiaca">
            <p>Na busca, digite <strong>Procurar Amostras de Saude</strong>.</p>
            <p>Toque na acao que aparecer. Configure:</p>
            <ul className="ml-5 list-disc text-[14px] text-zinc-700 space-y-1">
              <li><strong>Tipo</strong>: Frequencia Cardiaca</li>
              <li><strong>Ordenado por</strong>: Data de Termino</li>
              <li><strong>Limite</strong>: 1 (so a mais recente)</li>
            </ul>
            <p>Depois toque no resultado e renomeie a variavel pra <strong>FC</strong> (toque na pilula que aparece em cima do teclado).</p>
          </Step>

          <Step n={4} title="Repetir pra peso e passos">
            <p>Toque em <strong>+</strong> embaixo da ultima acao e repita o passo 3 pra cada um:</p>
            <ul className="ml-5 list-disc text-[14px] text-zinc-700 space-y-1">
              <li>Tipo <strong>Peso Corporal</strong> → renomeia variavel pra <strong>PESO</strong></li>
              <li>Tipo <strong>Contagem de Passos</strong> → renomeia pra <strong>PASSOS</strong></li>
            </ul>
            <p className="text-[12px] text-zinc-500">Pode adicionar mais (pressao, glicose, SpO2, sono) seguindo o mesmo padrao.</p>
          </Step>

          <Step n={5} title="Enviar dados pro Singulare">
            <p>Adicione uma acao chamada <strong>Obter Conteudo do URL</strong>.</p>
            <p>Toque na palavra <strong>URL</strong> e cole:</p>
            <CopyBlock
              stepId={5}
              copied={copiedStep === 5}
              text={state.ingestUrl}
              onCopy={() => copy(state.ingestUrl, 5)}
            />
            <p className="mt-3">Toque na seta <strong>{'>'}</strong> ao lado de Mostrar Mais e configure:</p>
            <ul className="ml-5 list-disc text-[14px] text-zinc-700 space-y-1">
              <li><strong>Metodo</strong>: POST</li>
              <li><strong>Solicitar Cabecalhos</strong>: adicione <code className="bg-zinc-100 px-1 rounded text-[12px]">Content-Type</code> com valor <code className="bg-zinc-100 px-1 rounded text-[12px]">application/json</code></li>
              <li><strong>Corpo da Solicitacao</strong>: JSON</li>
            </ul>
          </Step>

          <Step n={6} title="Montar o corpo JSON">
            <p>Em <strong>JSON</strong>, monte a estrutura abaixo. Em cada campo &ldquo;Numero&rdquo;, toque pra inserir a variavel correspondente (FC, PESO, PASSOS):</p>
            <CopyBlock
              stepId={6}
              copied={copiedStep === 6}
              text={requestBodyTemplate}
              onCopy={() => copy(requestBodyTemplate, 6)}
              mono
            />
            <p className="text-[12px] text-zinc-500 italic">
              Onde tem <code>[VARIAVEL_FC]</code> voce coloca a variavel FC do passo 3. Idem PESO e PASSOS.
            </p>
            <p className="text-[13px] mt-2">
              Codigos LOINC (nao precisa entender, so manter): <strong>8867-4</strong>=FC, <strong>55423-8</strong>=passos, <strong>29463-7</strong>=peso.
            </p>
          </Step>

          <Step n={7} title="Salvar e nomear">
            <p>Toque em <strong>Concluir</strong> (ou no nome do atalho no topo) e renomeie pra <strong>Singulare Saude</strong>.</p>
            <p>Pronto. O atalho ja roda manualmente — basta tocar nele no app Atalhos.</p>
          </Step>

          <Step n={8} title="Automatizar pra rodar sozinho todo dia">
            <p>Volte pra tela inicial do app Atalhos e toque em <strong>Automacao</strong> embaixo.</p>
            <p>Toque <strong>+</strong> → <strong>Nova Automacao</strong> → <strong>Hora do Dia</strong>.</p>
            <p>Configure:</p>
            <ul className="ml-5 list-disc text-[14px] text-zinc-700 space-y-1">
              <li><strong>Hora</strong>: 08:00 (ou quando preferir)</li>
              <li><strong>Repetir</strong>: Diariamente</li>
              <li><strong>Executar imediatamente</strong>: <strong>ATIVADO</strong> (importante — evita confirmacao manual)</li>
            </ul>
            <p>Toque em <strong>Avancar</strong>, depois adicione a acao <strong>Executar Atalho</strong> e selecione <strong>Singulare Saude</strong>.</p>
            <p>Toque em <strong>Concluido</strong>. Pronto, vai rodar automaticamente todos os dias.</p>
          </Step>
        </ol>

        <div className="mt-10 p-5 rounded-2xl bg-violet-50 border border-violet-100">
          <h3 className="text-[14px] font-semibold text-violet-900 mb-2">Como saber se ta funcionando?</h3>
          <p className="text-[13px] text-violet-800 leading-relaxed">
            Toque uma vez no atalho <strong>Singulare Saude</strong> manualmente no app Atalhos. Se nao deu erro, ta tudo certo — sua clinica ja viu os dados no painel dela.
          </p>
          <p className="text-[12px] text-violet-700 mt-3">
            Voce pode editar o atalho depois pra incluir pressao, sono, SpO2 e outros — me peca instrucoes se quiser adicionar mais.
          </p>
        </div>

        <div className="mt-8 text-center">
          <a href="/privacidade/saude" className="text-[12px] text-zinc-500 underline">
            Politica de privacidade
          </a>
        </div>
      </main>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="bg-white rounded-2xl border border-black/[0.06] p-5">
      <div className="flex items-start gap-4">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
        >
          {n}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-semibold text-zinc-900 mb-2">{title}</h2>
          <div className="text-[14px] text-zinc-700 space-y-2 leading-relaxed">{children}</div>
        </div>
      </div>
    </li>
  );
}

function CopyBlock({
  stepId, copied, text, onCopy, mono = false,
}: {
  stepId: number; copied: boolean; text: string; onCopy: () => void; mono?: boolean;
}) {
  void stepId;
  return (
    <div className="mt-2 rounded-lg bg-zinc-900 text-zinc-100 p-3 flex items-start gap-3">
      <pre className={`flex-1 text-[12px] overflow-x-auto ${mono ? 'font-mono' : 'font-mono'} whitespace-pre-wrap break-all`}>{text}</pre>
      <button
        type="button"
        onClick={onCopy}
        className="flex-shrink-0 h-8 px-2.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

void ChevronRight;
