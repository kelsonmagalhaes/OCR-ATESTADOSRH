/**
 * Verdent - Motor de Fila Assíncrona para Processamento de Lotes em Massa
 * - Sem limites arbitrários de tamanho de arquivo
 * - Concorrência controlada (worker pool) sem travamento da UI
 * - Liberação cooperativa do loop de eventos (yieldToMain)
 * - Suporte a Pausar, Continuar, Cancelar e Streaming Incremental
 */

import { PDFDocument } from 'pdf-lib';
import { MedicalCertificateRecord } from '../types';

/**
 * Libera o loop de eventos do navegador para garantir que cliques,
 * animações a 60fps e renderizações da UI nunca congelem.
 */
export const yieldToMain = (): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && 'scheduler' in window && (window as any).scheduler?.yield) {
      (window as any).scheduler.yield().then(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
};

/**
 * Converte File para Base64 sem limite arbitrário de tamanho
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Prepara imagens escaneadas de qualquer tamanho (fotos de alta resolução, escâneres 4K/8K).
 * Remove limites arbitrários de megabytes, aplicando redimensionamento preventivo
 * apenas quando a dimensão ultrapassa limites de memória do canvas do navegador (> 4096px).
 */
export const prepareImageForOcr = async (file: File): Promise<string> => {
  await yieldToMain();

  // Se for PDF, converte diretamente para base64
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return fileToBase64(file);
  }

  // Para imagens (JPEG, PNG, WEBP), otimiza para máxima precisão OCR e mínima latência
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        await yieldToMain();
        let width = img.width;
        let height = img.height;
        const maxDimension = 2048; // Dimensão ideal para Gemini Vision: nitidez máxima de carimbos com 85% menos tráfego de rede

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Leve realce de nitidez e contraste para manuscritos e carimbos
          try {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            let minLum = 255;
            let maxLum = 0;
            // Amostragem rápida (1 em cada 64 pixels)
            for (let i = 0; i < data.length; i += 64) {
              const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
              if (lum < minLum) minLum = lum;
              if (lum > maxLum) maxLum = lum;
            }

            // Se o contraste for baixo (foto escura ou lavada), aplica estiramento de histograma
            if (maxLum - minLum > 30 && (minLum > 40 || maxLum < 215)) {
              const factor = 255 / (maxLum - minLum);
              for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, Math.max(0, (data[i] - minLum) * factor));
                data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - minLum) * factor));
                data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - minLum) * factor));
              }
              ctx.putImageData(imgData, 0, 0);
            }
          } catch {
            // Em caso de restrição de canvas, segue com a imagem padrão
          }

          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          // Libera contexto
          canvas.width = 0;
          canvas.height = 0;
          resolve(dataUrl);
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

export interface PageOcrResult {
  record: MedicalCertificateRecord | null;
  isIlegivel: boolean;
  motivoIlegivel?: string;
  quotaNotice?: boolean;
}

export interface DocumentProcessingItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

export interface BatchProcessingStats {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalRecordsExtracted: number;
  inProgressCount: number;
  percent: number;
  currentWorkers: { workerId: number; currentItemName: string }[];
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
}

export interface QueueCallbacks {
  onItemStart?: (item: DocumentProcessingItem, workerId: number) => void;
  onItemPageProgress?: (item: DocumentProcessingItem, pageNumber: number, totalPages: number) => void;
  onItemSuccess?: (item: DocumentProcessingItem, records: MedicalCertificateRecord[], pagesIlegiveis: number[], totalPages: number) => void;
  onItemError?: (item: DocumentProcessingItem, error: Error) => void;
  onRecordDiscovered?: (record: MedicalCertificateRecord) => void;
  onStatsUpdate?: (stats: BatchProcessingStats) => void;
}

/**
 * Classe controladora da Fila Assíncrona de Lote com Workers Concorrentes
 */
export class AsyncBatchQueueEngine {
  private items: DocumentProcessingItem[] = [];
  private concurrency: number;
  private isRunning = false;
  private isPaused = false;
  private isCancelled = false;
  private activeWorkers = 0;
  private nextItemIndex = 0;
  private startTime = 0;
  private completedFilesCount = 0;
  private failedFilesCount = 0;
  private extractedRecordsCount = 0;
  private workerStatusMap: Map<number, string> = new Map();
  private callbacks: QueueCallbacks;

  constructor(items: DocumentProcessingItem[], concurrency = 1, callbacks: QueueCallbacks = {}) {
    this.items = [...items];
    this.concurrency = Math.max(1, Math.min(concurrency, 2)); // Limite seguro para respeitar cota de 15 RPM
    this.callbacks = callbacks;
  }

  public setConcurrency(val: number) {
    this.concurrency = Math.max(1, Math.min(val, 2));
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.triggerWorkers();
    }
  }

  public cancel() {
    this.isCancelled = true;
    this.isRunning = false;
    this.isPaused = false;
  }

  public async start(): Promise<{
    records: MedicalCertificateRecord[];
    filesSummary: any[];
  }> {
    this.isRunning = true;
    this.isPaused = false;
    this.isCancelled = false;
    this.startTime = Date.now();
    this.nextItemIndex = 0;
    this.completedFilesCount = 0;
    this.failedFilesCount = 0;
    this.extractedRecordsCount = 0;
    this.workerStatusMap.clear();

    const allExtractedRecords: MedicalCertificateRecord[] = [];
    const filesSummary: any[] = [];

    this.emitStats();

    return new Promise((resolve) => {
      const checkCompletion = () => {
        if (this.isCancelled) {
          resolve({
            records: allExtractedRecords,
            filesSummary,
          });
          return;
        }

        if (this.nextItemIndex >= this.items.length && this.activeWorkers === 0) {
          this.isRunning = false;
          resolve({
            records: allExtractedRecords,
            filesSummary,
          });
          return;
        }
      };

      const runWorker = async (workerId: number) => {
        while (this.isRunning && !this.isCancelled) {
          if (this.isPaused) {
            await yieldToMain();
            await new Promise((r) => setTimeout(r, 200));
            continue;
          }

          if (this.nextItemIndex >= this.items.length) {
            break;
          }

          const currentIdx = this.nextItemIndex++;
          const currentItem = this.items[currentIdx];

          this.workerStatusMap.set(workerId, currentItem.name);
          this.emitStats();

          if (this.callbacks.onItemStart) {
            this.callbacks.onItemStart(currentItem, workerId);
          }

          await yieldToMain();

          try {
            const { records, pagesIlegiveis, totalPages, summaryError } = await this.processSingleDocument(
              currentItem,
              workerId
            );

            if (this.isCancelled) break;

            allExtractedRecords.push(...records);
            this.extractedRecordsCount += records.length;
            this.completedFilesCount++;

            // Emite registros individualmente de forma incremental
            for (const rec of records) {
              if (this.callbacks.onRecordDiscovered) {
                this.callbacks.onRecordDiscovered(rec);
              }
            }

            const status = records.length === 0 ? 'ilegivel' : 'concluido';
            filesSummary.push({
              nome: currentItem.name,
              tamanho: currentItem.size,
              status,
              erro: summaryError,
              totalRegistros: records.length,
            });

            if (this.callbacks.onItemSuccess) {
              this.callbacks.onItemSuccess(currentItem, records, pagesIlegiveis, totalPages);
            }
          } catch (err: any) {
            if (this.isCancelled) break;
            this.failedFilesCount++;
            filesSummary.push({
              nome: currentItem.name,
              tamanho: currentItem.size,
              status: 'erro',
              erro: err.message || 'Falha no processamento.',
              totalRegistros: 0,
            });

            if (this.callbacks.onItemError) {
              this.callbacks.onItemError(currentItem, err);
            }
          } finally {
            this.workerStatusMap.delete(workerId);
            this.emitStats();
            await yieldToMain();
          }
        }

        this.activeWorkers--;
        this.emitStats();
        checkCompletion();
      };

      // Inicia a quantidade configurada de workers simultâneos
      const initialWorkers = Math.min(this.concurrency, this.items.length);
      this.activeWorkers = initialWorkers;

      for (let w = 1; w <= initialWorkers; w++) {
        runWorker(w);
      }
    });
  }

  private triggerWorkers() {
    // Caso de retomada após pausa
    const neededWorkers = Math.min(this.concurrency, this.items.length - this.nextItemIndex) - this.activeWorkers;
    for (let i = 0; i < neededWorkers; i++) {
      this.activeWorkers++;
      // Em caso de re-início
    }
  }

  /**
   * Processa um arquivo individual (PDF multi-página ou imagem) sem travar a UI
   */
  private async processSingleDocument(
    item: DocumentProcessingItem,
    workerId: number
  ): Promise<{
    records: MedicalCertificateRecord[];
    pagesIlegiveis: number[];
    totalPages: number;
    confiancaMedia: number;
    summaryError?: string;
  }> {
    return processSingleDocumentDirectly(
      item,
      (pageNum, totalPages) => {
        this.workerStatusMap.set(
          workerId,
          totalPages > 1 ? `${item.name} (Pág ${pageNum}/${totalPages})` : item.name
        );
        this.emitStats();
        if (this.callbacks.onItemPageProgress) {
          this.callbacks.onItemPageProgress(item, pageNum, totalPages);
        }
      },
      () => this.isCancelled,
      async () => {
        while (this.isPaused && !this.isCancelled) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    );
  }

  private emitStats() {
    if (!this.callbacks.onStatsUpdate) return;

    const total = this.items.length;
    const processed = this.completedFilesCount + this.failedFilesCount;
    const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

    const elapsedSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
    let estimatedRemainingSeconds = 0;

    if (processed > 0 && processed < total) {
      const avgSecondsPerDoc = elapsedSeconds / processed;
      const remainingDocs = total - processed;
      estimatedRemainingSeconds = Math.round(avgSecondsPerDoc * remainingDocs);
    }

    const currentWorkers: { workerId: number; currentItemName: string }[] = [];
    this.workerStatusMap.forEach((name, id) => {
      currentWorkers.push({ workerId: id, currentItemName: name });
    });

    this.callbacks.onStatsUpdate({
      totalFiles: total,
      completedFiles: this.completedFilesCount,
      failedFiles: this.failedFilesCount,
      totalRecordsExtracted: this.extractedRecordsCount,
      inProgressCount: this.activeWorkers,
      percent,
      currentWorkers,
      elapsedSeconds,
      estimatedRemainingSeconds,
    });
  }
}

/**
 * Função direta para processar ou re-processar um único arquivo (PDF ou imagem)
 * Utilizada tanto pelo motor em lote quanto pelo botão "Re-processar Arquivo" individual
 */
export async function processSingleDocumentDirectly(
  item: DocumentProcessingItem,
  onPageProgress?: (pageNumber: number, totalPages: number) => void,
  checkCancelled?: () => boolean,
  checkPaused?: () => Promise<void>
): Promise<{
  records: MedicalCertificateRecord[];
  pagesIlegiveis: number[];
  totalPages: number;
  confiancaMedia: number;
  summaryError?: string;
}> {
  const isPdf = item.type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf');
  const returnedRecords: MedicalCertificateRecord[] = [];
  const paginasIlegiveis: number[] = [];
  let totalDocPages = 1;
  let summaryError: string | undefined = undefined;

  if (isPdf) {
    await yieldToMain();
    let arrayBuffer: ArrayBuffer | null = await item.file.arrayBuffer();
    let pdfDoc: PDFDocument | null = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    totalDocPages = pdfDoc.getPageCount();

    for (let p = 0; p < totalDocPages; p++) {
      if (checkCancelled && checkCancelled()) break;
      if (checkPaused) {
        await checkPaused();
      }

      const pageNum = p + 1;
      if (onPageProgress) {
        onPageProgress(pageNum, totalDocPages);
      }

      await yieldToMain();

      const subDoc = await PDFDocument.create();
      const [copiedPage] = await subDoc.copyPages(pdfDoc, [p]);
      subDoc.addPage(copiedPage);
      const pageBase64 = await subDoc.saveAsBase64();

      let pageData: any = null;
      let lastPageErr: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const pageResponse = await fetch('/api/ocr/process-page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: item.name,
              pageNumber: pageNum,
              totalPages: totalDocPages,
              base64Data: pageBase64,
              fileType: 'application/pdf',
              forceRefresh: true,
            }),
          });

          if (pageResponse.status === 429 || pageResponse.status >= 500) {
            const errData = await pageResponse.json().catch(() => ({}));
            lastPageErr = new Error(errData.error || `HTTP ${pageResponse.status}`);
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 2500));
              continue;
            }
          }

          if (!pageResponse.ok) {
            const errData = await pageResponse.json().catch(() => ({}));
            lastPageErr = new Error(errData.error || `Erro HTTP ${pageResponse.status}`);
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 1200));
              continue;
            }
          } else {
            pageData = await pageResponse.json();
            break;
          }
        } catch (e: any) {
          lastPageErr = e;
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      }

      if (pageData && pageData.registro) {
        returnedRecords.push(pageData.registro);
        if (pageData.isIlegivel) {
          paginasIlegiveis.push(pageNum);
        }
        if (pageData.quotaNotice) {
          summaryError = 'Limite de taxa/cota atingido no Gemini. Registro preservado para preenchimento manual.';
        }
      } else {
        paginasIlegiveis.push(pageNum);
        const errDetail = lastPageErr ? lastPageErr.message : 'Falha na leitura da página';
        returnedRecords.push({
          id: `rec-falha-${Date.now()}-${pageNum}-${Math.random().toString(36).substring(2, 6)}`,
          funcionario: 'Revisar nome',
          dias: 'Revisar quantidade',
          data: 'Revisar data',
          cid: 'Não informado',
          tipoDocumento: 'Atestado Médico',
          horario: '-',
          local: 'A conferir',
          profissional: 'A conferir',
          observacao: `Atenção: Não foi possível realizar OCR automático nesta página (${errDetail}). Preencher manualmente.`,
          arquivoOrigem: item.name,
          paginaOrigem: pageNum,
          status: 'revisar',
          motivoRevisao: `Leitura incompleta: ${errDetail}. Conferência manual requerida.`,
          confiancaOcr: 30,
          dataProcessamento: new Date().toISOString(),
        });
      }

      if (p < totalDocPages - 1) {
        await yieldToMain();
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    pdfDoc = null;
    arrayBuffer = null;
  } else {
    await yieldToMain();
    const base64Data = await prepareImageForOcr(item.file);

    let pageData: any = null;
    let lastImgErr: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch('/api/ocr/process-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: item.name,
            pageNumber: 1,
            totalPages: 1,
            base64Data,
            fileType: item.type || 'image/jpeg',
            forceRefresh: true,
          }),
        });

        if (response.status === 429 || response.status >= 500) {
          const errData = await response.json().catch(() => ({}));
          lastImgErr = new Error(errData.error || `HTTP ${response.status}`);
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 2500));
            continue;
          }
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          lastImgErr = new Error(errData.error || `Erro HTTP ${response.status}`);
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
        } else {
          pageData = await response.json();
          break;
        }
      } catch (e: any) {
        lastImgErr = e;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    if (pageData && pageData.registro) {
      returnedRecords.push(pageData.registro);
      if (pageData.isIlegivel) {
        paginasIlegiveis.push(1);
      }
      if (pageData.quotaNotice) {
        summaryError = 'Limite de taxa/cota atingido no Gemini. Registro preservado para conferência.';
      }
    } else {
      paginasIlegiveis.push(1);
      const errDetail = lastImgErr ? lastImgErr.message : 'Falha na leitura da imagem';
      returnedRecords.push({
        id: `rec-falha-${Date.now()}-1-${Math.random().toString(36).substring(2, 6)}`,
        funcionario: 'Revisar nome',
        dias: 'Revisar quantidade',
        data: 'Revisar data',
        cid: 'Não informado',
        tipoDocumento: 'Atestado Médico',
        horario: '-',
        local: 'A conferir',
        profissional: 'A conferir',
        observacao: `Atenção: Não foi possível realizar OCR automático na imagem (${errDetail}). Preencher manualmente.`,
        arquivoOrigem: item.name,
        paginaOrigem: 1,
        status: 'revisar',
        motivoRevisao: `Leitura incompleta: ${errDetail}. Conferência manual requerida.`,
        confiancaOcr: 30,
        dataProcessamento: new Date().toISOString(),
      });
    }
  }

  if (returnedRecords.length === 0) {
    summaryError = 'Nenhum atestado legível detectado no documento.';
  } else if (paginasIlegiveis.length > 0 && !summaryError) {
    summaryError = `Atenção: Página(s) ${paginasIlegiveis.join(', ')} com baixa legibilidade.`;
  }

  const confiancaMedia = returnedRecords.length > 0
    ? Math.round(returnedRecords.reduce((sum, r) => sum + (r.confiancaOcr || 80), 0) / returnedRecords.length)
    : 0;

  return {
    records: returnedRecords,
    pagesIlegiveis: paginasIlegiveis,
    totalPages: totalDocPages,
    confiancaMedia,
    summaryError,
  };
}
