import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import itLocale from '../../src/utils/i18n/locales/it.json';
import enLocale from '../../src/utils/i18n/locales/en.json';

const ROOT = resolve(import.meta.dirname, '../..');

function listFiles(dir, ext) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listFiles(full, ext);
    return full.endsWith(ext) ? [full] : [];
  });
}

function keysUsedInHtml() {
  const attr = /data-i18n(?:-title|-placeholder|-aria)?="([^"]+)"/g;
  return listFiles(join(ROOT, 'src/pages'), '.html').flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(attr)].map((m) => ({ key: m[1], file })),
  );
}

function keysUsedInJs() {
  const call = /I18n\.tf?\(\s*'([a-zA-Z0-9_.]+)'/g;
  return [join(ROOT, 'src/pages'), join(ROOT, 'src/utils')]
    .flatMap((dir) => listFiles(dir, '.js'))
    .flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(call)].map((m) => ({ key: m[1], file })),
    );
}

describe('locale files', () => {
  it('test_locales_italianAndEnglish_haveSameKeys', () => {
    const missingInEn = Object.keys(itLocale).filter((k) => !(k in enLocale));
    const missingInIt = Object.keys(enLocale).filter((k) => !(k in itLocale));
    expect(missingInEn).toEqual([]);
    expect(missingInIt).toEqual([]);
  });

  it('test_locales_everyKeyUsedInHtml_existsInBothLanguages', () => {
    const used = keysUsedInHtml();
    expect(used.length).toBeGreaterThan(50);
    const missing = used.filter(({ key }) => !(key in itLocale) || !(key in enLocale));
    expect(missing.map(({ key, file }) => `${key} (${file.replace(ROOT, '')})`)).toEqual([]);
  });

  it('test_locales_everyKeyUsedInJs_existsInBothLanguages', () => {
    const used = keysUsedInJs();
    expect(used.length).toBeGreaterThan(50);
    const missing = used.filter(({ key }) => !(key in itLocale) || !(key in enLocale));
    expect([...new Set(missing.map(({ key }) => key))]).toEqual([]);
  });

  it('test_locales_noValueIsEmpty', () => {
    const empty = [...Object.entries(itLocale), ...Object.entries(enLocale)]
      .filter(([k, v]) => typeof v !== 'string' || (v.trim() === '' && k !== 'feedback.loading'))
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });
});
