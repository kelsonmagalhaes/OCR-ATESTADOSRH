export type VerificationStatus = 'aprovado' | 'revisar' | 'incompleto' | 'baixa_confianca';

export interface MedicalCertificateRecord {
  id: string;
  // Standard 4 columns
  funcionario: string;        // Nome do Funcionário
  dias: string;               // Quantidade de Dias (e.g. "3 dias", "Comparecimento", "Revisar quantidade")
  data: string;               // Data do Atestado (DD/MM/AAAA)
  cid: string;                // CID (e.g. "M54.5" or "Não informado")

  // Detailed fields
  tipoDocumento?: string;     // Atestado Médico, Declaração de Comparecimento, etc.
  horario?: string;           // Ex: 08:00 às 12:00
  local?: string;             // Hospital / Clínica / UBS
  profissional?: string;      // Dr(a)... CRM/CRO...
  observacao?: string;        // Observações adicionais

  // Origin tracking & Confidence
  arquivoOrigem: string;      // Nome do arquivo de origem
  paginaOrigem?: number;      // Número da página no documento
  status: VerificationStatus;
  motivoRevisao?: string;     // Explicação do motivo de conferência
  confiancaOcr?: number;      // 0 a 100%
  dataProcessamento?: string;
}

export interface FileItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  type: string;
  base64?: string;
  status: 'pendente' | 'processando' | 'concluido' | 'erro' | 'ilegivel';
  errorMessage?: string;
  paginasIlegiveis?: number[];
  totalPaginas?: number;
  paginaAtual?: number;
  registrosExtraidos?: number;
  confiancaOcr?: number;
  isReprocessing?: boolean;
}

export interface ProcessedBatch {
  id: string;
  dataHora: string;
  nomeLote: string;
  responsavel: string;
  totalArquivos: number;
  totalRegistros: number;
  precisamRevisao: number;
  registros: MedicalCertificateRecord[];
  arquivos: {
    nome: string;
    tamanho: number;
    status: string;
    erro?: string;
  }[];
}

export interface AppSettings {
  responsavelPadrao: string;
  empresaPadrao: string;
  retencaoDias: number;
  ordenacaoPadrao: 'nome' | 'data';
  mostrarAvisoAntesSair: boolean;
}
