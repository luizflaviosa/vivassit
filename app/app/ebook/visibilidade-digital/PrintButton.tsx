'use client';

const ACCENT = '#0F1B33';
const ACCENT_DEEP = '#0F1B33';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-5 h-11 rounded-xl text-[14px] font-medium text-white transition-all hover:brightness-110 active:scale-[0.98]"
      style={{
        background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
        boxShadow: '0 8px 24px -8px rgba(110,86,207,0.6)',
      }}
    >
      Imprimir / Salvar PDF
    </button>
  );
}
