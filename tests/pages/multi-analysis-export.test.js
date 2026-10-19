import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { pdfMock, alertMock } = vi.hoisted(() => ({
  pdfMock: vi.fn(),
  alertMock: vi.fn(),
}));

vi.mock('@utils/export/pdf-exporter.js', () => ({
  PDFExporter: { exportMultiAnalysisToPDF: pdfMock },
}));
vi.mock('@utils/core/modal.js', () => ({ Modal: { alert: alertMock } }));

import { exportPdf, showExportOptionsModal } from '@pages/multi-analysis/export.js';
import { state } from '@pages/multi-analysis/state.js';
import { I18n } from '@utils/i18n/i18n.js';

beforeEach(() => {
  I18n.currentLanguage = 'it';
  state.selectedArticles = [];
  state.allArticles = [];
  document.body.innerHTML = `
    <div id="exportOptionsModal" class="hidden"></div><h2 id="exportModalTitle"></h2>
    <label id="exportSummaryOption"><input id="exportIncludeSummary" type="checkbox" checked></label>
    <label id="exportComparisonOption"><input id="exportIncludeComparison" type="checkbox"></label>
    <label id="exportQAOption"><input id="exportIncludeQA" type="checkbox"></label>
    <button id="exportCancelBtn"></button><button id="exportConfirmBtn"></button>`;
});
afterEach(() => {
  state.currentAnalysis = null;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('multi-analysis export', () => {
  it('test_showExportOptionsModal_shows_summary_option_when_globalSummary_present', () => {
    state.currentAnalysis = { globalSummary: 'Overview' };
    showExportOptionsModal('PDF');
    expect(document.getElementById('exportSummaryOption').style.display).toBe('flex');
    expect(document.getElementById('exportComparisonOption').style.display).toBe('none');
  });

  it('test_showExportOptionsModal_hides_summary_option_when_globalSummary_absent', () => {
    state.currentAnalysis = { comparison: 'Different' };
    showExportOptionsModal('PDF');
    expect(document.getElementById('exportSummaryOption').style.display).toBe('none');
  });

  it('test_exportPdf_error_alert_substitutes_the_export_type_placeholder', async () => {
    state.currentAnalysis = { globalSummary: 'x' };
    pdfMock.mockRejectedValue(new Error('boom'));
    const pending = exportPdf();
    document.getElementById('exportConfirmBtn').click();
    await pending;
    const message = alertMock.mock.calls[0][0];
    expect(message).toBe("Errore durante l'esportazione PDF:boom");
    expect(message).not.toContain('{type}');
  });
});
