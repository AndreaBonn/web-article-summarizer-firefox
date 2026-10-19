import { it, expect, vi, afterEach } from 'vitest';
import { EmailManager } from '@utils/export/email-manager.js';
import { MarkdownExporter } from '@utils/export/markdown-exporter.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('test_openEmailClient_encodes_subject_and_body_in_exact_mailto', () => {
  const create = vi.fn();
  vi.stubGlobal('browser', { tabs: { create } });

  EmailManager.openEmailClient('u@t.com', 'Spazi & simboli', 'Body con\nnewline');

  expect(create).toHaveBeenCalledExactlyOnceWith({
    url: 'mailto:u%40t.com?subject=Spazi%20%26%20simboli&body=Body%20con%0Anewline',
    active: false,
  });
});

it('test_downloadMarkdown_clicks_blob_url_with_markdown_and_revokes_same_url', async () => {
  const createObjectURL = vi.fn(() => 'blob:https://example.com/markdown-download');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  const downloads = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    downloads.push({ href: this.href, connected: this.isConnected });
  });

  MarkdownExporter.downloadMarkdown('# Energy\n\nA & B\n', 'Energy');

  expect(createObjectURL).toHaveBeenCalledTimes(1);
  const blob = createObjectURL.mock.calls[0][0];
  expect(blob).toBeInstanceOf(Blob);
  expect(blob.type).toBe('text/markdown;charset=utf-8');
  const content = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
  expect(content).toBe('# Energy\n\nA & B\n');
  expect(downloads).toEqual([
    { href: 'blob:https://example.com/markdown-download', connected: true },
  ]);
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
    'blob:https://example.com/markdown-download',
  );
});
