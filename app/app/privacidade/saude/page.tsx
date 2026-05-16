import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacidade dos dados de saude — Singulare',
  description: 'Politica de privacidade especifica para coleta e uso de biomarcadores no Singulare (LGPD).',
};

export default function PrivacidadeSaudePage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-zinc-500 mb-2">
            Singulare · Politica de privacidade
          </p>
          <h1 className="text-[34px] font-medium tracking-[-0.02em] text-zinc-900">
            Dados de saude
          </h1>
          <p className="text-[14px] text-zinc-500 mt-2">
            Ultima atualizacao: 10 de maio de 2026
          </p>
        </div>

        <Section title="Resumo em 60 segundos">
          <p>
            O Singulare ajuda sua clinica a acompanhar biomarcadores (frequencia cardiaca, pressao arterial, peso, glicemia, sono, atividade fisica). A coleta acontece apenas com o seu consentimento, atraves de um link enviado pela clinica ou pelo aplicativo Singulare Saude.
          </p>
          <ul>
            <li>Coletamos so o que voce optar por informar ou autorizar.</li>
            <li>So a sua clinica e os profissionais autorizados por ela tem acesso.</li>
            <li>Dados sao apagados automaticamente apos 24 meses.</li>
            <li>Voce pode pedir exclusao ou portabilidade a qualquer momento.</li>
          </ul>
        </Section>

        <Section title="1. O que coletamos">
          <p>Conforme a sua autorizacao em cada canal:</p>
          <h3>Via link web (sem app)</h3>
          <ul>
            <li>Frequencia cardiaca (bpm)</li>
            <li>Pressao arterial sistolica e diastolica (mmHg)</li>
            <li>Peso (kg)</li>
            <li>Temperatura corporal (graus Celsius)</li>
            <li>Saturacao de oxigenio - SpO2 (%)</li>
            <li>Glicemia (mg/dL)</li>
          </ul>
          <h3>Via aplicativo Singulare Saude (iOS / Android)</h3>
          <p>Alem dos dados acima, o app le com a sua permissao explicita do Apple Health ou Health Connect:</p>
          <ul>
            <li>Variabilidade da frequencia cardiaca (HRV)</li>
            <li>Batimentos em repouso e durante atividade</li>
            <li>Numero de passos, distancia caminhada, energia ativa</li>
            <li>Fases de sono (acordado, leve, profundo, REM)</li>
          </ul>
          <h3>Metadados tecnicos</h3>
          <ul>
            <li>Modelo do celular, versao do sistema operacional e do aplicativo</li>
            <li>Data e hora de cada medicao</li>
            <li>Identificador anonimo do dispositivo (UUID gerado localmente, nao associado a IMEI ou numero de serie)</li>
            <li>Endereco IP e User-Agent no momento do consentimento</li>
          </ul>
          <p className="text-[13px] text-zinc-500 italic">
            Nao coletamos: localizacao em tempo real, conteudo de mensagens, lista de contatos, fotos da galeria, microfone, camera, ou qualquer dado fora dos biomarcadores acima.
          </p>
        </Section>

        <Section title="2. Por que coletamos (base legal LGPD)">
          <p>
            A coleta tem base no <strong>consentimento explicito</strong> do titular dos dados (LGPD art. 7, I e art. 11, I), registrado:
          </p>
          <ul>
            <li>No momento em que voce abre o link de coleta web pela primeira vez, com IP e User-Agent associados.</li>
            <li>No momento em que voce concede permissao ao aplicativo para ler Apple Health ou Health Connect.</li>
          </ul>
          <p>
            Finalidades:
          </p>
          <ul>
            <li>Permitir que a sua clinica acompanhe sua evolucao clinica entre consultas.</li>
            <li>Apoiar decisoes medicas com dados objetivos (nao substituir o diagnostico do profissional).</li>
            <li>Eventualmente, com o seu consentimento adicional especifico (consent_type=ai_inference), alimentar modelos preditivos para detectar precocemente anomalias cardiovasculares.</li>
          </ul>
        </Section>

        <Section title="3. Quem tem acesso">
          <p>
            Os seus dados de saude no Singulare sao acessiveis exclusivamente por:
          </p>
          <ul>
            <li>Profissionais (medicos, enfermeiros, recepcao) ativamente vinculados a clinica que enviou o link/app para voce. Esse vinculo e gerenciado pela propria clinica e pode ser verificado solicitando ao DPO da clinica.</li>
            <li>Voce mesmo, pelo link enviado pela clinica ou pelo aplicativo Singulare Saude.</li>
            <li>Equipe tecnica Singulare em casos pontuais de suporte ou auditoria de seguranca, sob acordo de confidencialidade e log auditavel.</li>
          </ul>
          <p>
            <strong>Nao vendemos seus dados, nao compartilhamos com terceiros para marketing, e nao usamos para publicidade.</strong> Em hipotese alguma.
          </p>
        </Section>

        <Section title="4. Por quanto tempo guardamos">
          <p>
            Dados de monitoramento (esta politica): <strong>24 meses</strong> a partir da coleta. Apagados automaticamente todo dia 1 do mes via rotina automatizada de retencao (LGPD art. 16, III - minimizacao).
          </p>
          <p>
            Dados do prontuario formal da clinica (consultas, prescricoes, atestados, exames) seguem prazo do Conselho Federal de Medicina (Resolucao CFM 1.821/2007 - <strong>20 anos a partir do ultimo registro</strong>) e ficam em tabelas separadas com outra politica. Esses NAO sao afetados pela politica de monitoramento.
          </p>
          <p>
            Registros de consentimento (LGPD art. 8) sao mantidos pelo mesmo prazo do dado correspondente.
          </p>
        </Section>

        <Section title="5. Seus direitos">
          <p>
            Conforme a LGPD (art. 18), voce pode a qualquer momento:
          </p>
          <ul>
            <li><strong>Confirmar</strong> se tratamos seus dados.</li>
            <li><strong>Acessar</strong> tudo que coletamos sobre voce - pelo proprio link de coleta ou pelo app.</li>
            <li><strong>Corrigir</strong> dados imprecisos.</li>
            <li><strong>Anonimizar, bloquear ou eliminar</strong> dados desnecessarios ou excessivos.</li>
            <li><strong>Portar</strong> seus dados (exportacao em JSON via solicitacao).</li>
            <li><strong>Eliminar</strong> dados tratados com base no consentimento - apaga tudo de monitoramento (prontuario formal pode ter prazo legal proprio).</li>
            <li><strong>Revogar o consentimento</strong> - basta pedir a clinica ou enviar email pra DPO@singulare.org.</li>
            <li><strong>Saber</strong> com quem compartilhamos seus dados (nesse momento: ninguem alem da sua clinica).</li>
            <li><strong>Reclamar</strong> a Autoridade Nacional de Protecao de Dados (ANPD).</li>
          </ul>
        </Section>

        <Section title="6. Como pedimos consentimento">
          <ul>
            <li><strong>Web (link):</strong> ao abrir o link pela primeira vez, registramos automaticamente seu consentimento para <em>health_monitoring</em>, com IP e User-Agent. Voce pode fechar a aba se nao concorda - sem coleta de dados clinicos sem voce inserir.</li>
            <li><strong>App mobile:</strong> ao abrir o app, voce ve uma tela explicando exatamente o que sera lido do Apple Health / Health Connect. Sem ela, nada e coletado. A permissao pode ser revogada a qualquer momento nas configuracoes do sistema (Saude no iOS, Health Connect no Android).</li>
            <li><strong>IA e inferencia preditiva:</strong> consentimento SEPARADO (<em>ai_inference</em>) que pediremos especificamente quando essa funcionalidade for habilitada na sua clinica. Voce pode aceitar monitoramento sem aceitar uso pra IA.</li>
          </ul>
        </Section>

        <Section title="7. Seguranca">
          <ul>
            <li>Todo trafego e criptografado em transito (TLS 1.3).</li>
            <li>Dados armazenados em banco gerenciado (Supabase / Postgres) com criptografia em repouso.</li>
            <li>Acesso multi-tenant isolado por <em>Row Level Security</em>: cada clinica so enxerga os proprios pacientes.</li>
            <li>O link de coleta web e um UUID v4 secreto (~3,4 * 10^38 combinacoes). A clinica pode revogar e gerar um novo a qualquer momento.</li>
            <li>O aplicativo gera um identificador UUID local independente de IMEI ou serial de hardware.</li>
          </ul>
        </Section>

        <Section title="8. Cookies e tracking">
          <p>
            A pagina de coleta web (<em>/saude/&lt;token&gt;</em>) e o aplicativo movel <strong>nao usam cookies de terceiros nem ferramentas de analytics ou marketing</strong>. Sem Google Analytics, sem Meta Pixel, sem Hotjar. Cookies de sessao do painel da clinica nao se aplicam a esta pagina.
          </p>
        </Section>

        <Section title="9. Mudancas nesta politica">
          <p>
            Notificaremos voce em caso de alteracoes materiais, com pelo menos 30 dias de antecedencia, atraves do canal pelo qual voce esta cadastrado (WhatsApp, email ou notificacao no app). Mudancas nao-materiais (correcoes de digitacao, esclarecimentos) sao publicadas sem aviso previo - a versao atual e sempre a desta pagina.
          </p>
        </Section>

        <Section title="10. Contato">
          <p>
            <strong>Encarregada de protecao de dados (DPO):</strong>
          </p>
          <ul>
            <li>Email: <code>dpo@singulare.org</code></li>
            <li>WhatsApp / suporte: pelo canal da sua clinica</li>
          </ul>
          <p>
            Voce tambem pode contatar diretamente a clinica que enviou o link/app para voce - ela e a controladora dos seus dados clinicos e o Singulare atua como operador (LGPD art. 5, VI e VII).
          </p>
          <p>
            Autoridade Nacional de Protecao de Dados (ANPD): <a className="text-slate-700 underline" href="https://www.gov.br/anpd" rel="noopener noreferrer" target="_blank">gov.br/anpd</a>
          </p>
        </Section>

        <footer className="mt-16 pt-8 border-t border-zinc-200 text-[12px] text-zinc-500">
          <p>
            Esta pagina cumpre a Lei Geral de Protecao de Dados Pessoais (Lei 13.709/2018) e e referenciada pelo aplicativo movel Singulare Saude como exigido pelo Apple Health Privacy Manifest e pela Android Health Connect Permissions Rationale Activity.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 prose prose-zinc max-w-none prose-headings:font-medium prose-headings:tracking-[-0.01em] prose-h2:text-[20px] prose-h2:text-zinc-900 prose-h3:text-[15px] prose-h3:text-zinc-700 prose-p:text-[14px] prose-p:text-zinc-700 prose-li:text-[14px] prose-li:text-zinc-700 prose-ul:my-2 prose-strong:text-zinc-900 prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px]">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
