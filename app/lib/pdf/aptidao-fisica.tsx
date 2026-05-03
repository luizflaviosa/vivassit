// app/lib/pdf/aptidao-fisica.tsx

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { AptidaoFisicaForm } from '@/lib/docs-types';

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: {
    textAlign: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: 160,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#555',
  },
  value: {
    flex: 1,
    fontSize: 11,
  },
  resultBox: {
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    textAlign: 'center',
  },
  resultText: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 48,
    right: 48,
    textAlign: 'center',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    width: 260,
    alignSelf: 'center',
    marginTop: 48,
    paddingTop: 8,
  },
  signatureName: {
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  signatureCouncil: {
    textAlign: 'center',
    fontSize: 10,
    color: '#555',
    marginTop: 2,
  },
  validity: {
    marginTop: 24,
    fontSize: 9,
    color: '#888',
    textAlign: 'center',
  },
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function resultLabel(result: string): string {
  switch (result) {
    case 'apto': return 'APTO';
    case 'inapto': return 'INAPTO';
    case 'apto_restricoes': return 'APTO COM RESTRIÇÕES';
    default: return result.toUpperCase();
  }
}

function resultColor(result: string): string {
  switch (result) {
    case 'apto': return '#16a34a';
    case 'inapto': return '#dc2626';
    case 'apto_restricoes': return '#d97706';
    default: return '#333';
  }
}

interface Props {
  form: AptidaoFisicaForm;
  clinicName?: string;
}

export function AptidaoFisicaPDF({ form, clinicName }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {clinicName && (
            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              {clinicName}
            </Text>
          )}
          <Text style={styles.title}>ATESTADO DE APTIDÃO FÍSICA</Text>
          <Text style={styles.subtitle}>Para prática de atividade física</Text>
        </View>

        <View style={styles.divider} />

        {/* Patient info */}
        <View style={styles.row}>
          <Text style={styles.label}>Paciente:</Text>
          <Text style={styles.value}>{form.patient_name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>CPF:</Text>
          <Text style={styles.value}>{form.patient_cpf || '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Data de Nascimento:</Text>
          <Text style={styles.value}>
            {form.patient_birthdate ? formatDate(form.patient_birthdate) : '—'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Atividade:</Text>
          <Text style={styles.value}>{form.activity_type}</Text>
        </View>

        <View style={styles.divider} />

        {/* Result */}
        <View style={styles.resultBox}>
          <Text style={{ ...styles.resultText, color: resultColor(form.result) }}>
            {resultLabel(form.result)}
          </Text>
        </View>

        {/* Restrictions (if applicable) */}
        {form.result === 'apto_restricoes' && form.restrictions && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>Restrições:</Text>
            <Text style={{ ...styles.value, marginTop: 4 }}>{form.restrictions}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Date */}
        <View style={styles.row}>
          <Text style={styles.label}>Data de emissão:</Text>
          <Text style={styles.value}>{formatDate(form.issue_date)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Válido até:</Text>
          <Text style={styles.value}>{formatDate(form.validity_date)}</Text>
        </View>

        {/* Signature */}
        <View style={styles.footer}>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureName}>{form.professional_name}</Text>
            <Text style={styles.signatureCouncil}>{form.professional_council}</Text>
          </View>
          <Text style={styles.validity}>
            Este documento tem validade de 12 meses a partir da data de emissão.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
