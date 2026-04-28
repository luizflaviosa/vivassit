const assert = require('node:assert/strict');
const { parseNpsScore } = require('./parse-nps-score');

// Mensagens válidas
assert.equal(parseNpsScore('10'), 10);
assert.equal(parseNpsScore('  9  '), 9);
assert.equal(parseNpsScore('0'), 0);
assert.equal(parseNpsScore('Acho que daria 8'), 8);
assert.equal(parseNpsScore('nota 7!'), 7);
assert.equal(parseNpsScore('nota: 5'), 5);

// 10 isolado
assert.equal(parseNpsScore('Daria 10!'), 10);

// Mensagens inválidas (sem nota plausível)
assert.equal(parseNpsScore('oi'), null);
assert.equal(parseNpsScore('foi ok'), null);
assert.equal(parseNpsScore(''), null);
assert.equal(parseNpsScore(null), null);

// Números fora da faixa não contam
assert.equal(parseNpsScore('15'), null, '15 não é nota válida');
assert.equal(parseNpsScore('cheguei às 14h'), null, 'horário não é nota');
assert.equal(parseNpsScore('100'), null);

// Caso ambíguo: pega o primeiro válido
assert.equal(parseNpsScore('Era pra ser 10, mas dou 8'), 10);

console.log('parse-nps-score: all tests passed');
