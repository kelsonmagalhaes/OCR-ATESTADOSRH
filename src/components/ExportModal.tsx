import React, { useState } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Copy, 
  Check, 
  X, 
  CheckCircle2, 
  Building2, 
  AlertCircle,
  Table2
} from 'lucide-react';
import { MedicalCertificateRecord } from '../types';
import { downloadExcel, downloadCsv, copyTableToClipboard } from '../utils/exportUtils';

interface ExportModalProps {
  records: MedicalCertificateRecord[];
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ records, onClose }) => {
  const [exportMode, setExportMode] = useState<'padrao' | 'detalhado'>('padrao');
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);

  const handleDownloadExcel = () => {
    const filename = exportMode === 'padrao' 
      ? `Atestados_Medicos_Padrao_${new Date().toISOString().slice(0, 10)}.xlsx`
      : `Atestados_Medicos_Detalhado_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    downloadExcel(records, filename, exportMode === 'detalhado');
    setDownloadSuccessMsg('Arquivo Excel gerado com sucesso.');
    setTimeout(() => setDownloadSuccessMsg(null), 4000);
  };

  const handleDownloadCsv = () => {
    const filename = exportMode === 'padrao' 
      ? `Atestados_Medicos_Padrao_${new Date().toISOString().slice(0, 10)}.csv`
      : `Atestados_Medicos_Detalhado_${new Date().toISOString().slice(0, 10)}.csv`;

    downloadCsv(records, filename, exportMode === 'detalhado');
    setDownloadSuccessMsg('Arquivo CSV gerado com sucesso.');
    setTimeout(() => setDownloadSuccessMsg(null), 4000);
  };

  const handleCopyTable = async () => {
    const success = await copyTableToClipboard(records, exportMode === 'detalhado');
    if (success) {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    }
  };

  const handleExportRh = (format: 'xlsx' | 'csv') => {
    const dateStr = new Date().toISOString().slice(0, 10);
    if (format === 'xlsx') {
      downloadExcel(records, `Importacao_RH_DP_Atestados_${dateStr}.xlsx`, false);
      setDownloadSuccessMsg('Arquivo Excel para importação no RH/DP gerado com sucesso.');
    } else {
      downloadCsv(records, `Importacao_RH_DP_Atestados_${dateStr}.csv`, false);
      setDownloadSuccessMsg('Arquivo CSV para importação no RH/DP gerado com sucesso.');
    }
    setTimeout(() => setDownloadSuccessMsg(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 leading-tight">
                Exportação de Atestados Médicos
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Exportando exclusivamente os <strong className="text-slate-800">{records.length}</strong> registro(s) do lote selecionado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success notification */}
        {downloadSuccessMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{downloadSuccessMsg}</span>
          </div>
        )}

        {/* Layout selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Estrutura da Planilha
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setExportMode('padrao')}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                exportMode === 'padrao'
                  ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="font-bold text-sm text-slate-900 flex items-center justify-between">
                <span>Padrão RH / DP (4 Colunas)</span>
                {exportMode === 'padrao' && <Check className="w-4 h-4 text-blue-700" />}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Nome do Funcionário, Quantidade de Dias, Data do Atestado, CID. Estrutura pura e sem colunas excedentes.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setExportMode('detalhado')}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                exportMode === 'detalhado'
                  ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="font-bold text-sm text-slate-900 flex items-center justify-between">
                <span>Modo Detalhado Completo</span>
                {exportMode === 'detalhado' && <Check className="w-4 h-4 text-blue-700" />}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Inclui horários, unidades de saúde, profissionais/CRM, observações clínicas e arquivo de origem.
              </p>
            </button>
          </div>
        </div>

        {/* Export Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* 1. Baixar Excel */}
          <button
            id="btn-modal-baixar-excel"
            onClick={handleDownloadExcel}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-left transition-all cursor-pointer group"
          >
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900">Baixar Excel (.xlsx)</div>
              <div className="text-xs text-slate-500">Formatação pronta para MS Excel e Sheets</div>
            </div>
          </button>

          {/* 2. Baixar CSV */}
          <button
            id="btn-modal-baixar-csv"
            onClick={handleDownloadCsv}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-left transition-all cursor-pointer group"
          >
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900">Baixar CSV (.csv)</div>
              <div className="text-xs text-slate-500">Separado por ";" com UTF-8 e aspas</div>
            </div>
          </button>

          {/* 3. Copiar Tabela */}
          <button
            id="btn-modal-copiar-tabela"
            onClick={handleCopyTable}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-left transition-all cursor-pointer group"
          >
            <div className={`p-2.5 rounded-lg transition-colors ${
              copiedSuccess ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-slate-700 group-hover:text-white'
            }`}>
              {copiedSuccess ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900">
                {copiedSuccess ? 'Copiado com Sucesso!' : 'Copiar Tabela'}
              </div>
              <div className="text-xs text-slate-500">Cole diretamente com Ctrl+V na planilha</div>
            </div>
          </button>

          {/* 4. Exportar para RH */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-col justify-between gap-2">
            <div>
              <div className="font-bold text-sm text-blue-900 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-700" />
                <span>Exportar para RH</span>
              </div>
              <div className="text-xs text-blue-700 mt-0.5">
                Estrutura pura sem mesclagem ou fórmulas
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleExportRh('xlsx')}
                className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-md cursor-pointer transition-colors"
              >
                Gerar XLSX
              </button>
              <button
                onClick={() => handleExportRh('csv')}
                className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-md cursor-pointer transition-colors"
              >
                Gerar CSV
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
