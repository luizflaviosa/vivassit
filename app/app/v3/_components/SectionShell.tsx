// Wrapper de secao — padding consistente desktop/mobile, max-width 1080px.
// Permite background custom (navy/sand) sem repetir boilerplate.

import type { CSSProperties, ReactNode } from 'react';

interface SectionShellProps {
  children: ReactNode;
  /** background da secao (cor solida). Default transparente. */
  background?: string;
  /** Padding vertical em px (top/bottom). Default 96. */
  paddingY?: number;
  /** Max width do container interno em px. Default 1080. */
  maxWidth?: number;
  /** Aplica padding lateral generoso pra mobile. */
  className?: string;
  id?: string;
}

export function SectionShell({
  children,
  background,
  paddingY = 96,
  maxWidth = 1080,
  className,
  id,
}: SectionShellProps) {
  const sectionStyle: CSSProperties = {
    background,
    paddingTop: paddingY,
    paddingBottom: paddingY,
    width: '100%',
  };

  return (
    <section id={id} style={sectionStyle} className={className}>
      <div
        style={{
          maxWidth,
          width: '100%',
          margin: '0 auto',
          paddingLeft: 'clamp(20px, 5vw, 48px)',
          paddingRight: 'clamp(20px, 5vw, 48px)',
        }}
      >
        {children}
      </div>
    </section>
  );
}
