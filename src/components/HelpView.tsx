import React from 'react';
import { 
  HelpCircle, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  Download, 
  Sparkles,
  Info
} from 'lucide-react';

export const HelpView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <HelpCircle className="w-7 h-7 text-blue-700" />
          Ajuda & Guia Operacional
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Manual de boas práticas para leitura automatizada por OCR de atestados médicos no Departamento Pessoal e RH
        </p>
      </div>

      {/* 4 Mandatory Columns Explanation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-700" />
          Padrão das 4 Colunas Obrigatórias
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-900 text-sm">1. Nome do Funcionário</span>
            <p className="text-slate-600 leading-relaxed">
              Nome completo identificado no documento. Acentos e caracteres especiais são preservados. Se o nome estiver ilegível, o sistema marca como <strong className="text-amber-800">“Revisar nome”</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-900 text-sm">2. Quantidade de Dias</span>
            <p className="text-slate-600 leading-relaxed">
              Total de dias de afastamento (ex: “1 dia”, “3 dias”, “5 dias”). Se houver período inicial e final, o sistema calcula a soma de dias. Se for declaração de horas/consulta, registra <strong className="text-slate-900">“Comparecimento”</strong>. Se ilegível: <strong className="text-amber-800">“Revisar quantidade”</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-900 text-sm">3. Data do Atestado</span>
            <p className="text-slate-600 leading-relaxed">
              Data de atendimento ou emissão sempre exibida no formato <strong className="text-slate-900">DD/MM/AAAA</strong>. Se houver mais de uma data, prioriza-se a data de atendimento clínico. Se ilegível: <strong className="text-amber-800">“Revisar data”</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-900 text-sm">4. CID (Código Internacional de Doenças)</span>
            <p className="text-slate-600 leading-relaxed">
              Código CID alfanumérico informado pelo médico (ex: “M54.5”, “J06.9”). Quando não estiver informado no documento, é preenchido estritamente com <strong className="text-slate-900">“Não informado”</strong>. A IA jamais inventa ou deduz um CID ausente.
            </p>
          </div>
        </div>
      </div>

      {/* Regras de Agrupamento & Ordenação */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-700" />
          Regras de Agrupamento & Ordenação
        </h3>
        <ul className="text-xs text-slate-600 space-y-2.5 list-disc list-inside leading-relaxed">
          <li>
            <strong className="text-slate-900">Agrupamento consecutivo por colaborador:</strong> Todos os atestados do mesmo funcionário são posicionados em linhas consecutivas antes de iniciar o próximo colaborador.
          </li>
          <li>
            <strong className="text-slate-900">Ordem cronológica por funcionário:</strong> Os atestados de cada funcionário são dispostos da data mais antiga para a mais recente.
          </li>
          <li>
            <strong className="text-slate-900">Ordem alfabética de colaboradores:</strong> Os funcionários são ordenados de A a Z pelo nome completo.
          </li>
          <li>
            <strong className="text-slate-900">Edição e reordenação flexível:</strong> O usuário pode editar qualquer campo diretamente na tabela, adicionar linhas, duplicar ou reordenar livremente.
          </li>
        </ul>
      </div>

      {/* Dicas de Leitura OCR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-600" />
          Dicas para Máximo Sucesso na Leitura por OCR
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900">Documentos em PDF</span>
            <p className="text-slate-600">
              PDFs nativos ou escaneados em boa resolução (200 a 300 DPI) garantem precisão próxima a 100%. O sistema lê todas as páginas automaticamente.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900">Fotos de Celular</span>
            <p className="text-slate-600">
              Evite reflexos e sombras sobre o papel. Mantenha o documento plano e enquadrado. Fotos nítidas em JPG ou PNG são lidas com facilidade.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900">Manuscritos Médicos</span>
            <p className="text-slate-600">
              Em caso de caligrafia médica ilegível, o sistema preserva os campos legíveis e marca com o status de “Revisar” para que o RH confira o original.
            </p>
          </div>
        </div>
      </div>

      {/* Exportação */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-900 flex items-center gap-2">
          <Download className="w-4 h-4 text-blue-700" />
          <span>Formatos de Exportação para Sistemas de DP / Folha</span>
        </div>
        <p>
          O sistema gera arquivos em <strong>Excel (.xlsx)</strong> com formatação elegante de datas e larguras ajustadas, e em <strong>CSV</strong> delimitado por ponto e vírgula com cabeçalho padrão UTF-8 com BOM, permitindo abertura instantânea no Microsoft Excel em língua portuguesa sem caracteres desconfigurados.
        </p>
      </div>
    </div>
  );
};
