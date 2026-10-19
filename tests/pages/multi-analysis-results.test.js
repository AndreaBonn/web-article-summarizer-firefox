import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatMarkdown,
  showAnalysisModal,
  closeAnalysisModal,
  switchTab,
  reopenSavedAnalysis,
} from '@pages/multi-analysis/results.js';
import { state } from '@pages/multi-analysis/state.js';

beforeEach(() => {
  state.currentAnalysis = null;
  state.selectedArticles = [];
  state.allArticles = [];
  document.body.innerHTML = `
    <header></header><div class="selection-panel"></div><div class="analysis-panel"></div>
    <div id="analysisModal" class="hidden"></div>
    <button class="modal-tab" data-tab="summary"></button>
    <button class="modal-tab" data-tab="comparison"></button>
    <button class="modal-tab" data-tab="qa"></button>
    <div id="tabSummary" class="modal-pane"></div>
    <div id="tabComparison" class="modal-pane"></div>
    <div id="tabQA" class="modal-pane"></div>
    <button id="closeModal"></button><button id="exportPdfBtn"></button>
    <button id="exportMdBtn"></button><button id="sendEmailBtn"></button><button id="copyBtn"></button>`;
});
afterEach(() => {
  state.currentAnalysis = null;
  state.selectedArticles = [];
  state.allArticles = [];
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('multi-analysis results', () => {
  it('test_formatMarkdown_renders_headings_bold_and_literal_html', () => {
    const container = document.createElement('div');
    container.innerHTML = formatMarkdown(
      '### Details\n## Overview\n\nPlain **bold** tail\n   \n<img src=x onerror=alert(1)>',
    );
    expect(container.querySelector('h4').textContent).toBe('Details');
    expect(container.querySelector('h3').textContent).toBe('Overview');
    expect(container.querySelector('strong').textContent).toBe('bold');
    expect(Array.from(container.querySelectorAll('p'), (el) => el.textContent)).toEqual([
      'Plain bold tail',
      '<img src=x onerror=alert(1)>',
    ]);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(formatMarkdown('')).toBe('');
    expect(formatMarkdown('**bold**')).toBe('<p><strong>bold</strong></p>');
  });

  it('test_showAnalysisModal_renders_sections_and_toggles_visibility', () => {
    showAnalysisModal();
    expect(document.getElementById('analysisModal').classList.contains('hidden')).toBe(true);
    state.currentAnalysis = { globalSummary: '### Overview', comparison: '**Different**' };
    showAnalysisModal();
    expect(document.querySelector('#tabSummary h4').textContent).toBe('Overview');
    expect(document.querySelector('#tabComparison strong').textContent).toBe('Different');
    expect(document.getElementById('tabQA').textContent).toBe('Q&A non abilitato');
    expect(document.getElementById('analysisModal').classList.contains('hidden')).toBe(false);
    closeAnalysisModal();
    expect(document.getElementById('analysisModal').classList.contains('hidden')).toBe(true);
    state.currentAnalysis = {};
    showAnalysisModal();
    expect(document.getElementById('tabSummary').textContent).toBe('Riassunto non generato');
    expect(document.getElementById('tabComparison').textContent).toBe('Confronto non generato');
  });

  it('test_showAnalysisModal_restores_chat_as_text_and_handles_new_conversations', () => {
    state.currentAnalysis = {
      qa: {
        interactive: true,
        articles: [{}, {}],
        questions: [{ question: '<img> Why?', answer: '<img> Because.' }],
      },
    };
    showAnalysisModal();
    expect(Array.from(document.querySelectorAll('.qa-message'), (el) => el.textContent)).toEqual([
      'Tu: <img> Why?',
      'Assistente: <img> Because.',
    ]);
    expect(document.querySelectorAll('#tabQA img')).toHaveLength(0);
    expect(document.getElementById('qaInput').placeholder).toBe('Scrivi la tua domanda...');
    state.currentAnalysis = { qa: { interactive: true, questions: [] } };
    state.selectedArticles = ['a', 'b', 'c'];
    showAnalysisModal();
    expect(document.querySelector('.qa-welcome').textContent).toContain(
      'Fai domande sui 3 articoli selezionati.',
    );
    state.currentAnalysis = { qa: { interactive: true } };
    showAnalysisModal();
    expect(document.getElementById('qaSubmitBtn').textContent).toBe('Invia');
  });

  it('test_switchTab_activates_the_requested_pane_and_clears_previous_selection', () => {
    switchTab('summary');
    expect(document.querySelector('.modal-pane.active').id).toBe('tabSummary');
    switchTab('comparison');
    expect(document.querySelector('.modal-pane.active').id).toBe('tabComparison');
    expect(document.querySelector('.modal-tab.active').dataset.tab).toBe('comparison');
    switchTab('unknown');
    expect(document.querySelectorAll('.active')).toHaveLength(0);
    switchTab('qa');
    expect(document.querySelector('.modal-pane.active').id).toBe('tabQA');
  });

  it('test_reopenSavedAnalysis_restores_analysis_and_replaces_selection_with_saved_articles', async () => {
    vi.stubGlobal('browser', {
      runtime: { getURL: vi.fn((path) => 'moz-extension://test/' + path) },
    });
    await reopenSavedAnalysis({
      id: 'saved',
      analysis: { globalSummary: 'Saved overview' },
      articles: [{ id: 'a', title: 'Solar', url: 'https://example.org', wordCount: 10 }],
    });
    expect(state.selectedArticles).toEqual(['a']);
    expect(state.currentAnalysis.id).toBe('saved');
    expect(document.querySelector('#tabSummary .analysis-content').textContent.trim()).toBe(
      'Saved overview',
    );
    expect(document.querySelector('.selection-panel').style.display).toBe('none');
    expect(document.querySelector('.analysis-panel').style.display).toBe('none');
    expect(document.querySelector('header h1').textContent).toBe('Analisi Multi Articolo');
    expect(document.getElementById('backBtn').textContent).toBe('← Cronologia');
    document.querySelector('[data-tab="comparison"]').click();
    expect(document.querySelector('.modal-pane.active').id).toBe('tabComparison');
    expect(document.getElementById('analysisModal').classList.contains('hidden')).toBe(false);
  });
});
