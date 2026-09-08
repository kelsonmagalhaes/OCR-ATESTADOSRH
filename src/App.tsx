import React, { useState, useEffect } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { HomeCover } from './components/HomeCover';
import { FileUpload } from './components/FileUpload';
import { SpreadsheetTable } from './components/SpreadsheetTable';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { HelpView } from './components/HelpView';
import { ExportModal } from './components/ExportModal';
import { ImportModal } from './components/ImportModal';
import { MedicalCertificateRecord, ProcessedBatch, AppSettings } from './types';
import { sortAndGroupRecords, applyBatchConsistencyValidation } from './utils/ocrRules';
import { INITIAL_SAMPLE_RECORDS, LOTE_23_ATESTADOS_VERDENT } from './data/sampleData';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
  responsavelPadrao: 'Analista de DP / Recursos Humanos',
  empresaPadrao: 'Verdent Odontologia',
  retencaoDias: 30,
  ordenacaoPadrao: 'nome',
  mostrarAvisoAntesSair: true,
};

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('inicio');
  const [records, setRecords] = useState<MedicalCertificateRecord[]>(() => {
    try {
      const saved = localStorage.getItem('verdent_atestados_records');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Erro ao ler localStorage', e);
    }
    // Start with the prompt's required sample dataset (Francisco da Silva, Maria Souza, etc.)
    return sortAndGroupRecords(INITIAL_SAMPLE_RECORDS);
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [batches, setBatches] = useState<ProcessedBatch[]>(() => {
    try {
      const saved = localStorage.getItem('verdent_atestados_batches');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Erro ao ler lotes do localStorage', e);
    }
    return [
      {
        id: 'batch-demo-1',
        dataHora: '2026-09-06T09:30:00Z',
        nomeLote: 'Lote Mensal de Atestados - Agosto 2026',
        responsavel: 'Recursos Humanos / DP',
        totalArquivos: 4,
        totalRegistros: 6,
        precisamRevisao: 1,
        registros: INITIAL_SAMPLE_RECORDS,
        arquivos: [
          { nome: 'atestado_francisco_agosto_01.pdf', tamanho: 245000, status: 'concluido' },
          { nome: 'atestado_francisco_agosto_02.pdf', tamanho: 198000, status: 'concluido' },
          { nome: 'maria_souza_atestados.pdf', tamanho: 512000, status: 'concluido' },
          { nome: 'atestado_manuscrito_foto.jpg', tamanho: 890000, status: 'concluido', erro: 'Manuscrito com baixa confiança' },
        ],
      },
    ];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('verdent_atestados_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_SETTINGS;
  });

  // Current batch isolation and naming
  const [isViewingCurrentBatchOnly, setIsViewingCurrentBatchOnly] = useState<boolean>(true);
  const [currentBatchName, setCurrentBatchName] = useState<string | null>('Processamento Atual');

  // Modal states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // System toast message
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'warning' | 'info' | 'error';
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'warning' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem('verdent_atestados_records', JSON.stringify(records));
    } catch (e) {}
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem('verdent_atestados_batches', JSON.stringify(batches));
    } catch (e) {}
  }, [batches]);

  useEffect(() => {
    try {
      localStorage.setItem('verdent_atestados_settings', JSON.stringify(settings));
    } catch (e) {}
  }, [settings]);

  // Window beforeunload prompt if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && settings.mostrarAvisoAntesSair) {
        e.preventDefault();
        e.returnValue = 'Existem alterações não salvas. Deseja salvá-las antes de sair?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, settings.mostrarAvisoAntesSair]);

  // Handle OCR extracted records
  const handleProcessingCompleted = (
    newRecords: MedicalCertificateRecord[],
    filesSummary: any[],
    appendMode: boolean = false
  ) => {
    // Validador pós-processamento de consistência (datas, CIDs inexistentes, dias negativos)
    const validatedRecords = applyBatchConsistencyValidation(newRecords);

    // Se appendMode for falso (padrão solicitado pelo usuário), a planilha e o download
    // exibirão EXCLUSIVAMENTE o lote recém-processado, sem acumular os anteriores
    const targetRecords = appendMode
      ? sortAndGroupRecords([...validatedRecords, ...records])
      : sortAndGroupRecords(validatedRecords);

    setRecords(targetRecords);
    setIsViewingCurrentBatchOnly(!appendMode);
    const batchTitle = `Lote Atual (${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`;
    setCurrentBatchName(batchTitle);
    setHasUnsavedChanges(true);

    const reviewItems = validatedRecords.filter((r) => r.status !== 'aprovado').length;

    // Create a new batch in history for long-term safe retention
    const newBatch: ProcessedBatch = {
      id: `batch-${Date.now()}`,
      dataHora: new Date().toISOString(),
      nomeLote: `Lote Processado - ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      responsavel: settings.responsavelPadrao,
      totalArquivos: filesSummary.length,
      totalRegistros: validatedRecords.length,
      precisamRevisao: reviewItems,
      registros: validatedRecords,
      arquivos: filesSummary,
    };

    setBatches((prev) => [newBatch, ...prev]);

    if (reviewItems > 0) {
      showToast(`${validatedRecords.length} atestado(s) lido(s). ${reviewItems} requerem atenção ou revisão manual.`, 'warning');
    } else {
      showToast(`${validatedRecords.length} atestado(s) processados com sucesso e disponíveis para download imediato.`, 'success');
    }
  };

  // Handler for individual file re-processing
  const handleSingleFileReprocessed = (
    fileName: string,
    newRecords: MedicalCertificateRecord[]
  ) => {
    const validated = applyBatchConsistencyValidation(newRecords);
    setRecords((prev) => {
      // Remove any prior records originating from this exact file to avoid duplicates
      const others = prev.filter((r) => r.arquivoOrigem !== fileName);
      return sortAndGroupRecords([...others, ...validated]);
    });
    setHasUnsavedChanges(true);

    const reviewItems = validated.filter((r) => r.status !== 'aprovado').length;
    if (reviewItems > 0) {
      showToast(
        `Arquivo "${fileName}" re-processado: ${validated.length} atestado(s) extraído(s). ${reviewItems} requer(em) conferência.`,
        'warning'
      );
    } else {
      showToast(
        `Arquivo "${fileName}" re-processado com sucesso: ${validated.length} atestado(s) atualizado(s) na planilha!`,
        'success'
      );
    }
  };

  // Clear current spreadsheet view
  const handleClearCurrentRecords = () => {
    setRecords([]);
    setCurrentBatchName(null);
    setIsViewingCurrentBatchOnly(false);
    setHasUnsavedChanges(false);
    localStorage.removeItem('verdent_atestados_records');
    showToast('Planilha limpa com sucesso. Pronta para receber um novo lote.', 'info');
  };

  // Load consolidated view of all historical batches
  const handleLoadAllBatchesConsolidated = () => {
    const all = batches.flatMap((b) => b.registros);
    if (all.length === 0) {
      showToast('Nenhum lote salvo no histórico.', 'info');
      return;
    }
    const combined = sortAndGroupRecords(all);
    setRecords(combined);
    setCurrentBatchName('Histórico Consolidado (Todos os Lotes)');
    setIsViewingCurrentBatchOnly(false);
    setHasUnsavedChanges(false);
    showToast(`${combined.length} atestados consolidados carregados do histórico.`, 'info');
  };

  // Update records in spreadsheet
  const handleUpdateRecords = (updated: MedicalCertificateRecord[], markAsUnsaved = true) => {
    setRecords(updated);
    if (markAsUnsaved) {
      setHasUnsavedChanges(true);
    }
  };

  // Save changes button action
  const handleSaveBatch = () => {
    setHasUnsavedChanges(false);
    showToast('Planilha salva com sucesso.', 'success');
  };

  // Load sample dataset
  const handleLoadSampleData = () => {
    const sorted = sortAndGroupRecords(INITIAL_SAMPLE_RECORDS);
    setRecords(sorted);
    setHasUnsavedChanges(false);
    setCurrentTab('planilha');
    showToast('Atestados de exemplo carregados para conferência (Francisco da Silva, Maria Souza, etc.).', 'info');
  };

  // Load official 23 certificates batch
  const handleLoad23BatchData = () => {
    const sorted = sortAndGroupRecords(LOTE_23_ATESTADOS_VERDENT);
    setRecords(sorted);
    setHasUnsavedChanges(true);
    setCurrentTab('planilha');
    showToast('Lote de 23 atestados carregado com sucesso (Tipo de Documento, CID, Dias, Médicos e Clínicas).', 'success');
  };

  // Import confirmed
  const handleImportConfirmed = (importedRecords: MedicalCertificateRecord[], append: boolean) => {
    let next: MedicalCertificateRecord[];
    if (append) {
      next = sortAndGroupRecords([...importedRecords, ...records]);
    } else {
      next = sortAndGroupRecords(importedRecords);
    }
    setRecords(next);
    setHasUnsavedChanges(true);
    setCurrentTab('planilha');
    showToast(`${importedRecords.length} atestado(s) importado(s) com sucesso.`, 'success');
  };

  // History batch open / edit
  const handleOpenBatch = (batch: ProcessedBatch, editMode: boolean) => {
    setRecords(sortAndGroupRecords(batch.registros));
    setCurrentBatchName(batch.nomeLote);
    setIsViewingCurrentBatchOnly(true);
    setHasUnsavedChanges(false);
    setCurrentTab('planilha');
    showToast(`Lote "${batch.nomeLote}" carregado na planilha.`, 'info');
  };

  const handleDeleteBatch = (id: string) => {
    setBatches((prev) => prev.filter((b) => b.id !== id));
    showToast('Lote removido do histórico.', 'info');
  };

  const handleClearAllLocalData = () => {
    setRecords([]);
    setBatches([]);
    setHasUnsavedChanges(false);
    localStorage.removeItem('verdent_atestados_records');
    localStorage.removeItem('verdent_atestados_batches');
    showToast('Todos os registros foram removidos da memória local.', 'info');
    setCurrentTab('inicio');
  };

  const reviewCount = records.filter((r) => r.status !== 'aprovado').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-md p-4 rounded-xl shadow-lg border flex items-start gap-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : toastMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : toastMessage.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-950'
              : 'bg-blue-50 border-blue-200 text-blue-950'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          {toastMessage.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
          {toastMessage.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}

          <div className="text-xs font-semibold leading-relaxed pr-2">
            {toastMessage.text}
          </div>

          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-700 p-0.5 ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'importar') {
            setIsImportModalOpen(true);
          } else if (tab === 'exportar') {
            setIsExportModalOpen(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        recordsCount={records.length}
        reviewCount={reviewCount}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Main Content View Switcher */}
      <main className="flex-1">
        {currentTab === 'inicio' && (
          <HomeCover
            onStartProcessing={() => setCurrentTab('upload')}
            onViewRecords={() => setCurrentTab('planilha')}
            onLoadSampleData={handleLoadSampleData}
            recordsCount={records.length}
          />
        )}

        {currentTab === 'upload' && (
          <FileUpload
            onProcessingCompleted={handleProcessingCompleted}
            onGoToSpreadsheet={() => setCurrentTab('planilha')}
            existingCount={records.length}
            onLoad23Batch={handleLoad23BatchData}
            onClearExistingRecords={handleClearCurrentRecords}
            onSingleFileReprocessed={handleSingleFileReprocessed}
          />
        )}

        {currentTab === 'planilha' && (
          <SpreadsheetTable
            records={records}
            onUpdateRecords={handleUpdateRecords}
            onSaveBatch={handleSaveBatch}
            hasUnsavedChanges={hasUnsavedChanges}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onClearCurrentRecords={handleClearCurrentRecords}
            onLoadAllBatchesConsolidated={handleLoadAllBatchesConsolidated}
            hasHistoricalBatches={batches.length > 0}
            isViewingCurrentBatchOnly={isViewingCurrentBatchOnly}
            currentBatchName={currentBatchName}
          />
        )}

        {currentTab === 'historico' && (
          <HistoryView
            batches={batches}
            onOpenBatch={handleOpenBatch}
            onDeleteBatch={handleDeleteBatch}
            onStartNewProcessing={() => setCurrentTab('upload')}
          />
        )}

        {currentTab === 'configuracoes' && (
          <SettingsView
            settings={settings}
            onSaveSettings={(s) => {
              setSettings(s);
              showToast('Configurações salvas.', 'success');
            }}
            onClearAllLocalData={handleClearAllLocalData}
          />
        )}

        {currentTab === 'ajuda' && <HelpView />}
      </main>

      {/* Export Modal */}
      {isExportModalOpen && (
        <ExportModal
          records={records}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <ImportModal
          onImportConfirmed={handleImportConfirmed}
          onClose={() => setIsImportModalOpen(false)}
          existingCount={records.length}
        />
      )}
    </div>
  );
}
