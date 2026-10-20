import { describe, expect, it } from 'vitest';
import { buildExportMetadata } from '../../src/pages/popup/export-options.js';

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
});
