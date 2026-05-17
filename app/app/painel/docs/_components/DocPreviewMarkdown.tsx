'use client';

// Preview universal — renderiza o markdown vindo de DOC_TEMPLATES[doc_type].render()
// como HTML estilizado em moldura A4 (mesmo subset do GenericMarkdownPDF, pra
// paciente/profissional ver o que vai sair impresso).
//
// Subset: # H1, ## H2, **bold**, - bullet, --- separador, paragrafos.

interface Props {
  markdown: string;
  className?: string;
}

type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'sep' };

function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('# ')) blocks.push({ kind: 'h1', text: line.slice(2).trim() });
    else if (line.startsWith('## ')) blocks.push({ kind: 'h2', text: line.slice(3).trim() });
    else if (line.startsWith('---')) blocks.push({ kind: 'sep' });
    else if (line.startsWith('- ') || line.startsWith('* ')) blocks.push({ kind: 'bullet', text: line.slice(2).trim() });
    else blocks.push({ kind: 'p', text: line });
  }
  return blocks;
}

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach((part, idx) => {
    if (!part) return;
    if (part.startsWith('**') && part.endsWith('**')) {
      out.push(<strong key={idx}>{part.slice(2, -2)}</strong>);
    } else {
      out.push(<span key={idx}>{part}</span>);
    }
  });
  return out;
}

export function DocPreviewMarkdown({ markdown, className = '' }: Props) {
  const blocks = parseMarkdown(markdown);
  return (
    <div
      className={`bg-white shadow-sm border border-black/[0.06] rounded-lg p-8 font-serif text-[13px] leading-[1.7] text-zinc-900 max-w-[800px] mx-auto ${className}`}
      style={{ minHeight: '1056px' /* ~A4 aspect */ }}
    >
      {blocks.map((b, i) => {
        if (b.kind === 'h1')
          return (
            <h1 key={i} className="text-[18px] font-bold uppercase tracking-wider text-center mt-2 mb-4">
              {b.text}
            </h1>
          );
        if (b.kind === 'h2')
          return (
            <h2 key={i} className="text-[14px] font-bold mt-5 mb-1.5 text-zinc-800">
              {b.text}
            </h2>
          );
        if (b.kind === 'sep') return <hr key={i} className="my-4 border-zinc-200" />;
        if (b.kind === 'bullet')
          return (
            <div key={i} className="flex gap-2 my-1">
              <span className="text-zinc-400">•</span>
              <span>{renderInline(b.text)}</span>
            </div>
          );
        return (
          <p key={i} className="my-2 text-justify">
            {renderInline(b.text)}
          </p>
        );
      })}
    </div>
  );
}
