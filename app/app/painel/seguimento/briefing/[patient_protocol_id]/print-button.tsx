"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        background: "#6E56CF",
        color: "white",
        border: "none",
        padding: "6px 14px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Imprimir / salvar PDF
    </button>
  );
}
