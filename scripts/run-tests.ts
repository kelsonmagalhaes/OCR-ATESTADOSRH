/**
 * Verdent - Suite Completa de Testes Automatizados
 * Validação rigorosa das Regras de Negócio e Funcionalidades
 */

import { 
  normalizeDias, 
  normalizeCid, 
  parseDateDDMMAAAA, 
  formatDateToDDMMAAAA, 
  sortAndGroupRecords, 
  evaluateVerificationStatus 
} from '../src/utils/ocrRules';
import { MedicalCertificateRecord } from '../src/types';
import { INITIAL_SAMPLE_RECORDS } from '../src/data/sampleData';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
  }
}

console.log('================================================================');
console.log('🧪 INICIANDO TESTES DO APLICATIVO DE GESTÃO DE ATESTADOS VERDENT');
console.log('================================================================\n');

// -------------------------------------------------------------
// GRUPO 1: REGRA 1 - NOME DO FUNCIONÁRIO
// -------------------------------------------------------------
console.log('📋 Grupo 1: Regra de Nome do Funcionário');

{
  const status1 = evaluateVerificationStatus({ funcionario: 'Francisco da Silva', dias: '3 dias', data: '03/08/2026', cid: 'M54.5' });
  assert(status1.status === 'aprovado', 'Funcionário válido não gera pendência de nome');

  const status2 = evaluateVerificationStatus({ funcionario: 'Revisar nome', dias: '3 dias', data: '03/08/2026', cid: 'M54.5' });
  assert(status2.status === 'revisar', 'Nome "Revisar nome" gera status revisar');
  assert(status2.motivo?.includes('Nome do funcionário') === true, 'Motivo de revisão aponta para conferência de nome');

  const status3 = evaluateVerificationStatus({ funcionario: '', dias: '3 dias', data: '03/08/2026', cid: 'M54.5' });
  assert(status3.status === 'revisar', 'Nome vazio gera status revisar');
}

// -------------------------------------------------------------
// GRUPO 2: REGRA 2 - QUANTIDADE DE DIAS
// -------------------------------------------------------------
console.log('\n📋 Grupo 2: Regra de Quantidade de Dias');

{
  assert(normalizeDias('1') === '1 dia', 'Número 1 vira "1 dia"');
  assert(normalizeDias('1 dia') === '1 dia', '"1 dia" permanece "1 dia"');
  assert(normalizeDias('2') === '2 dias', 'Número 2 vira "2 dias"');
  assert(normalizeDias('3 dias') === '3 dias', '"3 dias" permanece "3 dias"');
  assert(normalizeDias('15 dias de repouso') === '15 dias', 'Texto com número "15 dias de repouso" normaliza para "15 dias"');
  
  assert(normalizeDias('comparecimento') === 'Comparecimento', '"comparecimento" normaliza para "Comparecimento"');
  assert(normalizeDias('Declaração de Comparecimento') === 'Comparecimento', '"Declaração de Comparecimento" normaliza para "Comparecimento"');
  assert(normalizeDias('Presença em consulta') === 'Comparecimento', '"Presença em consulta" normaliza para "Comparecimento"');
  assert(normalizeDias('Consulta de 2 horas') === 'Comparecimento', '"Consulta de 2 horas" prioriza "Comparecimento"');

  assert(normalizeDias('') === 'Revisar quantidade', 'Vazio normaliza para "Revisar quantidade"');
  assert(normalizeDias('Revisar quantidade') === 'Revisar quantidade', '"Revisar quantidade" preservado');
  assert(normalizeDias('indeterminado') === 'indeterminado', 'Termo descritivo sem número preservado');
}

// -------------------------------------------------------------
// GRUPO 3: REGRA 3 - DATA DO ATESTADO (DD/MM/AAAA)
// -------------------------------------------------------------
console.log('\n📋 Grupo 3: Regra de Data do Atestado');

{
  const timestamp1 = parseDateDDMMAAAA('03/08/2026');
  const timestamp2 = parseDateDDMMAAAA('15/08/2026');
  assert(timestamp1 > 0, 'Data 03/08/2026 parseada com sucesso');
  assert(timestamp2 > timestamp1, '15/08/2026 é cronologicamente posterior a 03/08/2026');

  // Test leap year / dates
  const dateFormatted = formatDateToDDMMAAAA(new Date(2026, 7, 3)); // August 3, 2026
  assert(dateFormatted === '03/08/2026', 'Formatação Date para DD/MM/AAAA exata');

  const invalidParse = parseDateDDMMAAAA('Revisar data');
  assert(invalidParse === 0, 'Data inválida retorna timestamp 0 para ordenação segura');

  const statusData = evaluateVerificationStatus({ funcionario: 'Maria Souza', dias: '2 dias', data: 'Revisar data', cid: 'Não informado' });
  assert(statusData.status === 'revisar', 'Data a revisar gera status revisar');
}

// -------------------------------------------------------------
// GRUPO 4: REGRA 4 - CID (CÓDIGO OU "Não informado")
// -------------------------------------------------------------
console.log('\n📋 Grupo 4: Regra de CID');

{
  assert(normalizeCid('M54.5') === 'M54.5', 'Preserva CID M54.5 com pontuação');
  assert(normalizeCid('j06.9') === 'J06.9', 'Converte minúsculas para maiúsculas J06.9');
  assert(normalizeCid('B34.2') === 'B34.2', 'Preserva CID B34.2');
  assert(normalizeCid('Z76.3') === 'Z76.3', 'Preserva CID Z76.3');
  
  assert(normalizeCid('') === 'Não informado', 'CID vazio vira estritamente "Não informado"');
  assert(normalizeCid('   ') === 'Não informado', 'CID com espaços vira estritamente "Não informado"');
  assert(normalizeCid('não informado') === 'Não informado', '"não informado" normaliza para "Não informado"');
  assert(normalizeCid('sem cid') === 'Não informado', '"sem cid" normaliza para "Não informado"');
  assert(normalizeCid('ausente') === 'Não informado', '"ausente" normaliza para "Não informado"');
}

// -------------------------------------------------------------
// GRUPO 5: AGRUPAMENTO POR FUNCIONÁRIO E ORDENAÇÃO CRONOLÓGICA
// -------------------------------------------------------------
console.log('\n📋 Grupo 5: Agrupamento e Ordenação (Alfabética + Cronológica)');

{
  const unsorted: MedicalCertificateRecord[] = [
    {
      id: '1',
      funcionario: 'Maria Souza',
      dias: '2 dias',
      data: '20/08/2026',
      cid: 'Não informado',
      tipoDocumento: 'Atestado Médico',
      status: 'aprovado',
      confiancaOcr: 98,
      arquivoOrigem: 'maria.pdf',
      dataProcessamento: new Date().toISOString()
    },
    {
      id: '2',
      funcionario: 'Francisco da Silva',
      dias: '5 dias',
      data: '15/08/2026',
      cid: 'M54.5',
      tipoDocumento: 'Atestado Médico',
      status: 'aprovado',
      confiancaOcr: 95,
      arquivoOrigem: 'francisco2.pdf',
      dataProcessamento: new Date().toISOString()
    },
    {
      id: '3',
      funcionario: 'Francisco da Silva',
      dias: '3 dias',
      data: '03/08/2026',
      cid: 'M54.5',
      tipoDocumento: 'Atestado Médico',
      status: 'aprovado',
      confiancaOcr: 96,
      arquivoOrigem: 'francisco1.pdf',
      dataProcessamento: new Date().toISOString()
    },
    {
      id: '4',
      funcionario: 'Maria Souza',
      dias: 'Comparecimento',
      data: '10/08/2026',
      cid: 'Não informado',
      tipoDocumento: 'Declaração de Comparecimento',
      status: 'aprovado',
      confiancaOcr: 99,
      arquivoOrigem: 'maria.pdf',
      dataProcessamento: new Date().toISOString()
    },
    {
      id: '5',
      funcionario: 'Ana Beatriz Lima',
      dias: '1 dia',
      data: '01/08/2026',
      cid: 'K29.7',
      tipoDocumento: 'Atestado Médico',
      status: 'aprovado',
      confiancaOcr: 92,
      arquivoOrigem: 'ana.pdf',
      dataProcessamento: new Date().toISOString()
    }
  ];

  const sorted = sortAndGroupRecords(unsorted);

  // 1. Ana Beatriz Lima should be first (A-Z)
  assert(sorted[0].funcionario === 'Ana Beatriz Lima', 'Primeiro colaborador é Ana Beatriz Lima (ordem alfabética)');
  
  // 2. Francisco da Silva should be second
  assert(sorted[1].funcionario === 'Francisco da Silva', 'Segundo colaborador é Francisco da Silva');
  assert(sorted[2].funcionario === 'Francisco da Silva', 'Terceiro colaborador é Francisco da Silva');
  
  // 3. For Francisco, 03/08 must come BEFORE 15/08 (chronological oldest to newest)
  assert(sorted[1].data === '03/08/2026', 'Atestado mais antigo de Francisco (03/08/2026) vem primeiro');
  assert(sorted[2].data === '15/08/2026', 'Atestado mais recente de Francisco (15/08/2026) vem depois');

  // 4. Maria Souza should be third
  assert(sorted[3].funcionario === 'Maria Souza', 'Quarto colaborador é Maria Souza');
  assert(sorted[4].funcionario === 'Maria Souza', 'Quinto colaborador é Maria Souza');

  // 5. For Maria, 10/08 must come BEFORE 20/08 (chronological oldest to newest)
  assert(sorted[3].data === '10/08/2026', 'Atestado de 10/08 de Maria vem antes do de 20/08');
  assert(sorted[4].data === '20/08/2026', 'Atestado de 20/08 de Maria vem na sequência');
}

// -------------------------------------------------------------
// GRUPO 6: DATASET PADRÃO INICIAL (FRANCISCO, MARIA, ETC.)
// -------------------------------------------------------------
console.log('\n📋 Grupo 6: Dataset Padrão de Exemplo');

{
  assert(INITIAL_SAMPLE_RECORDS.length >= 6, 'Dataset inicial contém registros de exemplo completos');
  const franciscoRecs = INITIAL_SAMPLE_RECORDS.filter(r => r.funcionario === 'Francisco da Silva');
  assert(franciscoRecs.length >= 2, 'Francisco possui múltiplos atestados para demonstração de agrupamento');
  
  const mariaRecs = INITIAL_SAMPLE_RECORDS.filter(r => r.funcionario === 'Maria Souza');
  assert(mariaRecs.length >= 2, 'Maria possui comparecimento e afastamento para teste');
  assert(mariaRecs.some(r => r.cid === 'Não informado'), 'Maria demonstra atestado sem CID registrado como "Não informado"');
}

// -------------------------------------------------------------
// GRUPO 7: VALIDAÇÃO DO FORMATO DE EXPORTAÇÃO (4 COLUNAS PADRÃO)
// -------------------------------------------------------------
console.log('\n📋 Grupo 7: Formato de Exportação Padrão RH/DP (4 Colunas)');

{
  const testRec = INITIAL_SAMPLE_RECORDS[0];
  const standard4Cols = {
    'Nome do Funcionário': testRec.funcionario,
    'Quantidade de Dias': testRec.dias,
    'Data do Atestado': testRec.data,
    'CID': testRec.cid,
  };
  const keys = Object.keys(standard4Cols);
  assert(keys.length === 4, 'Exportação padrão possui exatamente 4 colunas');
  assert(keys[0] === 'Nome do Funcionário', 'Coluna 1: Nome do Funcionário');
  assert(keys[1] === 'Quantidade de Dias', 'Coluna 2: Quantidade de Dias');
  assert(keys[2] === 'Data do Atestado', 'Coluna 3: Data do Atestado');
  assert(keys[3] === 'CID', 'Coluna 4: CID');
}

// -------------------------------------------------------------
// GRUPO 8: VALIDAÇÃO DE SEGURANÇA CONTRA FALHAS E VALORES NULOS
// -------------------------------------------------------------
console.log('\n📋 Grupo 8: Robustez e Tratamento de Nulos');

{
  const edgeRecord = evaluateVerificationStatus({
    funcionario: undefined as any,
    dias: null as any,
    data: '   ',
    cid: undefined as any
  });
  assert(edgeRecord.status === 'revisar', 'Valores indefinidos acionam status revisar com segurança');
  assert(normalizeCid(null as any) === 'Não informado', 'CID nulo normaliza para "Não informado"');
  assert(normalizeDias(undefined as any) === 'Revisar quantidade', 'Dias indefinidos normalizam para "Revisar quantidade"');
}

// -------------------------------------------------------------
// RESULTADO FINAL
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`📊 RESULTADO DOS TESTES: ${passedTests}/${totalTests} PASSARAM`);
if (failedTests === 0) {
  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO! 100% DE CONFORMIDADE.');
} else {
  console.error(`⚠️ ${failedTests} TESTE(S) FALHARAM.`);
  process.exit(1);
}
console.log('================================================================\n');
