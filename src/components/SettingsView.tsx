import React, { useState } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  Trash2, 
  Save, 
  Building2, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Lock
} from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onClearAllLocalData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onClearAllLocalData,
}) => {
  const [form, setForm] = useState<AppSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleConfirmClear = () => {
    onClearAllLocalData();
    setShowClearModal(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-blue-700" />
          Configurações & Privacidade
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Personalize as preferências operacionais do Departamento Pessoal e as regras de retenção de atestados médicos
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Configurações salvas com sucesso no seu navegador.</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Responsável Padrão */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-400" />
              Responsável Padrão (DP/RH)
            </label>
            <input
              type="text"
              value={form.responsavelPadrao}
              onChange={(e) => setForm({ ...form, responsavelPadrao: e.target.value })}
              placeholder="Ex: Maria Santos - Analista de DP"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <p className="text-[11px] text-slate-500">
              Nome gravado no histórico de lotes processados.
            </p>
          </div>

          {/* Empresa */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400" />
              Empresa / Unidade
            </label>
            <input
              type="text"
              value={form.empresaPadrao}
              onChange={(e) => setForm({ ...form, empresaPadrao: e.target.value })}
              placeholder="Ex: Verdent Odontologia"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <p className="text-[11px] text-slate-500">
              Identificação nos relatórios e exportações para RH.
            </p>
          </div>

          {/* Retenção */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              Período de Retenção Local (Dias)
            </label>
            <select
              value={form.retencaoDias}
              onChange={(e) => setForm({ ...form, retencaoDias: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value={7}>7 dias (Alta rotatividade)</option>
              <option value={30}>30 dias (Mensal - Padrão)</option>
              <option value={60}>60 dias (Bimestral)</option>
              <option value={90}>90 dias (Trimestral)</option>
            </select>
            <p className="text-[11px] text-slate-500">
              Em conformidade com a política de descarte de dados sensíveis.
            </p>
          </div>

          {/* Ordenação Padrão */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Ordenação Automática Padrão
            </label>
            <select
              value={form.ordenacaoPadrao}
              onChange={(e) => setForm({ ...form, ordenacaoPadrao: e.target.value as 'nome' | 'data' })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="nome">Agrupar por Funcionário (A-Z) + Data Antiga para Nova</option>
              <option value="data">Data de Emissão do Atestado</option>
            </select>
            <p className="text-[11px] text-slate-500">
              Regra obrigatória de visualização e exportação.
            </p>
          </div>
        </div>

        {/* Unsaved Changes Alert Toggle */}
        <div className="pt-4 border-t border-slate-100">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.mostrarAvisoAntesSair}
              onChange={(e) => setForm({ ...form, mostrarAvisoAntesSair: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded-sm focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800">
                Avisar antes de sair se houver alterações não salvas
              </span>
              <p className="text-xs text-slate-500">
                Exibe alerta: “Existem alterações não salvas. Deseja salvá-las antes de sair?”
              </p>
            </div>
          </label>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Configurações</span>
          </button>
        </div>
      </form>

      {/* Privacy & Compliance Card */}
      <div className="bg-slate-100 rounded-2xl p-6 border border-slate-200 space-y-4">
        <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base">
          <Lock className="w-5 h-5 text-blue-700" />
          <span>Regras de Privacidade & LGPD (Dados Sensíveis de Saúde)</span>
        </div>
        <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
          <p>
            • Atestados médicos contêm dados pessoais sensíveis protegidos pelo Artigo 5º, inciso II da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>
          <p>
            • O aplicativo processa os documentos estritamente para conferência e rotinas trabalhistas e previdenciárias de Recursos Humanos e Departamento Pessoal.
          </p>
          <p>
            • O sigilo médico quanto ao diagnóstico e CID deve ser respeitado, lembrando que a ausência de indicação de CID pelo profissional de saúde é um direito do paciente assegurado pela Resolução CFM nº 1.658/2002.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Limpar todos os atestados e registros locais desta sessão:
          </div>
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            <span>Excluir Todos os Dados Locais</span>
          </button>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Excluir Dados Locais</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Deseja realmente apagar todos os atestados médicos carregados e o histórico de lotes da memória local deste navegador? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Sim, Excluir Tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
