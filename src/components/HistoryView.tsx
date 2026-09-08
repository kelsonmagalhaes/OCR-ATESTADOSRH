import React, { useState } from 'react';
import { 
  History, 
  Calendar, 
  FileText, 
  Download, 
  Trash2, 
  Eye, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  FolderOpen,
  User,
  Layers,
  ArrowRight
} from 'lucide-react';
import { ProcessedBatch, MedicalCertificateRecord } from '../types';
import { downloadExcel, downloadCsv } from '../utils/exportUtils';

interface HistoryViewProps {
  batches: ProcessedBatch[];
  onOpenBatch: (batch: ProcessedBatch, editMode: boolean) => void;
  onDeleteBatch: (id: string) => void;
  onStartNewProcessing: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  batches,
  onOpenBatch,
  onDeleteBatch,
  onStartNewProcessing,
}) => {
  const [downloadModalBatch, setDownloadModalBatch] = useState<ProcessedBatch | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<{ id: string; name: string } | null>(null);

  const confirmDelete = () => {
    if (batchToDelete) {
      onDeleteBatch(batchToDelete.id);
      setBatchToDelete(null);
    }
  };

  const handleDownloadBatch = (batch: ProcessedBatch, format: 'xlsx' | 'csv') => {
    const filename = `${batch.nomeLote.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
    if (format === 'xlsx') {
      downloadExcel(batch.registros, `${filename}.xlsx`, false);
    } else {
      downloadCsv(batch.registros, `${filename}.csv`, false);
    }
    setDownloadModalBatch(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <History className="w-7 h-7 text-blue-700" />
            Registros Processados
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Histórico de lotes de atestados lidos por OCR com conferência e download sob demanda
          </p>
        </div>

        <button
          onClick={onStartNewProcessing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <span>Processar Novo Lote</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Batches List */}
      {batches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              Nenhum lote processado registrado no histórico
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Assim que você enviar e processar documentos de atestados ou salvar suas alterações na planilha, eles ficarão catalogados aqui para conferência e re-download.
            </p>
          </div>
          <button
            onClick={onStartNewProcessing}
            className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Iniciar Primeiro Processamento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {batches.map((batch) => {
            const formattedDate = new Date(batch.dataHora).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={batch.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-base font-bold text-slate-900">
                      {batch.nomeLote}
                    </h3>
                    <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-800 rounded-full border border-blue-200">
                      {batch.totalRegistros} atestado(s)
                    </span>
                    {batch.precisamRevisao > 0 && (
                      <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-800 rounded-full border border-amber-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        {batch.precisamRevisao} para revisar
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formattedDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      {batch.totalArquivos} arquivo(s) de origem
                    </span>
                    {batch.responsavel && (
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Responsável: <strong className="text-slate-700">{batch.responsavel}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Buttons required: Abrir, Editar, Baixar novamente, Excluir com confirmação */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                  <button
                    onClick={() => onOpenBatch(batch, false)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                    title="Visualizar atestados na planilha"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>Abrir</span>
                  </button>

                  <button
                    onClick={() => onOpenBatch(batch, true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition-colors cursor-pointer border border-blue-200"
                    title="Editar informações dos atestados"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-700" />
                    <span>Editar</span>
                  </button>

                  <button
                    onClick={() => setDownloadModalBatch(batch)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors cursor-pointer border border-emerald-200"
                    title="Baixar planilha novamente"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Baixar</span>
                  </button>

                  <button
                    onClick={() => setBatchToDelete({ id: batch.id, name: batch.nomeLote })}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Excluir histórico"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Excluir Lote</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Deseja realmente excluir o lote <strong className="text-slate-900 font-semibold">"{batchToDelete.name}"</strong> do histórico? Esta ação é irreversível.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setBatchToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Choice Modal */}
      {downloadModalBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h4 className="text-base font-bold text-slate-900">
              Baixar Lote: {downloadModalBatch.nomeLote}
            </h4>
            <p className="text-xs text-slate-500">
              Selecione o formato para download dos {downloadModalBatch.totalRegistros} atestados médicos:
            </p>
            <div className="space-y-2 pt-1">
              <button
                onClick={() => handleDownloadBatch(downloadModalBatch, 'xlsx')}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => handleDownloadBatch(downloadModalBatch, 'csv')}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Baixar CSV (; com UTF-8)</span>
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDownloadModalBatch(null)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
