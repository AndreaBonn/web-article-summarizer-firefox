import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@utils/core/logger.js', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@utils/i18n/i18n-extended.js', () => ({
  I18n: {
    translations: {
      it: { common: { save: 'Salva', cancel: 'Annulla' }, nav: { home: 'Home' } },
      en: { common: { save: 'Save', cancel: 'Cancel' }, nav: { home: 'Home' } },
      es: { common: { save: 'Guardar' }, nav: { home: 'Inicio' } },
    },
  },
}));

const store = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  global.browser = {
    storage: {
      local: {
        get: vi.fn((keys) => {
          const result = {};
          for (const key of keys) {
            if (store[key] !== undefined) result[key] = JSON.parse(JSON.stringify(store[key]));
          }
          return Promise.resolve(result);
        }),
        set: vi.fn((data) => {
          const serialized = JSON.parse(JSON.stringify(data));
          Object.assign(store, serialized);
          return Promise.resolve();
        }),
        remove: vi.fn((keys) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          keyList.forEach((k) => delete store[k]);
          return Promise.resolve();
        }),
      },
    },
  };
  vi.clearAllMocks();
});

import { I18nValidator } from '@utils/i18n/i18n-validator.js';

describe('I18nValidator', () => {
  describe('getAllKeys', () => {
    it('test_getAllKeys_nestedObject_returnsAllDottedKeys', () => {
      // Arrange
      const obj = { common: { save: 'Salva', cancel: 'Annulla' }, nav: { home: 'Home' } };

      // Act
      const keys = I18nValidator.getAllKeys(obj);

      // Assert
      expect(keys).toContain('common.save');
      expect(keys).toContain('common.cancel');
      expect(keys).toContain('nav.home');
      expect(keys).toHaveLength(3);
    });

    it('test_getAllKeys_emptyObject_returnsEmpty', () => {
      // Arrange
      const obj = {};

      // Act
      const keys = I18nValidator.getAllKeys(obj);

      // Assert
      expect(keys).toEqual([]);
    });
  });

  describe('getValueByKey', () => {
    it('test_getValueByKey_validKey_returnsValue', () => {
      // Arrange
      const obj = { common: { save: 'Salva' } };

      // Act
      const value = I18nValidator.getValueByKey(obj, 'common.save');

      // Assert
      expect(value).toBe('Salva');
    });

    it('test_getValueByKey_invalidKey_returnsUndefined', () => {
      // Arrange
      const obj = { common: { save: 'Salva' } };

      // Act
      const value = I18nValidator.getValueByKey(obj, 'common.nonexistent');

      // Assert
      expect(value).toBeUndefined();
    });
  });

  describe('validateTranslations', () => {
    // validateTranslations() ritorna: { valid: bool, errors: [], warnings: [], stats: {} }
    // errors: [{ language, type: 'missing_keys', keys, count }]
    // warnings: [{ language, type: 'extra_keys', keys, count }]

    it('test_validateTranslations_allComplete_isValid', () => {
      // Arrange — 'en' ha tutte le chiavi di 'it' (la lingua di riferimento)

      // Act
      const report = I18nValidator.validateTranslations();

      // Assert — 'en' non genera errori, quindi nessun errore con language='en'
      const enError = report.errors.find((e) => e.language === 'en');
      expect(enError).toBeUndefined();
    });

    it('test_validateTranslations_missingKeys_reportsErrors', () => {
      // Arrange — 'es' manca di 'common.cancel' rispetto a 'it'

      // Act
      const report = I18nValidator.validateTranslations();

      // Assert
      expect(report.valid).toBe(false);
      const esError = report.errors.find((e) => e.language === 'es');
      expect(esError).toBeDefined();
      expect(esError.keys).toContain('common.cancel');
    });

    it('test_validateTranslations_extraKeys_reportsWarnings', () => {
      // Arrange — 'en' ha tutte le chiavi, nessuna in più → nessun warning per 'en'
      // 'es' manca di una chiave ma non ne ha in più → nessun warning per 'es'

      // Act
      const report = I18nValidator.validateTranslations();

      // Assert — la struttura è un oggetto con errors/warnings/valid/stats
      expect(report).toHaveProperty('valid');
      expect(report).toHaveProperty('errors');
      expect(report).toHaveProperty('warnings');
      expect(report).toHaveProperty('stats');
      // Nessun warning atteso per il mock corrente (nessuna lingua ha chiavi extra)
      expect(report.warnings).toHaveLength(0);
    });

    it('test_validateTranslations_includesStatsForEachLanguage', () => {
      // Act
      const report = I18nValidator.validateTranslations();

      // Assert
      expect(report.stats.referenceKeys).toBe(3); // it: common.save, common.cancel, nav.home
      expect(report.stats.en).toBe(3);
      expect(report.stats.es).toBe(2); // solo common.save e nav.home
    });

    it('test_validateTranslations_errorContainsMissingCount', () => {
      // Act
      const report = I18nValidator.validateTranslations();

      // Assert
      const esError = report.errors.find((e) => e.language === 'es');
      expect(esError.count).toBe(1);
      expect(esError.type).toBe('missing_keys');
    });

    it('test_validateTranslations_skipsReferenceLanguage', () => {
      // Act
      const report = I18nValidator.validateTranslations();

      // Assert — 'it' non appare negli errori (è la lingua di riferimento)
      const itError = report.errors.find((e) => e.language === 'it');
      expect(itError).toBeUndefined();
    });
  });

  describe('printReport', () => {
    it('test_printReport_validReport_returnsTrue', () => {
      // Arrange
      const validReport = {
        valid: true,
        errors: [],
        warnings: [],
        stats: { referenceKeys: 3, en: 3 },
      };

      // Act
      const result = I18nValidator.printReport(validReport);

      // Assert
      expect(result).toBe(true);
    });

    it('test_printReport_invalidReport_returnsFalse', () => {
      // Arrange
      const invalidReport = {
        valid: false,
        errors: [{ language: 'de', count: 2, keys: ['common.save', 'nav.home'] }],
        warnings: [],
        stats: { referenceKeys: 3, de: 1 },
      };

      // Act
      const result = I18nValidator.printReport(invalidReport);

      // Assert
      expect(result).toBe(false);
    });

    it('test_printReport_withWarnings_returnsTrue', () => {
      // Arrange
      const reportWithWarnings = {
        valid: true,
        errors: [],
        warnings: [{ language: 'en', count: 1, keys: ['extra.key'] }],
        stats: { referenceKeys: 3, en: 4 },
      };

      // Act
      const result = I18nValidator.printReport(reportWithWarnings);

      // Assert
      expect(result).toBe(true);
    });

    it('test_printReport_logsStatisticsForEachLanguage', async () => {
      // Arrange
      const { Logger } = await import('@utils/core/logger.js');
      const report = {
        valid: true,
        errors: [],
        warnings: [],
        stats: { referenceKeys: 5, en: 5, fr: 3 },
      };

      // Act
      I18nValidator.printReport(report);

      // Assert — verifica che Logger.info sia stato chiamato (log prodotto)
      expect(Logger.info).toHaveBeenCalled();
    });

    it('test_printReport_withErrors_callsLoggerWarn', async () => {
      // Arrange
      const { Logger } = await import('@utils/core/logger.js');
      vi.clearAllMocks();
      const report = {
        valid: false,
        errors: [{ language: 'de', count: 1, keys: ['some.key'] }],
        warnings: [],
        stats: { referenceKeys: 3, de: 2 },
      };

      // Act
      I18nValidator.printReport(report);

      // Assert
      expect(Logger.warn).toHaveBeenCalled();
    });
  });

  describe('generateMissingTemplate', () => {
    it('test_generateMissingTemplate_noErrors_doesNotLog_keys', async () => {
      // Arrange
      const { Logger } = await import('@utils/core/logger.js');
      vi.clearAllMocks();
      const report = { errors: [] };

      // Act
      I18nValidator.generateMissingTemplate(report);

      // Assert — solo il messaggio "No missing" viene loggato
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('No missing translations'));
    });

    it('test_generateMissingTemplate_withErrors_logsKeysWithValues', async () => {
      // Arrange
      const { Logger } = await import('@utils/core/logger.js');
      vi.clearAllMocks();
      const report = {
        errors: [
          {
            language: 'de',
            keys: ['common.save', 'nav.home'],
          },
        ],
      };

      // Act
      I18nValidator.generateMissingTemplate(report);

      // Assert — deve loggare le chiavi mancanti con i valori italiani
      // Il mock I18n.translations.it.common.save = 'Salva', nav.home = 'Home'
      const allInfoCalls = Logger.info.mock.calls.flat();
      expect(allInfoCalls.some((msg) => msg.includes('common.save'))).toBe(true);
      expect(allInfoCalls.some((msg) => msg.includes('Salva'))).toBe(true);
    });

    it('test_generateMissingTemplate_withErrors_logsLanguageHeader', async () => {
      // Arrange
      const { Logger } = await import('@utils/core/logger.js');
      vi.clearAllMocks();
      const report = {
        errors: [{ language: 'fr', keys: ['common.cancel'] }],
      };

      // Act
      I18nValidator.generateMissingTemplate(report);

      // Assert
      const allInfoCalls = Logger.info.mock.calls.flat();
      expect(allInfoCalls.some((msg) => msg.includes('FR'))).toBe(true);
    });
  });

  describe('getValueByKey', () => {
    it('test_getValueByKey_deeplyNested_returnsValue', () => {
      // Arrange
      const obj = { a: { b: { c: 'deep value' } } };

      // Act
      const value = I18nValidator.getValueByKey(obj, 'a.b.c');

      // Assert
      expect(value).toBe('deep value');
    });

    it('test_getValueByKey_topLevelKey_returnsValue', () => {
      // Arrange
      const obj = { topLevel: 'value' };

      // Act
      const value = I18nValidator.getValueByKey(obj, 'topLevel');

      // Assert
      expect(value).toBe('value');
    });

    it('test_getValueByKey_partialPath_intermediate_null_returnsUndefined', () => {
      // Arrange
      const obj = { a: null };

      // Act
      const value = I18nValidator.getValueByKey(obj, 'a.b');

      // Assert
      expect(value).toBeUndefined();
    });

    it('test_getValueByKey_emptyObject_returnsUndefined', () => {
      // Act
      const value = I18nValidator.getValueByKey({}, 'any.key');

      // Assert
      expect(value).toBeUndefined();
    });
  });

  describe('getAllKeys', () => {
    it('test_getAllKeys_withPrefix_returnsDottedPaths', () => {
      // Arrange
      const obj = { save: 'Salva', cancel: 'Annulla' };

      // Act
      const keys = I18nValidator.getAllKeys(obj, 'common');

      // Assert
      expect(keys).toContain('common.save');
      expect(keys).toContain('common.cancel');
    });

    it('test_getAllKeys_deeplyNested_returnsAllLeaves', () => {
      // Arrange
      const obj = { a: { b: { c: 'v1', d: 'v2' }, e: 'v3' } };

      // Act
      const keys = I18nValidator.getAllKeys(obj);

      // Assert
      expect(keys).toContain('a.b.c');
      expect(keys).toContain('a.b.d');
      expect(keys).toContain('a.e');
      expect(keys).toHaveLength(3);
    });

    it('test_getAllKeys_withNullValue_skipsNullBranch', () => {
      // Arrange — null non è un object che si itera
      const obj = { a: 'val', b: null };

      // Act
      const keys = I18nValidator.getAllKeys(obj);

      // Assert — null viene trattato come leaf? No: typeof null === 'object' ma il check è !== null
      // Quindi b: null → null !== null è falso → NOT ricorsivo → push 'b'
      expect(keys).toContain('a');
      expect(keys).toContain('b');
    });
  });
});
