'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function V2CTAFooter() {
  return (
    <>
      <section
        id="cta"
        className="v2-section v2-dark"
        style={{ position: 'relative', overflow: 'hidden', textAlign: 'center' }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(50% 60% at 50% 50%, rgba(110,86,207,0.4), rgba(110,86,207,0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <div className="v2-container" style={{ position: 'relative' }}>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
            }}
          >
            <span className="v2-eyebrow">Comece hoje</span>
            <h2 className="v2-display" style={{ maxWidth: '22ch' }}>
              Sua nova secretária{' '}
              <span style={{ color: '#a1a1a6' }} className="v2-italic">
                começa agora.
              </span>
            </h2>
            <p className="v2-lead" style={{ maxWidth: '50ch' }}>
              7 dias grátis. Sem cartão de crédito. Configuração em 15 minutos.
              Cancelamento em 1 clique. Suporte humano de verdade.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '1rem',
                marginTop: '1rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <a
                href="/onboarding"
                className="v2-btn-primary"
                style={{ background: '#fff', color: '#1d1d1f' }}
              >
                Iniciar trial gratuito
                <ArrowRight size={16} />
              </a>
              <a href="#highlights" className="v2-btn-link" style={{ color: '#b39dff' }}>
                Falar com especialista →
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <footer
        style={{
          background: '#000',
          color: '#86868b',
          padding: '3rem 0 2rem',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="v2-container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '2rem',
              marginBottom: '2.5rem',
            }}
          >
            <div>
              <div
                style={{
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  marginBottom: '1rem',
                }}
              >
                Produto
              </div>
              {['Recursos', 'Preços', 'Integrações', 'Roadmap'].map((l) => (
                <FooterLink key={l}>{l}</FooterLink>
              ))}
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1rem' }}>
                Empresa
              </div>
              {['Sobre', 'Carreiras', 'Contato', 'Imprensa'].map((l) => (
                <FooterLink key={l}>{l}</FooterLink>
              ))}
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1rem' }}>
                Recursos
              </div>
              {['Blog', 'Centro de ajuda', 'API', 'Status'].map((l) => (
                <FooterLink key={l}>{l}</FooterLink>
              ))}
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1rem' }}>
                Legal
              </div>
              {['Termos', 'Privacidade', 'LGPD', 'Segurança'].map((l) => (
                <FooterLink key={l}>{l}</FooterLink>
              ))}
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.8125rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <span>© 2026 Singulare. Todos os direitos reservados.</span>
            <span>Feito com ♥ no Brasil</span>
          </div>
        </div>
      </footer>
    </>
  );
}

function FooterLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      href="#"
      style={{
        display: 'block',
        color: '#86868b',
        textDecoration: 'none',
        fontSize: '0.875rem',
        marginBottom: '0.5rem',
        transition: 'color 200ms',
      }}
      onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#fff')}
      onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#86868b')}
    >
      {children}
    </a>
  );
}
