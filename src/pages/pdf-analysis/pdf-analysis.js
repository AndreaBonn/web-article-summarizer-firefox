// PDF Analysis Page Script
import { Logger } from '../../utils/core/logger.js';
import * as pdfjsLib from 'pdfjs-dist';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { I18n } from '../../utils/i18n/i18n.js';
import { PDFAnalyzer } from '../../utils/pdf/pdf-analyzer.js';
import { Modal } from '../../utils/core/modal.js';
import { ThemeManager } from '../../utils/core/theme-manager.js';
import { createFontSizeControl } from '../../shared/font-size-control.js';
import { validatePdfFile, buildPdfHistoryRecord, buildPdfReadingModeData } from './pdf-intake.js';

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

    // The privacy notice names the service: let the user change it right there
    document.getElementById('changeProviderBtn').addEventListener('click', () => {
      document.getElementById('analysisOptions').classList.remove('hidden');
      document.getElementById('providerSelect').focus();
    });

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
  const validationError = validatePdfFile(file);
  if (validationError) {
    Modal.error(validationError);
    return;
  }

  selectedFile = file;

  // Mostra info file
  document.getElementById('pdfDropZone').style.display = 'none';
  document.getElementById('selectedFileInfo').classList.remove('hidden');
  document.getElementById('analysisOptions').classList.remove('hidden');
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = HistoryManager.formatFileSize(file.size);
  document.getElementById('analyzePdfBtn').disabled = false;

  Logger.info('File selezionato:', file.name);
}

function removeFile() {
  selectedFile = null;
  document.getElementById('pdfFileInput').value = '';
  document.getElementById('pdfDropZone').style.display = 'block';
  document.getElementById('selectedFileInfo').classList.add('hidden');
  document.getElementById('analysisOptions').classList.add('hidden');
  document.getElementById('analyzePdfBtn').disabled = true;
}

async function startAnalysis() {
  if (!selectedFile) {
    Modal.error('Nessun file selezionato');
    return;
  }

  // Mostra progress
  document.getElementById('analyzePdfBtn').disabled = true;
  document.getElementById('analysisProgress').classList.remove('hidden');

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
    const { pdfInfo, metadata } = buildPdfHistoryRecord({
      file: selectedFile,
      result,
      provider,
      settings,
    });

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
    document.getElementById('analysisProgress').classList.add('hidden');
  }
}

function updateProgress(message, percent) {
  document.getElementById('progressText').textContent = message;
  document.getElementById('progressFill').style.width = percent + '%';
}

async function openReadingMode(analysisData) {
  const dataToSave = buildPdfReadingModeData(analysisData, Date.now());

  // Salva dati per reading mode
  await browser.storage.local.set({
    pdfReadingMode: dataToSave,
  });

  // Apri reading mode
  browser.tabs.create({ url: 'src/pages/reading-mode/reading-mode.html?source=pdf' });
}

// Theme managed by ThemeManager (auto-init on import)

// Font Size Management
const fontSizeControl = createFontSizeControl({
  storageKey: 'pdfAnalysisFontSize',
  getLabel: () => document.getElementById('fontSizeLabel'),
  getDecreaseBtn: () => document.getElementById('fontDecreaseBtn'),
  getIncreaseBtn: () => document.getElementById('fontIncreaseBtn'),
});

const loadFontSize = () => fontSizeControl.load();
const increaseFontSize = () => fontSizeControl.increase();
const decreaseFontSize = () => fontSizeControl.decrease();
