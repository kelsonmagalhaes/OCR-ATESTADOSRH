import React from 'react';
import { 
  UploadCloud, 
  Table2, 
  FileCheck, 
  ShieldCheck, 
  ScanText, 
  ArrowRight, 
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  Lock,
  Layers
} from 'lucide-react';

interface HomeCoverProps {
  onStartProcessing: () => void;
  onViewRecords: () => void;
  onLoadSampleData: () => void;
  recordsCount: number;
}

export const HomeCover: React.FC<HomeCoverProps> = ({
  onStartProcessing,
  onViewRecords,
  onLoadSampleData,
  recordsCount,
}) => {
  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col justify-between">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 w-full">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Institutional Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold tracking-wide">
            <ScanText className="w-3.5 h-3.5 text-blue-600" />
            <span>TECNOLOGIA OCR & INTELIGÊNCIA ARTIFICIAL VERDENT</span>
          </div>

          {/* Primary App Name */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Gestão de Atestados Médicos
          </h1>

          {/* Subtitle / Informative text */}
          <p className="text-lg sm:text-xl text-slate-600 font-medium leading-relaxed">
            Organização, conferência e exportação de documentos para Departamento Pessoal e Recursos Humanos
          </p>

          {/* Core Service Statement (Exact text required) */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl shadow-xs text-slate-700 text-sm sm:text-base leading-relaxed border-l-4 border-l-blue-600 text-left sm:text-center">
            <span className="font-semibold text-slate-900">Serviço do sistema: </span>
            “Leitura automatizada, organização, conferência e exportação de atestados médicos para uso em rotinas de Departamento Pessoal e RH.”
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              id="btn-iniciar-processamento"
              onClick={onStartProcessing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-base shadow-sm transition-all hover:shadow-md cursor-pointer"
            >
              <UploadCloud className="w-5 h-5" />
              <span>Iniciar processamento</span>
              <ArrowRight className="w-4 h-4 text-blue-200" />
            </button>

            <button
              id="btn-consultar-registros"
              onClick={onViewRecords}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-base border border-slate-300 shadow-xs transition-colors cursor-pointer"
            >
              <Table2 className="w-5 h-5 text-slate-500" />
              <span>Consultar registros</span>
              {recordsCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-full">
                  {recordsCount}
                </span>
              )}
            </button>

            <button
              id="btn-carregar-exemplo"
              onClick={onLoadSampleData}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors cursor-pointer"
              title="Carrega atestados fictícios demonstrativos conforme o modelo (Francisco da Silva, Maria Souza, etc.)"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Carregar dados de exemplo</span>
            </button>
          </div>
        </div>

        {/* Feature Cards Grid (Corporate / Functional) */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-4 font-bold">
              1
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">
              Leitura de Qualquer Formato
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Processamento de PDFs nativos ou digitalizados, fotos, imagens (JPG, PNG) e documentos manuscritos ou preenchidos à mão com extração página a página.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-4 font-bold">
              2
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">
              Agrupamento & Organização
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Registros agrupados rigorosamente por funcionário em linhas consecutivas, ordenados em ordem cronológica de atendimento e colaboradores em ordem alfabética.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-4 font-bold">
              3
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">
              Exportação para DP e RH
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Exportação nas 4 colunas padrão (Nome, Dias, Data, CID) em Excel (.xlsx), CSV delimitado por ponto e vírgula com UTF-8, ou cópia instantânea para planilhas.
            </p>
          </div>
        </div>

        {/* Strict Compliance Banner */}
        <div className="mt-10 bg-slate-100 rounded-xl p-4 sm:p-5 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-amber-700">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">
                Aviso Obrigatório de Conformidade
              </div>
              <div className="text-xs text-slate-600">
                Os dados extraídos por OCR devem ser conferidos pelo usuário antes da utilização em rotinas oficiais de Departamento Pessoal ou Recursos Humanos.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 shrink-0">
            <Lock className="w-4 h-4 text-slate-500" />
            <span>Sigilo Médico & LGPD</span>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <footer className="border-t border-slate-200 bg-white py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Verdent © 2026 — Gestão e Importação de Atestados Médicos para DP e RH</span>
          <span>Versão Profissional Corporativa 2.4</span>
        </div>
      </footer>
    </div>
  );
};
