import { MedicalCertificateRecord, VerificationStatus } from '../types';

/**
 * Parses date string in DD/MM/AAAA format into a comparable timestamp or Date
 */
export function parseDateDDMMAAAA(dateStr: string): number {
  if (!dateStr || dateStr.toLowerCase().includes('revisar')) {
    return 0;
  }
  // Try DD/MM/YYYY
  const parts = dateStr.trim().split(/[\/\-\.]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    
    // Check if it's YYYY/MM/DD
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    }

    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      if (year < 100) year += 2000;
      return new Date(year, month, day).getTime();
    }
  }
  const fallback = Date.parse(dateStr);
  return isNaN(fallback) ? 0 : fallback;
}

/**
 * Formats a Date or ISO string into DD/MM/AAAA
 */
export function formatDateToDDMMAAAA(input: Date | string | number): string {
  const d = new Date(input);
  if (isNaN(d.getTime())) return 'Revisar data';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Normalizes days count according to strict business rules:
 * - "1 dia", "2 dias", "5 dias"
 * - "Comparecimento"
 * - "Revisar quantidade"
 * - Preserva valores negativos para que o validador possa capturar e marcar 'revisar'
 */
export function normalizeDias(input: string): string {
  if (!input) return 'Revisar quantidade';
  const clean = input.trim().toLowerCase();
  
  if (clean.includes('comparecimento') || clean.includes('presença') || clean.includes('consulta') || clean.includes('horas')) {
    return 'Comparecimento';
  }
  
  if (clean.includes('revisar')) {
    return 'Revisar quantidade';
  }

  // Verifica se é número negativo (ex: "-1", "-2 dias")
  const negMatch = clean.match(/(-\s*\d+)/);
  if (negMatch) {
    const num = parseInt(negMatch[1].replace(/\s+/g, ''), 10);
    return `${num} dias`;
  }

  const numMatch = clean.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num === 1) return '1 dia';
    if (num > 1) return `${num} dias`;
    if (num === 0) return '0 dias';
  }

  return input.trim();
}

/**
 * Normalizes CID code according to strict business rules:
 * - Preserve characters
 * - If absent or explicitly not informed, strictly "Não informado"
 */
export function normalizeCid(input: string): string {
  if (!input || input.trim() === '') {
    return 'Não informado';
  }
  const clean = input.trim();
  const lower = clean.toLowerCase();
  if (
    lower.includes('não') ||
    lower.includes('ausente') ||
    lower.includes('sem') ||
    lower.includes('sigilo') ||
    lower === 'null' ||
    lower === 'undefined'
  ) {
    return 'Não informado';
  }
  return clean.toUpperCase();
}

/**
 * Validador Pós-Processamento: Data do Atestado
 * Verifica formatação DD/MM/AAAA, calendário gregoriano (dias do mês, anos bissextos) e faixa de anos.
 */
export function validateDate(dateStr: string): { isValid: boolean; reason?: string } {
  if (!dateStr || dateStr.trim() === '' || dateStr.toLowerCase().includes('revisar')) {
    return { isValid: false, reason: 'Data do atestado ausente ou pendente de revisão' };
  }

  const clean = dateStr.trim();
  const match = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (!match) {
    return { isValid: false, reason: `Formato de data inválido: "${clean}" (esperado DD/MM/AAAA)` };
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return { isValid: false, reason: `Mês inexistente (${month}) na data do atestado: "${clean}"` };
  }

  if (year < 2000 || year > 2035) {
    return { isValid: false, reason: `Ano inconsistente (${year}) na data do atestado: "${clean}"` };
  }

  // Validação estrita de calendário real (meses com 30 dias e fevereiro com anos bissextos)
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [0, 31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[month];

  if (day < 1 || day > maxDay) {
    return {
      isValid: false,
      reason: `Dia inválido (${day}/${month}/${year}) inexistente no calendário gregoriano`,
    };
  }

  return { isValid: true };
}

/**
 * Validador Pós-Processamento: Código CID
 * Verifica se é 'Não informado' (permitido por lei / sigilo médico CFM)
 * ou se é um código CID-10 real válido (Letra A-Z + 2 dígitos numéricos + opcionalmente . e 1 ou 2 caracteres).
 */
export function validateCid(cidStr: string): { isValid: boolean; reason?: string } {
  if (!cidStr || cidStr.trim() === '') {
    return { isValid: true }; // Vazio normaliza para 'Não informado'
  }

  const clean = cidStr.trim();
  const lower = clean.toLowerCase();

  // "Não informado" é perfeitamente válido conforme resolução do CFM (sigilo médico)
  if (
    clean === 'Não informado' ||
    lower.includes('não') ||
    lower.includes('ausente') ||
    lower.includes('sem') ||
    lower.includes('sigilo')
  ) {
    return { isValid: true };
  }

  // Código negativo ou caracteres ilegais
  if (clean.includes('-') && !clean.startsWith('CID')) {
    return { isValid: false, reason: `Código CID inválido com sinal negativo ou hífen: "${clean}"` };
  }

  // Padrão oficial OMS do CID-10:
  // 1 letra (A-Z) + 2 dígitos numéricos (00-99) + opcionalmente . e 1 ou 2 caracteres
  // Ex: M54, M54.5, J06, J06.9, K29.7, Z76.3, B34.2, U07.1
  const cid10Pattern = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$/;

  if (!cid10Pattern.test(clean)) {
    return {
      isValid: false,
      reason: `Código CID inexistente ou fora do padrão oficial CID-10: "${clean}"`,
    };
  }

  return { isValid: true };
}

/**
 * Validador Pós-Processamento: Quantidade de Dias
 * Verifica dias negativos, dias iguais a zero sem ser comparecimento e quantidades excessivas.
 */
export function validateDias(diasStr: string): { isValid: boolean; reason?: string } {
  if (!diasStr || diasStr.trim() === '' || diasStr.toLowerCase().includes('revisar')) {
    return { isValid: false, reason: 'Quantidade de dias pendente de conferência' };
  }

  const clean = diasStr.trim();
  const lower = clean.toLowerCase();

  // Comparecimento é válido
  if (lower.includes('comparecimento') || lower.includes('presença') || lower.includes('consulta') || lower.includes('horas')) {
    return { isValid: true };
  }

  // Detecta dias negativos (ex: "-1 dia", "-5", "-2 dias")
  if (clean.startsWith('-') || /-\s*\d+/.test(clean)) {
    return {
      isValid: false,
      reason: `Quantidade de dias negativa ou inconsistente: "${clean}"`,
    };
  }

  const numMatch = clean.match(/(\d+)/);
  if (!numMatch) {
    return { isValid: false, reason: `Quantidade de dias não numérica: "${clean}"` };
  }

  const num = parseInt(numMatch[1], 10);

  if (num === 0) {
    return {
      isValid: false,
      reason: 'Quantidade de 0 dias indicada sem registro de declaração de comparecimento',
    };
  }

  if (num > 365) {
    return {
      isValid: false,
      reason: `Quantidade excessiva de dias (${num} dias) - requer validação de perícia do INSS`,
    };
  }

  return { isValid: true };
}

/**
 * Validador Pós-Processamento: Nome do Funcionário
 */
export function validateFuncionario(nomeStr: string): { isValid: boolean; reason?: string } {
  if (!nomeStr || nomeStr.trim() === '' || nomeStr.toLowerCase().includes('revisar')) {
    return { isValid: false, reason: 'Nome do funcionário pendente de conferência' };
  }

  const clean = nomeStr.trim();
  if (clean.length < 3) {
    return { isValid: false, reason: `Nome do funcionário muito curto ou incompleto: "${clean}"` };
  }

  if (/^\d+$/.test(clean)) {
    return { isValid: false, reason: 'Nome do funcionário composto exclusivamente por números' };
  }

  return { isValid: true };
}

export interface ConsistencyValidationResult {
  isValid: boolean;
  issues: string[];
  recommendedStatus: VerificationStatus;
  motivoRevisao: string;
}

/**
 * Validador Pós-Processamento Integral de Consistência
 * Analisa datas inválidas, CIDs inexistentes/inválidos, dias negativos e inconsistências cadastrais.
 */
export function validateRecordConsistency(
  record: Partial<MedicalCertificateRecord>
): ConsistencyValidationResult {
  const issues: string[] = [];

  // 1. Data do atestado
  const dateVal = validateDate(record.data || '');
  if (!dateVal.isValid && dateVal.reason) {
    issues.push(dateVal.reason);
  }

  // 2. Quantidade de dias (com detecção de negativos)
  const diasVal = validateDias(record.dias || '');
  if (!diasVal.isValid && diasVal.reason) {
    issues.push(diasVal.reason);
  }

  // 3. Código CID
  const cidVal = validateCid(record.cid || '');
  if (!cidVal.isValid && cidVal.reason) {
    issues.push(cidVal.reason);
  }

  // 4. Funcionário
  const funcVal = validateFuncionario(record.funcionario || '');
  if (!funcVal.isValid && funcVal.reason) {
    issues.push(funcVal.reason);
  }

  // 5. Confiança OCR baixa
  if (record.confiancaOcr && record.confiancaOcr < 70) {
    issues.push('Baixa nitidez ou legibilidade parcial no documento');
  }

  const isValid = issues.length === 0;
  const recommendedStatus: VerificationStatus = isValid ? 'aprovado' : 'revisar';

  const motivoRevisao = issues.join('; ');

  return {
    isValid,
    issues,
    recommendedStatus,
    motivoRevisao,
  };
}

/**
 * Aplica automaticamente o Validador Pós-Processamento a um registro.
 * Se houver qualquer inconsistência (dias negativos, CID inexistente, data inválida),
 * o registro é marcado automaticamente com status 'revisar' e motivo explicativo.
 */
export function applyConsistencyValidation(
  record: MedicalCertificateRecord
): MedicalCertificateRecord {
  const validation = validateRecordConsistency(record);

  if (!validation.isValid) {
    return {
      ...record,
      status: 'revisar',
      motivoRevisao: validation.motivoRevisao || record.motivoRevisao || 'Inconsistência detectada na conferência de dados.',
      confiancaOcr: record.confiancaOcr > 70 ? 60 : record.confiancaOcr,
    };
  }

  // Se for válido e não tiver motivo manual pré-existente
  return {
    ...record,
    status: record.status === 'revisar' && record.motivoRevisao && !record.motivoRevisao.includes('Inconsistência')
      ? record.status
      : 'aprovado',
  };
}

/**
 * Aplica o Validador Pós-Processamento a uma lista/lote inteiro de atestados.
 */
export function applyBatchConsistencyValidation(
  records: MedicalCertificateRecord[]
): MedicalCertificateRecord[] {
  return records.map(applyConsistencyValidation);
}

/**
 * Standard grouping and sorting mandated by Verdent:
 * 1. Group records by employee full name
 * 2. Sort employees alphabetically (A-Z)
 * 3. Inside each employee, sort certificates from oldest date to newest date
 */
export function sortAndGroupRecords(records: MedicalCertificateRecord[]): MedicalCertificateRecord[] {
  // Group by normalized employee name
  const groups = new Map<string, MedicalCertificateRecord[]>();

  for (const record of records) {
    const key = record.funcionario.trim().toLowerCase() || 'zz_revisar_nome';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(record);
  }

  // Sort employee keys alphabetically
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
  });

  const result: MedicalCertificateRecord[] = [];

  for (const key of sortedKeys) {
    const employeeRecords = groups.get(key)!;
    // Sort each employee's records chronologically (oldest to newest)
    employeeRecords.sort((a, b) => {
      const timeA = parseDateDDMMAAAA(a.data);
      const timeB = parseDateDDMMAAAA(b.data);
      return timeA - timeB;
    });

    result.push(...employeeRecords);
  }

  return result;
}

/**
 * Checks if a record requires manual review (utiliza o validador pós-processamento de consistência)
 */
export function evaluateVerificationStatus(record: Partial<MedicalCertificateRecord>): {
  status: VerificationStatus;
  motivo?: string;
  issues?: string[];
} {
  const validation = validateRecordConsistency(record);
  return {
    status: validation.recommendedStatus,
    motivo: validation.motivoRevisao || undefined,
    issues: validation.issues,
  };
}

/**
 * Converte nome próprio para Title Case preservando partículas comuns da língua portuguesa
 */
export function formatFullName(name: string): string {
  if (!name || name.trim() === '' || name.toLowerCase().includes('revisar')) {
    return name;
  }
  const lowercaseWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && lowercaseWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Corrige e normaliza formatos de data comuns (YYYY-MM-DD, D/M/AAAA, pontos em vez de barras)
 */
export function autoFixDate(dateStr: string): string {
  if (!dateStr || dateStr.toLowerCase().includes('revisar')) return dateStr;
  const clean = dateStr.trim();

  // Formato ISO: YYYY-MM-DD ou YYYY/MM/DD
  const isoMatch = clean.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // Formato BR: D/M/YYYY ou DD-MM-YYYY
  const brMatch = clean.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})$/);
  if (brMatch) {
    const d = brMatch[1].padStart(2, '0');
    const m = brMatch[2].padStart(2, '0');
    let y = brMatch[3];
    if (y.length === 2) y = '20' + y;
    return `${d}/${m}/${y}`;
  }

  return clean;
}

/**
 * Corrige e normaliza código CID (hífens em vez de pontos, ausência de ponto, prefixos desnecessários)
 */
export function autoFixCid(cidStr: string): string {
  if (!cidStr || cidStr.trim() === '') return 'Não informado';
  let clean = cidStr.trim().toUpperCase();

  if (
    clean.includes('NÃO') ||
    clean.includes('SEM') ||
    clean.includes('AUSENTE') ||
    clean.includes('SIGILO') ||
    clean === 'NULL' ||
    clean === 'UNDEFINED'
  ) {
    return 'Não informado';
  }

  // Remove prefixo "CID:" ou "CID "
  clean = clean.replace(/^CID[:\s-]*/i, '').trim();

  // Troca hífen por ponto: M54-5 -> M54.5
  clean = clean.replace(/^([A-Z]\d{2})-([0-9A-Z]{1,2})$/, '$1.$2');

  // Adiciona ponto se estiver ausente: M545 -> M54.5
  const missingDotMatch = clean.match(/^([A-Z]\d{2})([0-9A-Z])$/);
  if (missingDotMatch) {
    clean = `${missingDotMatch[1]}.${missingDotMatch[2]}`;
  }

  return clean;
}

/**
 * Corrige quantidade de dias (dias por extenso, sufixos adicionais, comparecimento)
 */
export function autoFixDias(diasStr: string): string {
  if (!diasStr || diasStr.toLowerCase().includes('revisar')) return diasStr;
  const lower = diasStr.trim().toLowerCase();

  if (
    lower.includes('comparecimento') ||
    lower.includes('consulta') ||
    lower.includes('horas') ||
    lower.includes('presenca') ||
    lower.includes('presença')
  ) {
    return 'Comparecimento';
  }

  // Mapeamento de números por extenso
  const wordsToNumbers: Record<string, number> = {
    'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'tres': 3, 'quatro': 4,
    'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10,
    'quinze': 15, 'vinte': 20, 'trinta': 30
  };

  for (const [word, num] of Object.entries(wordsToNumbers)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) {
      return num === 1 ? '1 dia' : `${num} dias`;
    }
  }

  const numMatch = lower.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num === 1) return '1 dia';
    if (num > 1) return `${num} dias`;
  }

  return normalizeDias(diasStr);
}

/**
 * Higieniza e corrige automaticamente um registro de atestado médico
 */
export function autoCleanAndFixRecord(record: MedicalCertificateRecord): {
  record: MedicalCertificateRecord;
  changed: boolean;
  fixes: string[];
} {
  const fixes: string[] = [];
  const updated = { ...record };

  // 1. Nome do funcionário
  const formattedName = formatFullName(updated.funcionario);
  if (formattedName !== updated.funcionario) {
    fixes.push(`Nome padronizado: ${formattedName}`);
    updated.funcionario = formattedName;
  }

  // 2. Data
  const fixedDate = autoFixDate(updated.data);
  if (fixedDate !== updated.data) {
    fixes.push(`Data corrigida: ${fixedDate}`);
    updated.data = fixedDate;
  }

  // 3. Dias
  const fixedDias = autoFixDias(updated.dias);
  if (fixedDias !== updated.dias) {
    fixes.push(`Dias padronizados: ${fixedDias}`);
    updated.dias = fixedDias;
  }

  // 4. CID
  const fixedCid = autoFixCid(updated.cid);
  if (fixedCid !== updated.cid) {
    fixes.push(`CID padronizado: ${fixedCid}`);
    updated.cid = fixedCid;
  }

  // 5. Validação de consistência e promoção automática
  const validation = validateRecordConsistency(updated);
  if (validation.isValid) {
    if (updated.status !== 'aprovado') {
      fixes.push('Atestado aprovado após higienização e validação de regras');
      updated.status = 'aprovado';
      updated.motivoRevisao = '';
      updated.confiancaOcr = Math.max(updated.confiancaOcr || 80, 95);
    }
  } else {
    updated.status = 'revisar';
    updated.motivoRevisao = validation.motivoRevisao;
  }

  return {
    record: updated,
    changed: fixes.length > 0,
    fixes,
  };
}

/**
 * Aplica higienização em lote e retorna métricas de melhoria
 */
export function autoCleanBatch(records: MedicalCertificateRecord[]): {
  cleanedRecords: MedicalCertificateRecord[];
  totalChanged: number;
  promotedToApproved: number;
} {
  let totalChanged = 0;
  let promotedToApproved = 0;

  const cleanedRecords = records.map((r) => {
    const wasReview = r.status !== 'aprovado';
    const res = autoCleanAndFixRecord(r);
    if (res.changed) {
      totalChanged++;
      if (wasReview && res.record.status === 'aprovado') {
        promotedToApproved++;
      }
    }
    return res.record;
  });

  return {
    cleanedRecords,
    totalChanged,
    promotedToApproved,
  };
}


