import * as XLSX from 'xlsx';
import { MedicalCertificateRecord } from '../types';

/**
 * Generates and triggers download of Excel (.xlsx) file
 */
export function downloadExcel(
  records: MedicalCertificateRecord[],
  filename = 'Atestados_Medicos_DP_RH.xlsx',
  modoDetalhado = false
) {
  let dataToExport: any[];

  if (modoDetalhado) {
    dataToExport = records.map((r) => ({
      'Nome do Funcionário': r.funcionario,
      'Tipo de Documento': r.tipoDocumento || 'Atestado Médico',
      'Data de Atendimento': r.data,
      'Quantidade de Dias / Período': r.dias,
      'Horário': r.horario || '-',
      'CID': r.cid || 'Não informado',
      'Local de Atendimento': r.local || '-',
      'Profissional / Responsável': r.profissional || '-',
      'Observação': r.observacao || '-',
      'Arquivo de Origem': r.arquivoOrigem + (r.paginaOrigem ? ` (Pág. ${r.paginaOrigem})` : ''),
      'Status de Conferência': r.status.toUpperCase()
    }));
  } else {
    // Exact 4 mandatory columns
    dataToExport = records.map((r) => ({
      'Nome do Funcionário': r.funcionario,
      'Quantidade de Dias': r.dias,
      'Data do Atestado': r.data,
      'CID': r.cid
    }));
  }

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);

  // Calculate auto column widths
  const colWidths = Object.keys(dataToExport[0] || {}).map((key) => {
    let maxLen = key.length;
    for (const row of dataToExport) {
      const valStr = String(row[key] || '');
      if (valStr.length > maxLen) {
        maxLen = valStr.length;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 14), 50) };
  });

  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Atestados');

  XLSX.writeFile(workbook, filename);
}

/**
 * Generates and triggers download of CSV file
 * Semicolon separated, UTF-8 BOM, quoted fields
 */
export function downloadCsv(
  records: MedicalCertificateRecord[],
  filename = 'Atestados_Medicos_DP_RH.csv',
  modoDetalhado = false
) {
  let headers: string[];
  let rows: string[][];

  if (modoDetalhado) {
    headers = [
      'Nome do Funcionário',
      'Tipo de Documento',
      'Data de Atendimento',
      'Quantidade de Dias',
      'Horário',
      'CID',
      'Local',
      'Profissional',
      'Observação',
      'Arquivo de Origem'
    ];
    rows = records.map((r) => [
      r.funcionario,
      r.tipoDocumento || 'Atestado Médico',
      r.data,
      r.dias,
      r.horario || '',
      r.cid || 'Não informado',
      r.local || '',
      r.profissional || '',
      r.observacao || '',
      r.arquivoOrigem + (r.paginaOrigem ? ` (Pág. ${r.paginaOrigem})` : '')
    ]);
  } else {
    // Exact standard headers
    headers = [
      'Nome do Funcionário',
      'Quantidade de Dias',
      'Data do Atestado',
      'CID'
    ];
    rows = records.map((r) => [
      r.funcionario,
      r.dias,
      r.data,
      r.cid
    ]);
  }

  // Quote value helper
  const quote = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;

  const headerLine = headers.map(quote).join(';');
  const dataLines = rows.map((row) => row.map(quote).join(';'));
  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copies table to clipboard in TSV (Tab Separated Values) format
 * allowing instant paste into Microsoft Excel, Google Sheets or LibreOffice Calc
 */
export async function copyTableToClipboard(
  records: MedicalCertificateRecord[],
  modoDetalhado = false
): Promise<boolean> {
  try {
    let headers: string[];
    let rows: string[][];

    if (modoDetalhado) {
      headers = [
        'Nome do Funcionário',
        'Tipo de Documento',
        'Data do Atestado',
        'Quantidade de Dias',
        'Horário',
        'CID',
        'Local',
        'Profissional',
        'Observação',
        'Arquivo de Origem'
      ];
      rows = records.map((r) => [
        r.funcionario,
        r.tipoDocumento || 'Atestado Médico',
        r.data,
        r.dias,
        r.horario || '-',
        r.cid,
        r.local || '-',
        r.profissional || '-',
        r.observacao || '-',
        r.arquivoOrigem + (r.paginaOrigem ? ` (Pág. ${r.paginaOrigem})` : '')
      ]);
    } else {
      headers = [
        'Nome do Funcionário',
        'Quantidade de Dias',
        'Data do Atestado',
        'CID'
      ];
      rows = records.map((r) => [
        r.funcionario,
        r.dias,
        r.data,
        r.cid
      ]);
    }

    const tsvContent = [
      headers.join('\t'),
      ...rows.map((row) => row.join('\t'))
    ].join('\n');

    await navigator.clipboard.writeText(tsvContent);
    return true;
  } catch (err) {
    console.error('Falha ao copiar para a área de transferência', err);
    return false;
  }
}
