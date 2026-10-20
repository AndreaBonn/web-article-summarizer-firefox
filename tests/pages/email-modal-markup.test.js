import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The email handlers read these ids with getElementById: a missing checkbox silently
// turns its section off, which is how citations went missing from every email.
const EMAIL_SECTION_IDS = [
  'emailIncludeSummary',
  'emailIncludeKeypoints',
  'emailIncludeTranslation',
  'emailIncludeQA',
  'emailIncludeCitations',
  'emailCitationsOption',
];

describe.each(['src/pages/popup/popup.html', 'src/pages/history/history.html'])(
  'email modal markup in %s',
  (page) => {
    const html = readFileSync(page, 'utf8');

    it.each(EMAIL_SECTION_IDS)('declares #%s', (id) => {
      expect(html).toContain(`id="${id}"`);
    });
  },
);
