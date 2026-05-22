// PDF Analysis Page Script
import { Logger } from '../../utils/core/logger.js';
import * as pdfjsLib from 'pdfjs-dist';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { PDFAnalyzer } from '../../utils/pdf/pdf-analyzer.js';
import { Modal } from '../../utils/core/modal.js';
import { ThemeManager } from '../../utils/core/theme-manager.js';

let selectedFile = null;
let pdfAnalyzer = null;

function updatePrivacyNotice(providerName) {
  const el = document.getElementById('privacyNoticeText');
  if (el) {
    el.textContent = I18n.tf('pdf.privacyNotice', { provider: providerName });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    Logger.info('PDF Analysis: Inizializzazione...');

    await I18n.initPage();

    // Configura PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = browser.runtime.getURL('workers/pdf.worker.min.js');
    Logger.debug('PDF.js configurato con worker:', pdfjsLib.GlobalWorkerOptions.workerSrc);

    // Inizializza PDF Analyzer
    pdfAnalyzer = new PDFAnalyzer();

    // Carica impostazioni
    const settings = await StorageManager.getSettings();
    const providerSelect = document.getElementById('providerSelect');
    providerSelect.value = settings.selectedProvider || 'claude';

    // Aggiorna il testo del privacy notice con il provider
    const providerName = providerSelect.options[providerSelect.selectedIndex].text;
    updatePrivacyNotice(providerName);

    const savedLanguage = await StorageManager.getSelectedLanguage();
    if (savedLanguage) {
      document.getElementById('languageSelect').value = savedLanguage;
    }

    // Event listeners
    document.getElementById('backBtn').addEventListener('click', () => {
      window.close();
    });

    document
      .getElementById('themeToggleBtn')
      .addEventListener('click', () => ThemeManager.toggle());

    // Provider change
    document.getElementById('providerSelect').addEventListener('change', async (e) => {
      const settings = await StorageManager.getSettings();
      settings.selectedProvider = e.target.value;
      await StorageManager.saveSettings(settings);
      updatePrivacyNotice(e.target.options[e.target.selectedIndex].text);
    });

    // Language change
    document.getElementById('languageSelect').addEventListener('change', async (e) => {
      await StorageManager.saveSelectedLanguage(e.target.value);
    });

    // File input
    const fileInput = document.getElementById('pdfFileInput');
    const dropZone = document.getElementById('pdfDropZone');
    const browseBtn = document.getElementById('pdfBrowseBtn');

    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // Drag & Drop
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Remove file
    document.getElementById('removeFileBtn').addEventListener('click', removeFile);

    // Analyze button
    document.getElementById('analyzePdfBtn').addEventListener('click', startAnalysis);

    // Font size controls
    document.getElementById('fontIncreaseBtn').addEventListener('click', increaseFontSize);
    document.getElementById('fontDecreaseBtn').addEventListener('click', decreaseFontSize);

    // Load font size
    loadFontSize();

    Logger.debug('Event listeners configurati');
  } catch (error) {
    Logger.error('Errore inizializzazione PDF Analysis:', error);
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
      errorEl.textContent = 'Errore durante il caricamento. Ricarica la pagina.';
      errorEl.style.display = 'block';
    }
  }
});

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
}

function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
}

function handleFile(file) {
  // Validazione
  if (file.type !== 'application/pdf') {
    Modal.error('File non valido. Carica un file PDF.');
    return;
  }

  const maxSize = 20 * 1024 * 1024; // 20MB
  if (file.size > maxSize) {
    Modal.error('File troppo grande. Massimo 20MB.');
    return;
  }

  selectedFile = file;

  // Mostra info file
  document.getElementById('pdfDropZone').style.display = 'none';
  document.getElementById('selectedFileInfo').style.display = 'flex';
  document.getElementById('analysisOptions').style.display = 'flex';
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = formatFileSize(file.size);
  document.getElementById('analyzePdfBtn').disabled = false;

  Logger.info('File selezionato:', file.name);
}

function removeFile() {
  selectedFile = null;
  document.getElementById('pdfFileInput').value = '';
  document.getElementById('pdfDropZone').style.display = 'block';
  document.getElementById('selectedFileInfo').style.display = 'none';
  document.getElementById('analysisOptions').style.display = 'none';
  document.getElementById('analyzePdfBtn').disabled = true;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function startAnalysis() {
  if (!selectedFile) {
    Modal.error('Nessun file selezionato');
    return;
  }

  // Mostra progress
  document.getElementById('analyzePdfBtn').disabled = true;
  document.getElementById('analysisProgress').style.display = 'block';

  try {
    const provider = document.getElementById('providerSelect').value;
    const settings = {
      outputLanguage: document.getElementById('languageSelect').value,
      summaryLength: document.getElementById('summaryLengthSelect').value,
    };

    // Analizza PDF
    const result = await pdfAnalyzer.analyzePDF(selectedFile, provider, settings, updateProgress);

    Logger.info('Analisi completata:', result);

    // Salva nella cronologia PDF
    // La struttura cambia se viene dalla cache o meno
    const pdfInfo = {
      name: selectedFile.name,
      size: selectedFile.size,
      pages: result.pageCount || result.pdfInfo?.pages || 0,
      text: result.extractedText || result.pdfInfo?.text || '',
      metadata: result.pdfInfo?.metadata || {},
    };

    const metadata = {
      provider: provider,
      language: settings.outputLanguage,
      summaryLength: settings.summaryLength,
      fromCache: result.isFromCache || result.fromCache || false,
    };

    const historyId = await HistoryManager.savePDFAnalysis(
      pdfInfo,
      result.summary,
      result.keyPoints,
      metadata,
    );

    // Aggiungi l'ID alla cronologia per riferimento futuro
    result.historyId = historyId;

    // Mostra risultati in modalità lettura
    await openReadingMode(result);
  } catch (error) {
    Logger.error('Errore analisi:', error);
    await Modal.error(error.message);
    document.getElementById('analyzePdfBtn').disabled = false;
  } finally {
    document.getElementById('analysisProgress').style.display = 'none';
  }
}

function updateProgress(message, percent) {
  document.getElementById('progressText').textContent = message;
  document.getElementById('progressFill').style.width = percent + '%';
}

async function openReadingMode(analysisData) {
  // Rimuovi pdfFile (non serializzabile) prima di salvare
  const dataToSave = {
    ...analysisData,
    timestamp: Date.now(),
  };

  // Rimuovi il file PDF object (non può essere salvato in storage)
  delete dataToSave.pdfFile;

  // Salva dati per reading mode
  await browser.storage.local.set({
    pdfReadingMode: dataToSave,
  });

  // Apri reading mode
  browser.tabs.create({ url: 'src/pages/reading-mode/reading-mode.html?source=pdf' });
}

// Theme managed by ThemeManager (auto-init on import)

// Font Size Management
const FONT_SIZES = ['S', 'M', 'L', 'XL'];
let currentFontSizeIndex = 1; // Default: M

/**
 * Load saved font size
 */
function loadFontSize() {
  const savedSize = localStorage.getItem('pdfAnalysisFontSize') || 'M';
  const index = FONT_SIZES.indexOf(savedSize);
  currentFontSizeIndex = index >= 0 ? index : 1;
  applyFontSize();
}

/**
 * Apply font size to body
 */
function applyFontSize() {
  const size = FONT_SIZES[currentFontSizeIndex];
  document.body.setAttribute('data-font-size', size);

  const fontSizeLabel = document.getElementById('fontSizeLabel');
  if (fontSizeLabel) {
    fontSizeLabel.textContent = size;
  }

  // Update button states
  const fontDecreaseBtn = document.getElementById('fontDecreaseBtn');
  const fontIncreaseBtn = document.getElementById('fontIncreaseBtn');

  if (fontDecreaseBtn) {
    fontDecreaseBtn.disabled = currentFontSizeIndex === 0;
  }
  if (fontIncreaseBtn) {
    fontIncreaseBtn.disabled = currentFontSizeIndex === FONT_SIZES.length - 1;
  }

  // Save to localStorage
  localStorage.setItem('pdfAnalysisFontSize', size);
}

/**
 * Increase font size
 */
function increaseFontSize() {
  if (currentFontSizeIndex < FONT_SIZES.length - 1) {
    currentFontSizeIndex++;
    applyFontSize();
  }
}

/**
 * Decrease font size
 */
function decreaseFontSize() {
  if (currentFontSizeIndex > 0) {
    currentFontSizeIndex--;
    applyFontSize();
  }
}
