import React, { useState, useMemo } from 'react';
import { 
  Table2, 
  Plus, 
  Trash2, 
  Copy, 
  ArrowUpDown, 
  Search, 
  Filter, 
  RotateCcw, 
  Save, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  FileSpreadsheet, 
  Download, 
  ChevronRight, 
  Edit2, 
  Check, 
  X,
  FileText,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { MedicalCertificateRecord, VerificationStatus } from '../types';
import { sortAndGroupRecords, normalizeDias, normalizeCid, evaluateVerificationStatus, autoCleanBatch } from '../utils/ocrRules';

interface SpreadsheetTableProps {
  records: MedicalCertificateRecord[];
  onUpdateRecords: (records: MedicalCertificateRecord[], markAsUnsaved?: boolean) => void;
  onSaveBatch: () => void;
  hasUnsavedChanges: boolean;
  onOpenExportModal: () => void;
  onClearCurrentRecords?: () => void;
  onLoadAllBatchesConsolidated?: () => void;
  hasHistoricalBatches?: boolean;
  isViewingCurrentBatchOnly?: boolean;
  currentBatchName?: string | null;
}

export const SpreadsheetTable: React.FC<SpreadsheetTableProps> = ({
  records,
  onUpdateRecords,
  onSaveBatch,
  hasUnsavedChanges,
  onOpenExportModal,
  onClearCurrentRecords,
  onLoadAllBatchesConsolidated,
  hasHistoricalBatches,
  isViewingCurrentBatchOnly,
  currentBatchName,
}) => {
  // View mode: standard 4 columns vs detailed
  const [modoDetalhado, setModoDetalhado] = useState<boolean>(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedFuncionarioFilter, setSelectedFuncionarioFilter] = useState<string>('todos');
  const [selectedTipoDocFilter, setSelectedTipoDocFilter] = useState<string>('todos');
  const [filterOnlyReview, setFilterOnlyReview] = useState<boolean>(false);
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof MedicalCertificateRecord } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Undo history
  const [undoStack, setUndoStack] = useState<MedicalCertificateRecord[][]>([]);

  // Selected row for full detail modal
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<MedicalCertificateRecord | null>(null);

  // Push to undo stack helper
  const pushUndo = () => {
    setUndoStack((prev) => [JSON.parse(JSON.stringify(records)), ...prev.slice(0, 15)]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[0];
    setUndoStack((prev) => prev.slice(1));
    onUpdateRecords(previous, true);
  };

  // Re-apply standard grouping and sorting
  const handleAutoSortAndGroup = () => {
    pushUndo();
    const sorted = sortAndGroupRecords([...records]);
    onUpdateRecords(sorted, true);
  };

  // Auto-clean and sanitize records with feedback
  const [autoCleanNotice, setAutoCleanNotice] = useState<{ totalChanged: number; promotedToApproved: number } | null>(null);
  const [copiedToClipboard, setCopiedToClipboard] = useState<boolean>(false);

  const handleAutoCleanAndHygiene = () => {
    if (records.length === 0) return;
    pushUndo();
    const result = autoCleanBatch(records);
    const sorted = sortAndGroupRecords(result.cleanedRecords);
    onUpdateRecords(sorted, true);
    setAutoCleanNotice({
      totalChanged: result.totalChanged,
      promotedToApproved: result.promotedToApproved,
    });
    setTimeout(() => {
      setAutoCleanNotice(null);
    }, 6000);
  };

  // 1-Click direct copy to Excel/Sheets as TSV
  const handleCopyTsvToClipboard = async () => {
    if (filteredRecords.length === 0) return;
    const header = ['Funcionário', 'Quantidade de Dias', 'Data do Atestado', 'CID'].join('\t');
    const rows = filteredRecords.map((r) => [
      r.funcionario || '',
      r.dias || '',
      r.data || '',
      r.cid || 'Não informado',
    ].join('\t'));
    const tsv = [header, ...rows].join('\n');

    try {
      await navigator.clipboard.writeText(tsv);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar dados para a área de transferência:', err);
    }
  };

  // Cell edit start
  const handleStartEdit = (id: string, field: keyof MedicalCertificateRecord, currentVal: any) => {
    setEditingCell({ id, field });
    setEditValue(String(currentVal || ''));
  };

  // Cell edit save
  const handleSaveCell = () => {
    if (!editingCell) return;
    pushUndo();

    const updated = records.map((r) => {
      if (r.id !== editingCell.id) return r;

      const updatedRecord = { ...r };
      let val = editValue.trim();

      if (editingCell.field === 'dias') {
        val = normalizeDias(val);
      } else if (editingCell.field === 'cid') {
        val = normalizeCid(val);
      }

      (updatedRecord as any)[editingCell.field] = val;

      // Re-evaluate verification status
      const evalStatus = evaluateVerificationStatus(updatedRecord);
      updatedRecord.status = evalStatus.status;
      updatedRecord.motivoRevisao = evalStatus.motivo;

      return updatedRecord;
    });

    onUpdateRecords(updated, true);
    setEditingCell(null);
  };

  const handleCancelCell = () => {
    setEditingCell(null);
  };

  // Add new empty row
  const handleAddRow = () => {
    pushUndo();
    const newRecord: MedicalCertificateRecord = {
      id: `rec-manual-${Date.now()}`,
      funcionario: 'Novo Funcionário',
      dias: '1 dia',
      data: new Date().toLocaleDateString('pt-BR'),
      cid: 'Não informado',
      tipoDocumento: 'Atestado Médico',
      horario: '-',
      local: '-',
      profissional: '-',
      observacao: 'Registro manual adicionado pelo usuário',
      arquivoOrigem: 'Manual',
      status: 'revisar',
      motivoRevisao: 'Registro adicionado manualmente, confira os dados.',
      dataProcessamento: new Date().toISOString(),
    };

    onUpdateRecords([newRecord, ...records], true);
  };

  // Duplicate row
  const handleDuplicateRow = (record: MedicalCertificateRecord) => {
    pushUndo();
    const duplicated: MedicalCertificateRecord = {
      ...JSON.parse(JSON.stringify(record)),
      id: `rec-dup-${Date.now()}`,
      observacao: (record.observacao ? record.observacao + ' ' : '') + '(Duplicado manualmente)',
    };
    const idx = records.findIndex((r) => r.id === record.id);
    const updated = [...records];
    updated.splice(idx + 1, 0, duplicated);
    onUpdateRecords(updated, true);
  };

  // Delete row
  const handleDeleteRow = (id: string) => {
    pushUndo();
    onUpdateRecords(records.filter((r) => r.id !== id), true);
  };

  // Distinct employee names for filter
  const distinctEmployees = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.funcionario && r.funcionario !== 'Revisar nome') {
        set.add(r.funcionario);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [records]);

  const distinctTiposDoc = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.tipoDocumento) set.add(r.tipoDocumento);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [records]);

  // Filtered & Searched records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Review filter
      if (filterOnlyReview && r.status === 'aprovado') {
        return false;
      }

      // Employee dropdown filter
      if (selectedFuncionarioFilter !== 'todos' && r.funcionario !== selectedFuncionarioFilter) {
        return false;
      }

      // Document Type filter
      if (selectedTipoDocFilter !== 'todos' && r.tipoDocumento !== selectedTipoDocFilter) {
        return false;
      }

      // Search term filter (searches across name, CID, local, doctor, date)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = r.funcionario.toLowerCase().includes(query);
        const matchesCid = r.cid.toLowerCase().includes(query);
        const matchesDate = r.data.toLowerCase().includes(query);
        const matchesLocal = (r.local || '').toLowerCase().includes(query);
        const matchesProf = (r.profissional || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCid && !matchesDate && !matchesLocal && !matchesProf) {
          return false;
        }
      }

      // Period filter (DD/MM/AAAA)
      if (filterStartDate || filterEndDate) {
        const parseDate = (dStr: string) => {
          const parts = dStr.split('/');
          if (parts.length === 3) {
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
          }
          return 0;
        };
        const recordTime = parseDate(r.data);
        if (recordTime > 0) {
          if (filterStartDate) {
            const startParts = filterStartDate.split('-');
            const startTime = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2])).getTime();
            if (recordTime < startTime) return false;
          }
          if (filterEndDate) {
            const endParts = filterEndDate.split('-');
            const endTime = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2])).getTime();
            if (recordTime > endTime) return false;
          }
        }
      }

      return true;
    });
  }, [records, filterOnlyReview, selectedFuncionarioFilter, selectedTipoDocFilter, searchTerm, filterStartDate, filterEndDate]);

  const reviewCount = useMemo(() => records.filter((r) => r.status !== 'aprovado').length, [records]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Batch Isolation Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
            <Table2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm">
                {currentBatchName || 'Processamento Atual'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Apenas este lote ativo ({records.length} atestados)
              </span>
            </div>
            <p className="text-slate-500 mt-0.5">
              O botão "Exportar" gerará o download contendo <strong>exclusivamente</strong> os dados deste processamento.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          {records.length > 0 && onClearCurrentRecords && (
            <button
              onClick={onClearCurrentRecords}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              title="Limpa a planilha atual para começar um novo processamento do zero"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Limpar Planilha / Novo Lote</span>
            </button>
          )}

          {hasHistoricalBatches && onLoadAllBatchesConsolidated && (
            <button
              onClick={onLoadAllBatchesConsolidated}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              title="Carrega todos os lotes salvos no histórico em uma única visualização consolidada"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Ver Histórico Consolidado</span>
            </button>
          )}
        </div>
      </div>

      {/* Required Compliance Alert Box */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl text-amber-900 text-sm shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span className="font-medium">
            “Os dados extraídos por OCR devem ser conferidos pelo usuário antes da utilização em rotinas oficiais de Departamento Pessoal ou Recursos Humanos.”
          </span>
        </div>
        {reviewCount > 0 && (
          <button
            onClick={() => setFilterOnlyReview(!filterOnlyReview)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              filterOnlyReview
                ? 'bg-amber-700 text-white'
                : 'bg-amber-200/80 hover:bg-amber-300 text-amber-950'
            }`}
          >
            {filterOnlyReview ? 'Exibindo pendências' : `Filtrar ${reviewCount} para revisar`}
          </button>
        )}
      </div>

      {/* Action & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* View Mode Toggle & Stats */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Mode switch */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                id="btn-modo-padrao"
                onClick={() => setModoDetalhado(false)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !modoDetalhado
                    ? 'bg-white text-blue-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Planilha Padrão (4 Colunas)
              </button>
              <button
                id="btn-modo-detalhado"
                onClick={() => setModoDetalhado(true)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  modoDetalhado
                    ? 'bg-white text-blue-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Modo Detalhado (Completo)
              </button>
            </div>

            <div className="text-xs text-slate-500 font-medium pl-1">
              Total: <strong className="text-slate-800">{records.length}</strong> atestado(s) • Exibindo: <strong className="text-slate-800">{filteredRecords.length}</strong>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-adicionar-linha"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition-colors cursor-pointer border border-blue-200"
            >
              <Plus className="w-4 h-4 text-blue-700" />
              <span>Adicionar linha</span>
            </button>

            <button
              id="btn-reagrupar-ordenar"
              onClick={handleAutoSortAndGroup}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Agrupa funcionários alfabeticamente e ordena atestados da data mais antiga à mais recente"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>Agrupar & Ordenar</span>
            </button>

            <button
              id="btn-higienizar-dados"
              onClick={handleAutoCleanAndHygiene}
              disabled={records.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors cursor-pointer"
              title="Padroniza nomes em Title Case, formata datas (DD/MM/AAAA), corrige CIDs e dias automaticamente"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Higienizar & Corrigir</span>
            </button>

            <button
              id="btn-copiar-excel"
              onClick={handleCopyTsvToClipboard}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Copia os 4 campos padrão formatados para colar diretamente no Excel ou Google Sheets (Ctrl+V)"
            >
              {copiedToClipboard ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copiado para Excel!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copiar p/ Excel</span>
                </>
              )}
            </button>

            {undoStack.length > 0 && (
              <button
                onClick={handleUndo}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                title="Desfazer última alteração"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Desfazer</span>
              </button>
            )}

            <button
              id="btn-salvar-alteracoes"
              onClick={onSaveBatch}
              disabled={!hasUnsavedChanges}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white animate-pulse'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{hasUnsavedChanges ? 'Salvar alterações' : 'Salvo'}</span>
            </button>

            <button
              id="btn-exportar-planilha"
              onClick={onOpenExportModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Lote Atual ({records.length})</span>
            </button>
          </div>
        </div>

        {/* Feedback banner for Auto-Clean */}
        {autoCleanNotice && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Higienização concluída com sucesso: <strong>{autoCleanNotice.totalChanged}</strong> campo(s) corrigidos e padronizados
                {autoCleanNotice.promotedToApproved > 0 && (
                  <> • <strong>{autoCleanNotice.promotedToApproved}</strong> atestado(s) agora aprovados automaticamente</>
                )}.
              </span>
            </div>
            <button
              onClick={() => setAutoCleanNotice(null)}
              className="text-amber-700 hover:text-amber-900 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              id="input-busca-tabela"
              placeholder="Pesquisar funcionário, CID ou médico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          {/* Employee dropdown filter */}
          <div>
            <select
              id="select-filtro-funcionario"
              value={selectedFuncionarioFilter}
              onChange={(e) => setSelectedFuncionarioFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="todos">Todos os Funcionários ({distinctEmployees.length})</option>
              {distinctEmployees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Document Type dropdown filter */}
          <div>
            <select
              id="select-filtro-tipo-doc"
              value={selectedTipoDocFilter}
              onChange={(e) => setSelectedTipoDocFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="todos">Todos os Tipos ({distinctTiposDoc.length})</option>
              {distinctTiposDoc.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium shrink-0">De:</span>
            <input
              type="date"
              id="filtro-data-inicio"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* End Date & Reset */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium shrink-0">Até:</span>
            <input
              type="date"
              id="filtro-data-fim"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            {(searchTerm || selectedFuncionarioFilter !== 'todos' || selectedTipoDocFilter !== 'todos' || filterStartDate || filterEndDate || filterOnlyReview) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedFuncionarioFilter('todos');
                  setSelectedTipoDocFilter('todos');
                  setFilterStartDate('');
                  setFilterEndDate('');
                  setFilterOnlyReview(false);
                }}
                className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                title="Limpar filtros"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse" id="planilha-atestados-table">
            {/* Header Row */}
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-xs tracking-wider uppercase select-none">
                <th className="py-3 px-3 w-12 text-center text-slate-500">#</th>
                <th className="py-3 px-4 min-w-[200px]">Nome do Funcionário</th>
                <th className="py-3 px-4 min-w-[150px]">Quantidade de Dias</th>
                <th className="py-3 px-4 min-w-[140px]">Data do Atestado</th>
                <th className="py-3 px-4 min-w-[120px]">CID</th>

                {modoDetalhado && (
                  <>
                    <th className="py-3 px-4 min-w-[150px]">Tipo de Documento</th>
                    <th className="py-3 px-4 min-w-[120px]">Horário</th>
                    <th className="py-3 px-4 min-w-[160px]">Local</th>
                    <th className="py-3 px-4 min-w-[180px]">Profissional</th>
                    <th className="py-3 px-4 min-w-[200px]">Observação</th>
                    <th className="py-3 px-4 min-w-[160px]">Arquivo de Origem</th>
                  </>
                )}

                <th className="py-3 px-3 w-16 text-center">Status</th>
                <th className="py-3 px-3 w-28 text-center">Ações</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-slate-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={modoDetalhado ? 12 : 6} className="py-12 text-center text-slate-500">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">Nenhum registro encontrado</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Verifique os filtros de pesquisa ou adicione novos atestados através do menu "Novo processamento".
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, index) => {
                  const isNeedsReview = record.status !== 'aprovado';
                  const isEditing = (field: keyof MedicalCertificateRecord) =>
                    editingCell?.id === record.id && editingCell?.field === field;

                  return (
                    <tr
                      key={record.id}
                      className={`transition-colors group ${
                        isNeedsReview ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Row number */}
                      <td className="py-3 px-3 text-center text-xs font-mono text-slate-400">
                        {index + 1}
                      </td>

                      {/* 1. Nome do Funcionário */}
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {isEditing('funcionario') ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveCell()}
                              autoFocus
                              className="px-2 py-1 text-sm border border-blue-500 rounded-md bg-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                            />
                            <button onClick={handleSaveCell} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={handleCancelCell} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEdit(record.id, 'funcionario', record.funcionario)}
                            className="cursor-pointer py-1 px-1.5 rounded hover:bg-slate-100/80"
                            title="Clique duas vezes para editar o funcionário"
                          >
                            <div className="flex items-center justify-between">
                              <span className={record.funcionario.toLowerCase().includes('revisar') ? 'text-amber-800 font-bold' : ''}>
                                {record.funcionario}
                              </span>
                              <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                record.tipoDocumento?.toLowerCase().includes('declara') 
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : record.tipoDocumento?.toLowerCase().includes('odonto')
                                  ? 'bg-teal-50 text-teal-700 border-teal-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {record.tipoDocumento || 'Atestado Médico'}
                              </span>
                              {record.arquivoOrigem && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[130px]" title={record.arquivoOrigem}>
                                  {record.arquivoOrigem.split('/').pop()}
                                  {record.paginaOrigem ? ` (Pág. ${record.paginaOrigem})` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 2. Quantidade de Dias */}
                      <td className="py-2.5 px-4 text-slate-800">
                        {isEditing('dias') ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveCell()}
                              autoFocus
                              placeholder="ex: 3 dias ou Comparecimento"
                              className="px-2 py-1 text-sm border border-blue-500 rounded-md bg-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button onClick={handleSaveCell} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={handleCancelCell} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEdit(record.id, 'dias', record.dias)}
                            className="flex items-center justify-between cursor-pointer py-1 px-1.5 rounded hover:bg-slate-100/80 font-medium"
                          >
                            <span className={record.dias.toLowerCase().includes('revisar') ? 'text-amber-800 font-bold' : ''}>
                              {record.dias}
                            </span>
                            <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                          </div>
                        )}
                      </td>

                      {/* 3. Data do Atestado */}
                      <td className="py-2.5 px-4 text-slate-800 font-mono text-xs">
                        {isEditing('data') ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveCell()}
                              autoFocus
                              placeholder="DD/MM/AAAA"
                              className="px-2 py-1 text-sm border border-blue-500 rounded-md bg-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                            <button onClick={handleSaveCell} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={handleCancelCell} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEdit(record.id, 'data', record.data)}
                            className="flex items-center justify-between cursor-pointer py-1 px-1.5 rounded hover:bg-slate-100/80 font-semibold"
                          >
                            <span className={record.data.toLowerCase().includes('revisar') ? 'text-amber-800 font-bold' : ''}>
                              {record.data}
                            </span>
                            <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                          </div>
                        )}
                      </td>

                      {/* 4. CID */}
                      <td className="py-2.5 px-4">
                        {isEditing('cid') ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveCell()}
                              autoFocus
                              placeholder="ex: M54.5 ou Não informado"
                              className="px-2 py-1 text-sm border border-blue-500 rounded-md bg-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                            <button onClick={handleSaveCell} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={handleCancelCell} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEdit(record.id, 'cid', record.cid)}
                            className="flex items-center justify-between cursor-pointer py-1 px-1.5 rounded hover:bg-slate-100/80"
                          >
                            {record.cid === 'Não informado' ? (
                              <span className="text-slate-400 italic text-xs">Não informado</span>
                            ) : (
                              <span className="font-mono font-semibold text-slate-800 px-1.5 py-0.5 bg-slate-100 rounded text-xs">
                                {record.cid}
                              </span>
                            )}
                            <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                          </div>
                        )}
                      </td>

                      {/* Detailed Columns if activated */}
                      {modoDetalhado && (
                        <>
                          <td className="py-2.5 px-4 text-xs text-slate-700">
                            {isEditing('tipoDocumento') ? (
                              <div className="flex items-center gap-1">
                                <select
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleSaveCell}
                                  autoFocus
                                  className="px-1.5 py-1 text-xs border border-blue-500 rounded bg-white focus:outline-none"
                                >
                                  <option value="Atestado Médico">Atestado Médico</option>
                                  <option value="Declaração de Comparecimento">Declaração de Comparecimento</option>
                                  <option value="Atestado Odontológico">Atestado Odontológico</option>
                                  <option value="Atestado de Acompanhante">Atestado de Acompanhante</option>
                                  <option value="Atestado de Doação de Sangue">Atestado de Doação de Sangue</option>
                                  <option value="Receita / Outro">Receita / Outro</option>
                                </select>
                                <button onClick={handleSaveCell} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => handleStartEdit(record.id, 'tipoDocumento', record.tipoDocumento || 'Atestado Médico')}
                                className="flex items-center justify-between cursor-pointer py-1 px-1.5 rounded hover:bg-slate-100/80"
                                title="Clique para alterar tipo de documento"
                              >
                                <span className="font-medium truncate max-w-[130px]">
                                  {record.tipoDocumento || 'Atestado Médico'}
                                </span>
                                <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-600">
                            {record.horario || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-600 truncate max-w-[160px]" title={record.local}>
                            {record.local || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-600 truncate max-w-[180px]" title={record.profissional}>
                            {record.profissional || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-600 truncate max-w-[200px]" title={record.observacao}>
                            {record.observacao || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-500 truncate max-w-[160px]" title={record.arquivoOrigem}>
                            {record.arquivoOrigem} {record.paginaOrigem ? `(Pág. ${record.paginaOrigem})` : ''}
                          </td>
                        </>
                      )}

                      {/* Status indicator badge */}
                      <td className="py-2.5 px-3 text-center">
                        {record.status === 'aprovado' ? (
                          <span className="inline-flex p-1 text-emerald-600" title="Validado com alta confiança">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        ) : (
                          <span
                            className="inline-flex p-1 text-amber-600 bg-amber-100 rounded-md cursor-pointer"
                            title={record.motivoRevisao || 'Necessita de conferência manual'}
                            onClick={() => setSelectedRecordForDetail(record)}
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </span>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedRecordForDetail(record)}
                            className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                            title="Ver detalhes completos do atestado"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicateRow(record)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                            title="Duplicar linha"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRow(record.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Excluir linha"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Detail Modal */}
      {selectedRecordForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-700" />
                <h3 className="font-bold text-slate-900 text-lg">
                  Detalhes do Atestado Médico
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecordForDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Nome do Funcionário</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedRecordForDetail.funcionario}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Data do Atestado / Atendimento</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedRecordForDetail.data}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Quantidade de Dias</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedRecordForDetail.dias}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">CID (Classificação Internacional de Doenças)</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5 font-mono">{selectedRecordForDetail.cid}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Tipo de Documento</span>
                <p className="text-sm text-slate-800 mt-0.5">{selectedRecordForDetail.tipoDocumento || 'Atestado Médico'}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Horário Registrado</span>
                <p className="text-sm text-slate-800 mt-0.5">{selectedRecordForDetail.horario || 'Não especificado'}</p>
              </div>

              <div className="sm:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Local de Atendimento / Unidade de Saúde</span>
                <p className="text-sm text-slate-800 mt-0.5">{selectedRecordForDetail.local || 'Não identificado'}</p>
              </div>

              <div className="sm:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Profissional de Saúde / CRM</span>
                <p className="text-sm text-slate-800 mt-0.5">{selectedRecordForDetail.profissional || 'Não identificado'}</p>
              </div>

              <div className="sm:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Observações / Recomendações</span>
                <p className="text-sm text-slate-800 mt-0.5">{selectedRecordForDetail.observacao || 'Sem observações'}</p>
              </div>

              <div className="sm:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Arquivo de Origem</span>
                <p className="text-sm text-slate-700 mt-0.5 font-mono">
                  {selectedRecordForDetail.arquivoOrigem} {selectedRecordForDetail.paginaOrigem ? `— Página ${selectedRecordForDetail.paginaOrigem}` : ''}
                </p>
              </div>
            </div>

            {selectedRecordForDetail.motivoRevisao && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <span className="font-bold">Motivo da revisão manual: </span>
                {selectedRecordForDetail.motivoRevisao}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedRecordForDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
