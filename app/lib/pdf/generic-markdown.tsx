// PDF universal a partir do markdown gerado pelo template.render().
// Parser de markdown leve — cobre o subset que os 5 templates usam:
//   # H1, ## H2  (titulos)
//   **bold**     (negrito inline)
//   - lista      (bullets)
//   ---          (separadores)
//   linhas em branco (paragrafos)
//
// Usado pelo /api/painel/docs/[id]/pdf/route.ts pra todos os doc_types
// que não tenham componente PDF customizado.

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
    lineHeight: 1.5,
  },
  h1: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  h2: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 14,
    marginBottom: 6,
    color: '#27272a',
  },
  paragraph: {
    marginBottom: 6,
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 10,
    fontFamily: 'Helvetica-Bold',
  },
  bulletText: {
    flex: 1,
  },
  separator: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#d4d4d8',
    marginVertical: 10,
  },
  spacer: {
    height: 6,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: 'center',
    fontSize: 8,
    color: '#a1a1aa',
  },
});

interface Props {
  markdown: string;
  clinicName?: string;
  documentTypeLabel?: string;
}

// Parser linha-a-linha do markdown subset
type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'sep' }
  | { kind: 'spacer' };

function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      // colapsa multiplas linhas em branco num spacer
      if (blocks.length > 0 && blocks[blocks.length - 1].kind !== 'spacer') {
        blocks.push({ kind: 'spacer' });
      }
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push({ kind: 'h1', text: line.slice(2).trim() });
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ kind: 'h2', text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith('---')) {
      blocks.push({ kind: 'sep' });
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({ kind: 'bullet', text: line.slice(2).trim() });
      continue;
    }
    blocks.push({ kind: 'p', text: line });
  }

  return blocks;
}

// Renderiza inline bold (**texto**) split into segments
function renderInline(text: string): React.ReactNode[] {
  const segments: React.ReactNode[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach((part, idx) => {
    if (!part) return;
    if (part.startsWith('**') && part.endsWith('**')) {
      segments.push(
        <Text key={idx} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>,
      );
    } else {
      segments.push(<Text key={idx}>{part}</Text>);
    }
  });
  return segments;
}

export function GenericMarkdownPDF({ markdown, clinicName, documentTypeLabel }: Props) {
  const blocks = parseMarkdown(markdown);

  return (
    <Document
      title={`${documentTypeLabel ?? 'Documento'} — ${clinicName ?? ''}`}
      author={clinicName ?? 'Singulare'}
    >
      <Page size="A4" style={styles.page} wrap>
        {blocks.map((b, i) => {
          if (b.kind === 'h1') {
            return (
              <Text key={i} style={styles.h1}>
                {b.text}
              </Text>
            );
          }
          if (b.kind === 'h2') {
            return (
              <Text key={i} style={styles.h2}>
                {b.text}
              </Text>
            );
          }
          if (b.kind === 'sep') {
            return <View key={i} style={styles.separator} />;
          }
          if (b.kind === 'spacer') {
            return <View key={i} style={styles.spacer} />;
          }
          if (b.kind === 'bullet') {
            return (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{renderInline(b.text)}</Text>
              </View>
            );
          }
          return (
            <Text key={i} style={styles.paragraph}>
              {renderInline(b.text)}
            </Text>
          );
        })}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${clinicName ?? ''} · página ${pageNumber} de ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
