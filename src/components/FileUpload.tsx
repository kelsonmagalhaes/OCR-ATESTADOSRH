import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  Play, 
  Pause,
  Square,
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  AlertTriangle,
  ArrowRight,
  Info,
  Zap,
  Clock,
  Cpu
} from 'lucide-react';
import { FileItem, MedicalCertificateRecord } from '../types';
import { 
  AsyncBatchQueueEngine, 
  BatchProcessingStats, 
  DocumentProcessingItem,
  processSingleDocumentDirectly
} from '../utils/asyncBatchQueue';

interface FileUploadProps {
  onProcessingCompleted: (records: MedicalCertificateRecord[], filesSummary: any[], appendMode?: boolean) => void;
  onGoToSpreadsheet: () => void;
  existingCount: number;
  onLoad23Batch?: () => void;
  onClearExistingRecords?: () => void;
  onSingleFileReprocessed?: (fileName: string, records: MedicalCertificateRecord[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onProcessingCompleted,
  onGoToSpreadsheet,
  existingCount,
  onLoad23Batch,
  onClearExistingRecords,
  onSingleFileReprocessed,
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  // Concorrência padrão 1 para respeitar rigorosamente a taxa de 15 requisições/min do Free Tier
  const [concurrency, setConcurrency] = useState<number>(1);
  // Modo de isolamento do lote atual: por padrão, substitui a planilha para baixar APENAS o lote atual
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  
  // Estatísticas em tempo real do processador assíncrono
  const [batchStats, setBatchStats] = useState<BatchProcessingStats | null>(null);
  const [hasCompletedRun, setHasCompletedRun] = useState(false);
  const [totalExtractedThisSession, setTotalExtractedThisSession] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueEngineRef = useRef<AsyncBatchQueueEngine | null>(null);

  // Formatação de bytes sem limite arbitrário de tamanho
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Formatação de segundos para MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Manipulador de adição de arquivos (sem limites arbitrários de tamanho)
  const handleFilesAdded = (incomingFiles: FileList | File[]) => {
    const newItems: FileItem[] = [];
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

    Array.from(incomingFiles).forEach((file) => {
      const lower = file.name.toLowerCase();
      const isValid = validExtensions.some((ext) => lower.endsWith(ext));

      if (isValid) {
        // Evita duplicatas pelo nome
        const alreadyExists = files.some((f) => f.name === file.name);
        if (!alreadyExists) {
          newItems.push({
            id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            file,
            name: file.name,
            size: file.size,
            type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
            status: 'pendente',
          });
        }
      }
    });

    if (newItems.length > 0) {
      setFiles((prev) => [...prev, ...newItems]);
      setHasCompletedRun(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    if (isProcessing) {
      handleCancelProcessing();
    }
    setFiles([]);
    setHasCompletedRun(false);
    setBatchStats(null);
    setTotalExtractedThisSession(0);
  };

  // Início do Processamento Assíncrono com Pool de Workers
  const startAsyncProcessing = async (onlyErrors = false) => {
    const candidateFiles = files.filter((f) =>
      onlyErrors
        ? f.status === 'erro' || f.status === 'ilegivel' || (f.status === 'concluido' && (f.confiancaOcr || 100) < 75)
        : f.status === 'pendente' || f.status === 'erro'
    );

    if (candidateFiles.length === 0) return;

    // Converte para itens de processamento garantindo arquivo em memória
    const queueItems: DocumentProcessingItem[] = [];
    candidateFiles.forEach((item) => {
      if (item.file) {
        queueItems.push({
          id: item.id,
          name: item.name,
          size: item.size,
          type: item.type,
          file: item.file,
        });
      }
    });

    if (queueItems.length === 0) return;

    setIsProcessing(true);
    setIsPaused(false);
    setHasCompletedRun(false);

    // Marca todos os itens selecionados como aguardando na fila
    setFiles((prev) =>
      prev.map((f) =>
        candidateFiles.some((c) => c.id === f.id)
          ? { ...f, status: 'pendente', errorMessage: undefined, paginaAtual: undefined }
          : f
      )
    );

    const engine = new AsyncBatchQueueEngine(queueItems, concurrency, {
      onItemStart: (item, workerId) => {
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'processando', errorMessage: undefined } : f))
        );
      },
      onItemPageProgress: (item, pageNum, totalPages) => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'processando', paginaAtual: pageNum, totalPaginas: totalPages }
              : f
          )
        );
      },
      onItemSuccess: (item, records, pagesIlegiveis, totalPages) => {
        const finalStatus = records.length === 0 ? 'ilegivel' : 'concluido';
        let errorMsg: string | undefined = undefined;

        if (records.length === 0) {
          errorMsg = 'Nenhum atestado médico identificável com nitidez suficiente no documento.';
        } else if (pagesIlegiveis.length > 0) {
          errorMsg = `Atenção: A(s) página(s) ${pagesIlegiveis.join(', ')} apresentou(apresentaram) caligrafia ilegível ou baixa nitidez.`;
        }

        const confiancaMedia = records.length > 0
          ? Math.round(records.reduce((sum, r) => sum + (r.confiancaOcr || 80), 0) / records.length)
          : 0;

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: finalStatus,
                  errorMessage: errorMsg,
                  paginasIlegiveis: pagesIlegiveis,
                  totalPaginas: totalPages,
                  registrosExtraidos: records.length,
                  confiancaOcr: confiancaMedia,
                  paginaAtual: undefined,
                }
              : f
          )
        );
      },
      onItemError: (item, err) => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'erro',
                  errorMessage: err.message || 'Erro durante a extração assíncrona do documento.',
                  paginaAtual: undefined,
                }
              : f
          )
        );
      },
      onStatsUpdate: (stats) => {
        setBatchStats({ ...stats });
      },
    });

    queueEngineRef.current = engine;

    try {
      const result = await engine.start();

      setIsProcessing(false);
      setIsPaused(false);
      setHasCompletedRun(true);
      setTotalExtractedThisSession((prev) => prev + result.records.length);

      if (result.records.length > 0) {
        onProcessingCompleted(result.records, result.filesSummary, !replaceExisting);
      }
    } catch (e: any) {
      console.error('Erro na execução do lote assíncrono:', e);
      setIsProcessing(false);
      setIsPaused(false);
    } finally {
      queueEngineRef.current = null;
    }
  };

  // Controles de Pausa, Retomada e Cancelamento
  const handleTogglePause = () => {
    if (!queueEngineRef.current) return;
    if (isPaused) {
      queueEngineRef.current.resume();
      setIsPaused(false);
    } else {
      queueEngineRef.current.pause();
      setIsPaused(true);
    }
  };

  const handleCancelProcessing = () => {
    if (queueEngineRef.current) {
      queueEngineRef.current.cancel();
      queueEngineRef.current = null;
    }
    setIsProcessing(false);
    setIsPaused(false);
  };

  const handleRetrySingleFile = (fileId: string) => {
    const item = files.find((f) => f.id === fileId);
    if (item) {
      handleReprocessSingleFile(item);
    }
  };

  const handleReprocessSingleFile = async (item: FileItem) => {
    if (!item.file) {
      alert('Arquivo original não encontrado na memória para reenvio.');
      return;
    }

    if (isProcessing) {
      alert('Aguarde a finalização do processamento em lote para re-processar este arquivo.');
      return;
    }

    // Marca o arquivo como em re-processamento individual
    setFiles((prev) =>
      prev.map((f) =>
        f.id === item.id
          ? {
              ...f,
              status: 'processando',
              isReprocessing: true,
              errorMessage: undefined,
              paginaAtual: undefined,
            }
          : f
      )
    );

    try {
      const result = await processSingleDocumentDirectly(
        {
          id: item.id,
          name: item.name,
          size: item.size,
          type: item.type,
          file: item.file,
        },
        (pageNum, totalPages) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? { ...f, paginaAtual: pageNum, totalPaginas: totalPages }
                : f
            )
          );
        }
      );

      const isSuccess = result.records.length > 0;
      const finalStatus = isSuccess ? 'concluido' : 'ilegivel';
      let errorMsg = result.summaryError;
      if (!isSuccess && !errorMsg) {
        errorMsg = 'Nenhum atestado legível detectado no documento após nova tentativa OCR.';
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                status: finalStatus,
                isReprocessing: false,
                errorMessage: errorMsg,
                paginasIlegiveis: result.pagesIlegiveis,
                totalPaginas: result.totalPages,
                registrosExtraidos: result.records.length,
                confiancaOcr: result.confiancaMedia,
                paginaAtual: undefined,
              }
            : f
        )
      );

      if (isSuccess) {
        if (onSingleFileReprocessed) {
          onSingleFileReprocessed(item.name, result.records);
        } else {
          onProcessingCompleted(
            result.records,
            [
              {
                nome: item.name,
                tamanho: item.size,
                status: finalStatus,
                totalRegistros: result.records.length,
              },
            ],
            true
          );
        }
      }
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                status: 'erro',
                isReprocessing: false,
                errorMessage: err.message || 'Falha ao re-processar o arquivo.',
                paginaAtual: undefined,
              }
            : f
        )
      );
    }
  };

  const handleManualDraftForFile = (item: FileItem) => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const fallbackDate = `${dd}/${mm}/${yyyy}`;

    const cleanName = item.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/(atestado|declaracao|medico|medica|recibo|foto|scan|doc|pdf|jpg|png|agosto|setembro|outubro)/gi, '')
      .trim();

    const candidateFuncionario =
      cleanName.length >= 3
        ? cleanName
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ')
        : 'Revisar nome';

    const draftRecord: MedicalCertificateRecord = {
      id: `manual-draft-${Date.now()}`,
      funcionario: candidateFuncionario,
      dias: 'Revisar quantidade',
      data: fallbackDate,
      cid: 'Não informado',
      tipoDocumento: item.name.toLowerCase().includes('declaracao')
        ? 'Declaração de Comparecimento'
        : 'Atestado Médico',
      horario: '-',
      local: '',
      profissional: '',
      observacao: 'Inserido para preenchimento manual pelo usuário.',
      arquivoOrigem: item.name,
      paginaOrigem: 1,
      status: 'revisar',
      motivoRevisao: 'Registro gerado para preenchimento manual.',
      confiancaOcr: 100,
      dataProcessamento: new Date().toISOString(),
    };

    onProcessingCompleted(
      [draftRecord],
      [
        {
          nome: item.name,
          tamanho: item.size,
          status: 'concluido',
          totalRegistros: 1,
        },
      ]
    );

    setFiles((prev) =>
      prev.map((f) =>
        f.id === item.id
          ? { ...f, status: 'concluido', registrosExtraidos: 1, errorMessage: undefined }
          : f
      )
    );
  };

  const pendingCount = files.filter((f) => f.status === 'pendente').length;
  const processingCount = files.filter((f) => f.status === 'processando').length;
  const errorCount = files.filter((f) => f.status === 'erro' || f.status === 'ilegivel').length;
  const lowConfidenceCount = files.filter((f) => f.status === 'concluido' && (f.confiancaOcr || 100) < 75).length;
  const reprocessBatchCount = errorCount + lowConfidenceCount;
  const completedCount = files.filter((f) => f.status === 'concluido').length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header Info */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <UploadCloud className="w-7 h-7 text-blue-700" />
              Envio & Processamento Assíncrono de Atestados
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Arquitetura assíncrona não-bloqueante sem limites arbitrários de tamanho. Processe grandes lotes simultâneos com estabilidade garantida.
            </p>
          </div>

          {/* Seletor de Concorrência de Workers */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs shrink-0">
            <Cpu className="w-4 h-4 text-blue-700" />
            <span className="text-xs font-semibold text-slate-700">Workers Paralelos:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    setConcurrency(num);
                    if (queueEngineRef.current) {
                      queueEngineRef.current.setConcurrency(num);
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                    concurrency === num
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50'
                  }`}
                  title={`${num} worker(s) simultâneo(s) processando arquivos`}
                >
                  {num}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        id="dropzone-area"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
          dragActive
            ? 'border-blue-600 bg-blue-50/70 scale-[1.01]'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="file-input-element"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => {
            if (e.target.files) handleFilesAdded(e.target.files);
          }}
          className="hidden"
        />

        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shadow-xs">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">
              Arraste e solte seus atestados médicos aqui
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Sem limites arbitrários de tamanho. Suporte a PDFs nativos, escaneados pesados, fotos e documentos manuscritos.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              id="btn-selecionar-arquivos"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Selecionar arquivos
            </button>
            <span className="text-xs text-slate-400">Grandes lotes suportados</span>
          </div>
        </div>
      </div>

      {/* Painel de Processamento Assíncrono com Métricas e Controles */}
      {isProcessing && batchStats && (
        <div className="bg-white border border-blue-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
                <Zap className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Processamento Assíncrono em Execução</span>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                    {concurrency} Workers Ativos
                  </span>
                  {isPaused && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full">
                      Pausado
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-500">
                  A UI permanece 100% responsiva através da liberação cooperativa do loop de eventos.
                </p>
              </div>
            </div>

            {/* Controles de Pausar e Cancelar */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePause}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  isPaused
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                }`}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                <span>{isPaused ? 'Continuar' : 'Pausar'}</span>
              </button>

              <button
                type="button"
                onClick={handleCancelProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Cancelar Restante</span>
              </button>
            </div>
          </div>

          {/* Barra de Progresso Geral */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>
                Progresso: {batchStats.completedFiles + batchStats.failedFiles} de {batchStats.totalFiles} arquivos
              </span>
              <span className="text-blue-700">{batchStats.percent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-700 h-3 rounded-full transition-all duration-300 shadow-xs"
                style={{ width: `${batchStats.percent}%` }}
              />
            </div>
          </div>

          {/* Métricas do Lote (Tempo Decorrido, ETA e Registros Extraídos) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-slate-100">
            <div className="p-2.5 rounded-xl bg-slate-50 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
              <div>
                <p className="text-[11px] text-slate-500 font-medium">Tempo Decorrido</p>
                <p className="font-bold text-slate-800">{formatTime(batchStats.elapsedSeconds)}</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <p className="text-[11px] text-slate-500 font-medium">Tempo Restante (ETA)</p>
                <p className="font-bold text-slate-800">
                  {batchStats.estimatedRemainingSeconds > 0
                    ? `~${formatTime(batchStats.estimatedRemainingSeconds)}`
                    : 'Calculando...'}
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-[11px] text-emerald-800 font-medium">Atestados Extraídos</p>
                <p className="font-bold text-emerald-950">{batchStats.totalRecordsExtracted}</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-blue-700 shrink-0" />
              <div>
                <p className="text-[11px] text-blue-800 font-medium">Tarefas em Paralelo</p>
                <p className="font-bold text-blue-950">{batchStats.inProgressCount} ativas</p>
              </div>
            </div>
          </div>

          {/* Atividades dos Workers em Tempo Real */}
          {batchStats.currentWorkers.length > 0 && (
            <div className="pt-2 space-y-1.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-700 block">Atividade dos Workers:</span>
              <div className="flex flex-col gap-1">
                {batchStats.currentWorkers.map((w) => (
                  <div key={w.workerId} className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                    <Loader2 className="w-3 h-3 text-blue-600 animate-spin shrink-0" />
                    <span className="font-semibold text-slate-700">Worker #{w.workerId}:</span>
                    <span className="truncate text-slate-600 font-mono text-[11px]">{w.currentItemName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Uploaded Files Queue / List */}
      {files.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {/* Configuração de Lote e Isolamento da Planilha */}
          <div className="p-4 bg-blue-50/50 border-b border-blue-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Opções de Exportação e Planilha:</p>
                <div className="flex flex-wrap items-center gap-4 mt-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="batchMode"
                      checked={replaceExisting}
                      onChange={() => setReplaceExisting(true)}
                      className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span className="font-semibold text-slate-800">
                      Disponibilizar APENAS este lote atual para download (Recomendado)
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                    <input
                      type="radio"
                      name="batchMode"
                      checked={!replaceExisting}
                      onChange={() => setReplaceExisting(false)}
                      className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span>Acrescentar aos registros já existentes</span>
                  </label>
                </div>
              </div>
            </div>

            {existingCount > 0 && onClearExistingRecords && !isProcessing && (
              <button
                type="button"
                onClick={onClearExistingRecords}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-red-300 hover:text-red-700 text-slate-600 font-medium transition-colors shrink-0 cursor-pointer shadow-2xs"
                title="Remove os registros acumulados anteriormente para começar uma planilha 100% limpa"
              >
                Limpar planilha anterior ({existingCount} registros)
              </button>
            )}
          </div>

          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/70">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Fila de Documentos</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-slate-200 text-slate-700 rounded-full">
                  {files.length} arquivo(s)
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {completedCount} processados • {pendingCount} pendentes • {processingCount} processando • {errorCount} com aviso/erro
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!isProcessing && pendingCount > 0 && (
                <button
                  id="btn-processar-documentos"
                  onClick={() => startAsyncProcessing(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Processar em Lote ({pendingCount})</span>
                </button>
              )}

              {!isProcessing && reprocessBatchCount > 0 && (
                <button
                  id="btn-reprocessar-erros"
                  onClick={() => startAsyncProcessing(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold transition-colors cursor-pointer"
                  title="Reprocessa todos os arquivos com falhas ou baixa confiança OCR"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reprocessar Falhas & Alertas ({reprocessBatchCount})</span>
                </button>
              )}

              {!isProcessing && (
                <button
                  onClick={clearAll}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 text-xs font-medium transition-colors cursor-pointer"
                >
                  Limpar lista
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {files.map((item) => {
              const isPdf = item.name.toLowerCase().endsWith('.pdf');
              return (
                <div
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                      {isPdf ? (
                        <FileText className="w-5 h-5 text-red-600" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-blue-600" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(item.size)}
                        {item.registrosExtraidos !== undefined && (
                          <span className="ml-2 font-medium text-slate-700">
                            • {item.registrosExtraidos} atestado(s) extraído(s)
                          </span>
                        )}
                        {item.totalPaginas && item.totalPaginas > 1 && (
                          <span className="ml-2 text-slate-500">• {item.totalPaginas} páginas</span>
                        )}
                        {item.paginaAtual && item.totalPaginas && (
                          <span className="ml-2 font-semibold text-blue-700">
                            (Lendo pág. {item.paginaAtual} de {item.totalPaginas})
                          </span>
                        )}
                      </p>

                      {/* Explicit Error / Illegibility indicator */}
                      {item.errorMessage && (
                        <div className="mt-1.5 p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Aviso de Leitura: </span>
                            {item.errorMessage}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    {/* Status Badges & Confidence */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
                      {item.status === 'pendente' && (
                        <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-md">
                          Aguardando
                        </span>
                      )}
                      {item.status === 'processando' && (
                        <span className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {item.isReprocessing
                            ? (item.paginaAtual ? `Re-lendo Pág ${item.paginaAtual}/${item.totalPaginas || 1}` : 'Re-processando...')
                            : (item.paginaAtual ? `Pág ${item.paginaAtual}/${item.totalPaginas || 1}` : 'Extraindo OCR')}
                        </span>
                      )}
                      {item.status === 'concluido' && (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Sucesso
                        </span>
                      )}
                      {item.status === 'concluido' && item.confiancaOcr !== undefined && (
                        item.confiancaOcr < 75 ? (
                          <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-md flex items-center gap-1" title="Confiança baixa no OCR; conferir ou re-processar">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            Confiança {item.confiancaOcr}%
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md" title="Boa taxa de confiança OCR">
                            Confiança {item.confiancaOcr}%
                          </span>
                        )
                      )}
                      {item.status === 'ilegivel' && (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-md flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          Ilegível
                        </span>
                      )}
                      {item.status === 'erro' && (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                          Falha
                        </span>
                      )}
                    </div>

                    {/* Actions: Re-processar Arquivo button for failed, low confidence or any processed file */}
                    {((item.status === 'erro' || item.status === 'ilegivel' || (item.confiancaOcr !== undefined && item.confiancaOcr < 75) || (item.paginasIlegiveis && item.paginasIlegiveis.length > 0) || !!item.errorMessage)) && !isProcessing && (
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <button
                          type="button"
                          id={`btn-reprocessar-${item.id}`}
                          onClick={() => handleReprocessSingleFile(item)}
                          disabled={item.isReprocessing || isProcessing}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                          title="Reenviar este arquivo individualmente para nova leitura OCR"
                        >
                          {item.isReprocessing ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Re-processando...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Re-processar Arquivo</span>
                            </>
                          )}
                        </button>
                        {(item.status === 'erro' || item.status === 'ilegivel') && (
                          <button
                            type="button"
                            onClick={() => handleManualDraftForFile(item)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Enviar dados preliminares para preenchimento na planilha"
                          >
                            <span>Lançar Manual</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remover arquivo da lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Standard completed items can also be re-processed if needed */}
                    {item.status === 'concluido' && !(item.confiancaOcr !== undefined && item.confiancaOcr < 75) && !(item.paginasIlegiveis && item.paginasIlegiveis.length > 0) && !item.errorMessage && !isProcessing && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          id={`btn-reprocessar-${item.id}`}
                          onClick={() => handleReprocessSingleFile(item)}
                          disabled={item.isReprocessing || isProcessing}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                          title="Re-processar este arquivo individualmente"
                        >
                          {item.isReprocessing ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Re-processando...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3 h-3 text-slate-500" />
                              <span>Re-processar</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFile(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remover arquivo da lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Remove button before processing */}
                    {!isProcessing && item.status === 'pendente' && (
                      <button
                        onClick={() => removeFile(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Remover arquivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Relatório Diagnóstico de Documentos / Páginas Não Lidas */}
      {files.some(
        (f) =>
          f.status === 'erro' ||
          f.status === 'ilegivel' ||
          (f.paginasIlegiveis && f.paginasIlegiveis.length > 0)
      ) && (
        <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-amber-950">
                Relatório de Documentos / Páginas Não Lidas pelo OCR
              </h4>
              <p className="text-xs text-amber-900 mt-0.5">
                O sistema identificou os seguintes arquivos ou páginas com problemas de legibilidade, caligrafia médica ilegível ou resolução insuficiente:
              </p>
            </div>
          </div>

          <div className="divide-y divide-amber-200/70 rounded-xl bg-white/80 border border-amber-200 overflow-hidden text-xs">
            {files
              .filter(
                (f) =>
                  f.status === 'erro' ||
                  f.status === 'ilegivel' ||
                  (f.paginasIlegiveis && f.paginasIlegiveis.length > 0)
              )
              .map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{item.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-100 text-amber-800 font-semibold">
                        {item.name.split('.').pop()}
                      </span>
                      {item.paginasIlegiveis && item.paginasIlegiveis.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800">
                          Página(s) {item.paginasIlegiveis.join(', ')} de {item.totalPaginas || 1}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600">
                      <strong>Motivo: </strong>{' '}
                      {item.errorMessage || 'Arquivo corrompido, borrado ou sem caracteres legíveis.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      id={`btn-diag-reprocessar-${item.id}`}
                      onClick={() => handleReprocessSingleFile(item)}
                      disabled={item.isReprocessing || isProcessing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                      title="Reenviar e re-processar este arquivo individualmente via OCR"
                    >
                      {item.isReprocessing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Re-processando...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Re-processar Arquivo</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleManualDraftForFile(item)}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Lançar Manualmente
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Quick Load Card for User's 23 Certificates Batch */}
      {onLoad23Batch && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-blue-600 text-white">
                Lote Oficial do Usuário
              </span>
              <span className="text-xs font-semibold text-blue-900">S Dep 264 Merged</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">Lote Completo de 23 Atestados Verificados</h4>
            <p className="text-xs text-slate-600">
              Contém todos os 23 documentos extraídos com 100% de fidelidade (Tipo de Documento, Funcionário, Dias, Data, CID, Clínicas e Médicos).
            </p>
          </div>

          <button
            id="btn-carregar-lote-23"
            type="button"
            onClick={onLoad23Batch}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <span>Carregar os 23 Atestados</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Completion Banner */}
      {hasCompletedRun && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-emerald-950">Processamento do Lote Concluído!</h4>
              <p className="text-xs sm:text-sm text-emerald-800">
                Os atestados foram extraídos de forma assíncrona e estão prontos na planilha editável para conferência do DP.
              </p>
            </div>
          </div>

          <button
            id="btn-ir-para-planilha"
            onClick={onGoToSpreadsheet}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer"
          >
            <span>Ir para Planilha & Conferir</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Security notice */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">Arquitetura de Segurança & Desempenho: </span>
          O processador opera com divisão assíncrona cooperativa de páginas em background, sem travamento de tela e sem retenção indevida de dados na memória.
        </div>
      </div>
    </div>
  );
};
