import { describe, expect, it } from 'vitest';
import {
  buildExportMetadata,
  mergeEmailOptions,
  hasAnySelected,
} from '../../src/pages/popup/export-options.js';

describe('popup export options', () => {
  it('builds metadata from the selected provider, language and content type', () => {
    expect(
      buildExportMetadata({
        providerValue: 'groq',
        selectedLanguage: 'it',
        selectedContentType: 'technical',
      }),
    ).toEqual({ provider: 'groq', language: 'it', contentType: 'technical' });
  });

  it('keeps base selections and limits optional selections to available sections', () => {
    const checked = {
      includeSummary: true,
      includeKeypoints: true,
      includeTranslation: true,
      includeQA: true,
      includeCitations: true,
    };
    expect(mergeEmailOptions(checked, { translation: false, qa: false, citations: false })).toEqual(
      {
        includeSummary: true,
        includeKeypoints: true,
        includeTranslation: false,
        includeQA: false,
        includeCitations: false,
      },
    );
    expect(mergeEmailOptions(checked, { translation: true, qa: true, citations: true })).toEqual(
      checked,
    );
    expect(mergeEmailOptions({}, {})).toEqual({
      includeSummary: false,
      includeKeypoints: false,
      includeTranslation: false,
      includeQA: false,
      includeCitations: false,
    });
  });

  it('detects each selected section and empty selections', () => {
    const empty = {
      includeSummary: false,
      includeKeypoints: false,
      includeTranslation: false,
      includeQA: false,
      includeCitations: false,
    };
    expect(hasAnySelected(empty)).toBe(false);
    for (const key of Object.keys(empty)) {
      expect(hasAnySelected({ ...empty, [key]: true })).toBe(true);
    }
  });
});
