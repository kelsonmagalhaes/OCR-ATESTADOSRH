import React, { useState } from 'react';
import { 
  FileText, 
  UploadCloud, 
  Table2, 
  History, 
  FileSpreadsheet, 
  Download, 
  Settings, 
  HelpCircle, 
  Menu, 
  X,
  AlertCircle,
  Building2,
  ShieldCheck
} from 'lucide-react';

export type NavTab = 
  | 'inicio' 
  | 'upload' 
  | 'planilha' 
  | 'historico' 
  | 'importar' 
  | 'exportar' 
  | 'configuracoes' 
  | 'ajuda';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  recordsCount: number;
  reviewCount: number;
  hasUnsavedChanges: boolean;
  onSavePrompt?: () => boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  recordsCount,
  reviewCount,
  hasUnsavedChanges,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'inicio' as NavTab, label: 'Início', icon: Building2 },
    { id: 'upload' as NavTab, label: 'Novo processamento', icon: UploadCloud },
    { 
      id: 'planilha' as NavTab, 
      label: 'Planilha & Conferência', 
      icon: Table2,
      badge: recordsCount > 0 ? recordsCount : undefined,
      warning: reviewCount > 0 ? reviewCount : undefined,
    },
    { id: 'historico' as NavTab, label: 'Registros processados', icon: History },
    { id: 'importar' as NavTab, label: 'Importar planilha', icon: FileSpreadsheet },
    { id: 'exportar' as NavTab, label: 'Exportar dados', icon: Download },
    { id: 'configuracoes' as NavTab, label: 'Configurações', icon: Settings },
    { id: 'ajuda' as NavTab, label: 'Ajuda', icon: HelpCircle },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner / Trust bar */}
      <div className="bg-slate-900 text-slate-300 text-xs px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-white tracking-wide">VERDENT</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">Departamento Pessoal & Recursos Humanos</span>
        </div>
        <div className="flex items-center space-x-3 text-slate-400 hidden sm:flex">
          <span className="flex items-center gap-1 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Processamento Seguro & LGPD Compliance
          </span>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div 
            onClick={() => handleTabClick('inicio')}
            className="flex items-center gap-3 cursor-pointer group select-none"
            id="nav-brand"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold shadow-sm group-hover:bg-blue-800 transition-colors">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-base leading-tight">
                Gestão de Atestados
              </div>
              <div className="text-xs text-slate-500 font-medium">
                DP e Recursos Humanos
              </div>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => handleTabClick(item.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                  <span>{item.label}</span>

                  {item.badge !== undefined && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold bg-slate-200 text-slate-700 rounded-full">
                      {item.badge}
                    </span>
                  )}

                  {item.warning !== undefined && (
                    <span 
                      className="ml-1 px-1.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full flex items-center gap-0.5"
                      title={`${item.warning} registros precisam de revisão`}
                    >
                      <AlertCircle className="w-3 h-3 text-amber-600 inline" />
                      {item.warning}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Unsaved indicator & Mobile toggle */}
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Alterações não salvas
              </span>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              id="mobile-menu-button"
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1 shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-800 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {item.warning !== undefined && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      {item.warning}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
