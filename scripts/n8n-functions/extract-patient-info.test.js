const assert = require('node:assert/strict');
const { extractPatientInfo } = require('./extract-patient-info');

// Caso 1: description com convenção padrão Master Secretária
{
  const desc = `Telefone: +55 11 99999-9999
Nome Completo: João da Silva Pereira
Data de Nascimento: 15/03/1980
ID da conversa: abc123`;
  const out = extractPatientInfo(desc);
  assert.equal(out.phone, '+5511999999999', 'phone E.164');
  assert.equal(out.name, 'João da Silva Pereira', 'nome completo');
  assert.equal(out.first_name, 'João', 'first_name');
}

// Caso 2: telefone sem máscara
{
  const desc = `Telefone: 11999999999\nNome Completo: Maria Souza`;
  const out = extractPatientInfo(desc);
  assert.equal(out.phone, '+5511999999999');
  assert.equal(out.first_name, 'Maria');
}

// Caso 3: telefone já em E.164
{
  const desc = `Telefone: +5543987654321\nNome Completo: Ana`;
  const out = extractPatientInfo(desc);
  assert.equal(out.phone, '+5543987654321');
  assert.equal(out.first_name, 'Ana');
}

// Caso 4: description sem telefone → retorna null
{
  const desc = `Nome Completo: Sem Telefone`;
  const out = extractPatientInfo(desc);
  assert.equal(out, null, 'sem telefone, descarta');
}

// Caso 5: description sem nome → first_name fallback "Paciente"
{
  const desc = `Telefone: +5511988887777`;
  const out = extractPatientInfo(desc);
  assert.equal(out.phone, '+5511988887777');
  assert.equal(out.first_name, 'Paciente');
  assert.equal(out.name, null);
}

// Caso 6: description vazia ou null
{
  assert.equal(extractPatientInfo(''), null);
  assert.equal(extractPatientInfo(null), null);
  assert.equal(extractPatientInfo(undefined), null);
}

// Caso 7: telefone curto inválido
{
  const desc = `Telefone: 12345\nNome Completo: Curto`;
  const out = extractPatientInfo(desc);
  assert.equal(out, null, 'telefone curto inválido');
}

console.log('extract-patient-info: all tests passed');
