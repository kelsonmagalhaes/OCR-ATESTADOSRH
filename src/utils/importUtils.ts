import * as XLSX from 'xlsx';
import { MedicalCertificateRecord } from '../types';
import { normalizeDias, normalizeCid, evaluateVerificationStatus } from './ocrRules';

export interface ImportPreviewResult {
  records: MedicalCertificateRecord[];
  detectedColumns: string[];
  totalRows: number;
  unmappedColumns: string[];
  errors: string[];
}

/**
 * Parses XLSX, XLS, or CSV file into MedicalCertificateRecord[] with header recognition
 */
export async function parseImportFile(file: File): Promise<ImportPreviewResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Nenhuma planilha encontrada no arquivo.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (!jsonData || jsonData.length === 0) {
    throw new Error('O arquivo está vazio.');
  }

  // First non-empty row as header
  let headerRowIndex = 0;
  while (headerRowIndex < jsonData.length && (!jsonData[headerRowIndex] || jsonData[headerRowIndex].length === 0)) {
    headerRowIndex++;
  }

  if (headerRowIndex >= jsonData.length) {
    throw new Error('Não foi possível identificar a linha de cabeçalho.');
  }

  const rawHeaders: string[] = (jsonData[headerRowIndex] || []).map((h: any) => String(h || '').trim());

  // Map columns by heuristic keywords
  let funcIdx = -1;
  let diasIdx = -1;
  let dataIdx = -1;
  let cidIdx = -1;
  let tipoIdx = -1;
  let localIdx = -1;
  let profIdx = -1;
  let obsIdx = -1;
  let horarioIdx = -1;

  rawHeaders.forEach((h, idx) => {
    const lower = h.toLowerCase();
    if (lower.includes('funcionário') || lower.includes('funcionario') || lower.includes('colaborador') || lower.includes('nome')) {
      if (funcIdx === -1) funcIdx = idx;
    } else if (lower.includes('dia') || lower.includes('dias') || lower.includes('quantidade') || lower.includes('período') || lower.includes('periodo')) {
      if (diasIdx === -1) diasIdx = idx;
    } else if (lower.includes('data') || lower.includes('emissão') || lower.includes('atendimento')) {
      if (dataIdx === -1) dataIdx = idx;
    } else if (lower.includes('cid')) {
      if (cidIdx === -1) cidIdx = idx;
    } else if (lower.includes('tipo') || lower.includes('documento')) {
      if (tipoIdx === -1) tipoIdx = idx;
    } else if (lower.includes('local') || lower.includes('clínica') || lower.includes('hospital')) {
      if (localIdx === -1) localIdx = idx;
    } else if (lower.includes('profissional') || lower.includes('médico') || lower.includes('crm')) {
      if (profIdx === -1) profIdx = idx;
    } else if (lower.includes('obs') || lower.includes('observa')) {
      if (obsIdx === -1) obsIdx = idx;
    } else if (lower.includes('horário') || lower.includes('horario') || lower.includes('hora')) {
      if (horarioIdx === -1) horarioIdx = idx;
    }
  });

  const errors: string[] = [];
  if (funcIdx === -1) errors.push('Coluna do Nome do Funcionário não foi identificada com certeza.');
  if (dataIdx === -1) errors.push('Coluna da Data do Atestado não foi identificada com certeza.');
  if (diasIdx === -1) errors.push('Coluna da Quantidade de Dias não foi identificada com certeza.');

  const records: MedicalCertificateRecord[] = [];

  for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
    const row = jsonData[r];
    if (!row || row.length === 0) continue;

    const rawFunc = funcIdx >= 0 ? String(row[funcIdx] || '').trim() : '';
    const rawDias = diasIdx >= 0 ? String(row[diasIdx] || '').trim() : '';
    const rawData = dataIdx >= 0 ? String(row[dataIdx] || '').trim() : '';
    const rawCid = cidIdx >= 0 ? String(row[cidIdx] || '').trim() : '';

    // Ignore completely empty rows
    if (!rawFunc && !rawDias && !rawData && !rawCid) continue;

    const dias = normalizeDias(rawDias);
    const cid = normalizeCid(rawCid);
    const data = rawData || 'Revisar data';
    const funcionario = rawFunc || 'Revisar nome';

    const verification = evaluateVerificationStatus({
      funcionario,
      dias,
      data,
      cid
    });

    records.push({
      id: `imported-${Date.now()}-${r}`,
      funcionario,
      dias,
      data,
      cid,
      tipoDocumento: tipoIdx >= 0 ? String(row[tipoIdx] || '').trim() : 'Atestado Médico',
      horario: horarioIdx >= 0 ? String(row[horarioIdx] || '').trim() : '',
      local: localIdx >= 0 ? String(row[localIdx] || '').trim() : '',
      profissional: profIdx >= 0 ? String(row[profIdx] || '').trim() : '',
      observacao: obsIdx >= 0 ? String(row[obsIdx] || '').trim() : '',
      arquivoOrigem: file.name,
      status: verification.status,
      motivoRevisao: verification.motivo,
      confiancaOcr: 100,
      dataProcessamento: new Date().toISOString()
    });
  }

  return {
    records,
    detectedColumns: rawHeaders,
    totalRows: records.length,
    unmappedColumns: rawHeaders.filter((_, i) => ![funcIdx, diasIdx, dataIdx, cidIdx, tipoIdx, localIdx, profIdx, obsIdx, horarioIdx].includes(i)),
    errors
  };
}
