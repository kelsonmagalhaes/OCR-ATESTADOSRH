import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Check, 
  AlertTriangle, 
  X, 
  FileText, 
  ArrowRight,
  Loader2,
  Table2,
  AlertCircle
} from 'lucide-react';
import { MedicalCertificateRecord } from '../types';
import { parseImportFile, ImportPreviewResult } from '../utils/importUtils';

interface ImportModalProps {
  onImportConfirmed: (records: MedicalCertificateRecord[], append: boolean) => void;
  onClose: () => void;
  existingCount: number;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  onImportConfirmed,
  onClose,
  existingCount,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setSelectedFile(file);
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await parseImportFile(file);
      setPreviewResult(result);
    } catch (err: any) {
      console.error('Erro na importação:', err);
      setErrorMessage(err.message || 'Falha ao analisar arquivo da planilha.');
      setPreviewResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!previewResult || previewResult.records.length === 0) return;
    onImportConfirmed(previewResult.records, importMode === 'append');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 leading-tight">
                Importar Planilha Existente
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Formatos aceitos: Microsoft Excel (.xlsx, .xls) ou CSV delimitado por ponto e vírgula (;)
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

        {/* File Select Area */}
        {!previewResult && (
          <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center bg-slate-50/50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3 shadow-xs">
              <UploadCloud className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              Selecione o arquivo da planilha para importar
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              O sistema identificará automaticamente as colunas de Funcionário, Dias, Data e CID
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="mt-4 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analisando arquivo...</span>
                </>
              ) : (
                <span>Escolher Arquivo</span>
              )}
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Erro de leitura: </span>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Preview Section */}
        {previewResult && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-700" />
                <div>
                  <div className="font-bold text-sm text-slate-900">{selectedFile?.name}</div>
                  <div className="text-xs text-blue-800">
                    {previewResult.totalRows} linha(s) identificada(s) com sucesso
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setPreviewResult(null);
                  setSelectedFile(null);
                }}
                className="text-xs text-blue-700 underline hover:text-blue-900"
              >
                Trocar arquivo
              </button>
            </div>

            {/* Warnings if any */}
            {previewResult.errors.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Avisos de Mapeamento:
                </div>
                <ul className="list-disc list-inside pl-1 space-y-0.5">
                  {previewResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview Table snippet */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Funcionário</th>
                    <th className="py-2 px-3">Dias</th>
                    <th className="py-2 px-3">Data</th>
                    <th className="py-2 px-3">CID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewResult.records.slice(0, 5).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-900">{r.funcionario}</td>
                      <td className="py-2 px-3 text-slate-700">{r.dias}</td>
                      <td className="py-2 px-3 text-slate-700 font-mono">{r.data}</td>
                      <td className="py-2 px-3 text-slate-700 font-mono">{r.cid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewResult.records.length > 5 && (
                <div className="p-2 bg-slate-50 text-center text-slate-500 text-xs border-t border-slate-100">
                  E mais {previewResult.records.length - 5} linha(s)...
                </div>
              )}
            </div>

            {/* Avoid erasing existing data requirement */}
            {existingCount > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="font-semibold text-slate-800">
                  Como deseja integrar com os {existingCount} registro(s) já existentes na tela?
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Acrescentar aos dados atuais (Recomendado)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-red-700">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span>Substituir dados atuais</span>
                  </label>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-importacao"
                onClick={handleConfirm}
                className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Confirmar Importação ({previewResult.records.length} atestados)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
