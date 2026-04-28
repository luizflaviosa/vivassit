// Extrai um inteiro 0-10 de uma mensagem do paciente.
// Estratégia: regex que casa números isolados (word boundaries) e filtra 0-10.
// Retorna o primeiro match válido, ou null se nenhum.

function parseNpsScore(message) {
  if (!message || typeof message !== 'string') return null;

  const matches = message.matchAll(/\b(\d{1,3})\b/g);
  for (const m of matches) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n >= 0 && n <= 10) return n;
  }
  return null;
}

module.exports = { parseNpsScore };
