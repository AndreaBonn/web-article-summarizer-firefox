# Riferimento API

<p align="right">
  <strong>🇮🇹 Italiano</strong> · <a href="API.md">🇺🇸 English</a>
</p>

---

## Indice

- [Panoramica](#panoramica)
- [API Core](#api-core)
- [API Integrazione AI](#api-integrazione-ai)
- [API Storage](#api-storage)
- [API Sicurezza](#api-sicurezza)
- [API Export](#api-export)
- [API Utility](#api-utility)
- [Protocollo Messaggi](#protocollo-messaggi)

---

## Panoramica

Questo documento fornisce un riferimento completo per tutte le API pubbliche nell'estensione Web Article Summarizer. Queste API sono progettate per uso interno nell'estensione ma possono anche servire come guida per contributori e sviluppatori che estendono le funzionalità.

### Convenzioni API

- Tutte le funzioni async restituiscono Promise
- Gli errori vengono lanciati come oggetti Error con messaggi descrittivi
- I parametri opzionali sono contrassegnati con `?`
- Le annotazioni di tipo seguono le convenzioni JSDoc

---

## API Core

### APIOrchestrator

**Posizione**: `src/utils/ai/api-orchestrator.js`

Coordinatore centrale per tutte le interazioni con i provider AI.

#### `generateCompletion(provider, apiKey, systemPrompt, userPrompt, options?)`

Genera una completion da un provider AI.

**Parametri**:
- `provider` (string): Nome provider (`'groq'`, `'openai'`, `'anthropic'`, `'gemini'`)
- `apiKey` (string): API key per il provider
- `systemPrompt` (string): System prompt che definisce il comportamento AI
- `userPrompt` (string): User prompt con la richiesta effettiva
- `options` (object, opzionale):
  - `temperature` (number): Temperatura sampling (0-1, default: 0.3)
  - `maxTokens` (number): Token massimi nella risposta (default: 4096)
  - `model` (string): Modello specifico da usare (default del provider)
  - `responseFormat` (string): Formato risposta (`'json'` o `null`)

**Restituisce**: `Promise<string>` - La risposta testuale generata dall'AI

**Lancia**: `Error` se il provider non è supportato o la chiamata API fallisce

**Esempio**:
```javascript
const response = await APIOrchestrator.generateCompletion(
  'groq',
  'gsk_...',
  'Sei un assistente utile.',
  'Riassumi questo articolo: ...',
  { temperature: 0.3, maxTokens: 2000 }
);
```

#### `callAPI(provider, apiKey, article, settings)`

API di alto livello per il riassunto articoli.

**Parametri**:
- `provider` (string): Nome provider
- `apiKey` (string): API key
- `article` (object): Oggetto articolo con `title`, `content`, `paragraphs`, ecc.
- `settings` (object): Oggetto impostazioni con `language`, `contentType`, `summaryLength`, ecc.

**Restituisce**: `Promise<string>` - Testo risposta AI grezzo

**Esempio**:
```javascript
const response = await APIOrchestrator.callAPI(
  'openai',
  apiKey,
  article,
  { language: 'it', contentType: 'news', summaryLength: 'medium' }
);
```

#### `extractKeyPoints(provider, apiKey, article, settings)`

Estrae punti chiave da un articolo.

**Parametri**: Come `callAPI()`

**Restituisce**: `Promise<string>` - Risposta AI grezza con punti chiave

#### `parseResponse(responseText)`

Analizza risposta AI in formato strutturato.

**Parametri**:
- `responseText` (string): Risposta AI grezza

**Restituisce**: `object` con:
- `summary` (string): Riassunto estratto
- `keyPoints` (array): Array di oggetti punto chiave

**Esempio**:
```javascript
const { summary, keyPoints } = APIOrchestrator.parseResponse(response);
```

---

### ContentDetector

**Posizione**: `src/utils/ai/content-detector.js`

Analizza il contenuto dell'articolo per rilevare tipo e lingua.

#### `detectContentType(article)`

Rileva il tipo di contenuto in un articolo.

**Parametri**:
- `article` (object): Oggetto articolo con `title` e `content`

**Restituisce**: `string` - Tipo contenuto (`'scientific'`, `'news'`, `'tutorial'`, `'business'`, `'opinion'`, `'general'`)

**Algoritmo**: Rilevamento basato su scoring che analizza parole chiave, pattern e struttura

**Esempio**:
```javascript
const contentType = ContentDetector.detectContentType(article);
// Restituisce: 'scientific'
```

#### `detectLanguage(text)`

Rileva la lingua di un testo.

**Parametri**:
- `text` (string): Testo da analizzare

**Restituisce**: `string` - Codice lingua (`'it'`, `'en'`, `'es'`, `'fr'`, `'de'`)

**Algoritmo**: Pattern matching su parole comuni

**Esempio**:
```javascript
const language = ContentDetector.detectLanguage(article.content);
// Restituisce: 'it'
```

---

### PromptBuilder

**Posizione**: `src/utils/ai/prompt-builder.js`

Costruisce prompt ottimizzati per i provider AI.

#### `buildPrompt(provider, article, settings, detectContentType, detectLanguage)`

Costruisce un prompt completo per il riassunto articoli.

**Parametri**:
- `provider` (string): Nome provider
- `article` (object): Oggetto articolo
- `settings` (object): Oggetto impostazioni
- `detectContentType` (function): Funzione rilevamento tipo contenuto
- `detectLanguage` (function): Funzione rilevamento lingua

**Restituisce**: `object` con:
- `systemPrompt` (string): System prompt
- `userPrompt` (string): User prompt

**Esempio**:
```javascript
const prompt = PromptBuilder.buildPrompt(
  'groq',
  article,
  settings,
  (a) => ContentDetector.detectContentType(a),
  (t) => ContentDetector.detectLanguage(t)
);
```

#### `buildKeyPointsPrompt(provider, article, settings, detectContentType, detectLanguage)`

Costruisce un prompt per l'estrazione punti chiave.

**Parametri**: Come `buildPrompt()`

**Restituisce**: Come `buildPrompt()`

#### `formatArticleForPrompt(article)`

Formatta un articolo per l'inclusione in un prompt.

**Parametri**:
- `article` (object): Oggetto articolo

**Restituisce**: `string` - Testo articolo formattato con paragrafi numerati

---

## API Integrazione AI

### Completion client

**Posizione**: `src/utils/ai/completion-client.js`

Usato dalle pagine dell'estensione per le chiamate LLM dirette. Le pagine non leggono mai la API key: la chiamata è delegata al service worker.

#### `requestCompletion(provider, systemPrompt, userPrompt, options?)`

Invia un prompt e riceve il testo del completamento.

**Parametri**:
- `provider` (string): Nome provider
- `systemPrompt` (string): System prompt
- `userPrompt` (string): User prompt
- `options` (object, opzionale): `temperature` (number), `maxTokens` (number), `responseFormat` (`'json'`). Le altre chiavi vengono ignorate dal service worker

**Restituisce**: `Promise<string>` - Testo del completamento

**Lancia**: `Error` con messaggio per l'utente quando il service worker segnala un fallimento

**Esempio**:
```javascript
const text = await requestCompletion('groq', systemPrompt, userPrompt, {
  temperature: 0.2,
  responseFormat: 'json'
});
```

La funzione invia il messaggio `generateCompletion` (vedi [Protocollo Messaggi](#protocollo-messaggi)). Non c'è retry automatico, non c'è fallback su un altro provider e non c'è rate limiter lato client: ogni chiamata è un singolo tentativo con timeout di 60 secondi.

---

### ErrorHandler

**Posizione**: `src/utils/core/error-handler.js`

#### `getErrorMessage(error)`

Converte un errore tecnico in un messaggio per l'utente nella lingua d'interfaccia corrente. Idempotente: un messaggio già mappato (in qualunque lingua) viene riconosciuto e ri-renderizzato nella lingua corrente. Serve perché il service worker invia alle pagine messaggi già mappati.

**Restituisce**: `string`

#### `classifyError(error)`

Restituisce il tipo di errore, conservato per i messaggi già mappati.

**Restituisce**: `'missing_key' | 'unsupported_page' | 'page_unreachable' | 'generic'`

---

## API Storage

### StorageManager

**Posizione**: `src/utils/storage/storage-manager.js`

Gestisce tutte le operazioni di storage del browser (`browser.storage.local`). Le API key sono memorizzate in chiaro.

#### API Keys

##### `saveApiKey(provider, apiKey)`

Salva una API key per un provider.

**Parametri**:
- `provider` (string): Nome provider
- `apiKey` (string): API key da salvare

**Restituisce**: `Promise<void>`

**Esempio**:
```javascript
await StorageManager.saveApiKey('groq', 'gsk_...');
```

##### `getApiKey(provider)`

Ottiene una API key per un provider.

**Parametri**:
- `provider` (string): Nome provider

**Restituisce**: `Promise<string|null>` - API key o null se non trovata

**Lancia**: `Error` se la chiave è in formato legacy v1.x

**Esempio**:
```javascript
const apiKey = await StorageManager.getApiKey('groq');
```

#### Impostazioni

##### `saveSettings(settings)`

Salva impostazioni utente.

**Parametri**:
- `settings` (object): Oggetto impostazioni

**Restituisce**: `Promise<void>`

##### `getSettings()`

Ottiene impostazioni utente.

**Restituisce**: `Promise<object>` - Oggetto impostazioni con valori predefiniti

**Impostazioni Predefinite**:
```javascript
{
  selectedProvider: 'groq',
  contentType: 'auto',
  summaryLength: 'medium',
  tone: 'neutral',
  saveHistory: true
}
```

#### Lingua

##### `saveSelectedLanguage(language)`

Salva lingua output selezionata per AI.

**Parametri**:
- `language` (string): Codice lingua (`'it'`, `'en'`, ecc.)

**Restituisce**: `Promise<void>`

##### `getSelectedLanguage()`

Ottiene lingua output selezionata.

**Restituisce**: `Promise<string>` - Codice lingua (default: `'it'`)

##### `saveUILanguage(language)`

Salva preferenza lingua UI.

**Parametri**:
- `language` (string): Codice lingua

**Restituisce**: `Promise<void>`

##### `getUILanguage()`

Ottiene preferenza lingua UI.

**Restituisce**: `Promise<string>` - Codice lingua (default: `'it'`)

#### Statistiche

##### `updateStats(provider, wordCount, generationTime)`

Aggiorna statistiche utilizzo (non critico, non lancia errori).

**Parametri**:
- `provider` (string): Provider usato
- `wordCount` (number): Numero di parole elaborate
- `generationTime` (number): Tempo impiegato in millisecondi

**Restituisce**: `Promise<void>`

---

### CacheManager

**Posizione**: `src/utils/storage/cache-manager.js`

Gestisce caching risposte con TTL.

#### `get(key)`

Ottiene una risposta in cache.

**Parametri**:
- `key` (string): Chiave cache

**Restituisce**: `Promise<object|null>` - Dati in cache o null se non trovati/scaduti

**Esempio**:
```javascript
const cacheManager = new CacheManager();
const cached = await cacheManager.get('https://example.com_groq_it_news');
```

#### `set(key, data, ttl?)`

Memorizza una risposta in cache.

**Parametri**:
- `key` (string): Chiave cache
- `data` (any): Dati da cachare
- `ttl` (number, opzionale): Time to live in millisecondi (default: 24 ore)

**Restituisce**: `Promise<void>`

**Esempio**:
```javascript
await cacheManager.set(
  'https://example.com_groq_it_news',
  { summary, keyPoints },
  24 * 60 * 60 * 1000
);
```

#### `clear()`

Pulisce tutte le entry cache.

**Restituisce**: `Promise<void>`

#### `getStats()`

Ottiene statistiche cache.

**Restituisce**: `Promise<object>` con:
- `totalEntries` (number): Entry totali in cache
- `totalSize` (string): Dimensione totale cache
- `hitRate` (number): Percentuale hit rate cache
- `oldestEntry` (string): Età entry più vecchia

---

### HistoryManager

**Posizione**: `src/utils/storage/history-manager.js`

Gestisce storico analisi per articoli, PDF e multi-analisi.

#### Storico Articoli

##### `saveSummary(article, summary, keyPoints, metadata)`

Salva un'analisi articolo nello storico.

**Parametri**:
- `article` (object): Oggetto articolo
- `summary` (string): Riassunto generato
- `keyPoints` (array): Array punti chiave
- `metadata` (object): Metadata analisi (provider, lingua, ecc.)

**Restituisce**: `Promise<string>` - ID entry

**Esempio**:
```javascript
const entryId = await HistoryManager.saveSummary(
  article,
  summary,
  keyPoints,
  { provider: 'groq', language: 'it', contentType: 'news' }
);
```

##### `getHistory()`

Ottiene tutte le entry storico articoli.

**Restituisce**: `Promise<array>` - Array entry storico, ordinate per data (più recenti prima)

##### `getSummaryById(id)`

Ottiene una specifica entry storico per ID.

**Parametri**:
- `id` (string): ID entry

**Restituisce**: `Promise<object|null>` - Entry storico o null se non trovata

##### `deleteSummary(id)`

Elimina una entry storico.

**Parametri**:
- `id` (string): ID entry

**Restituisce**: `Promise<void>`

##### `toggleFavorite(entryId)`

Attiva/disattiva stato preferito di una entry.

**Parametri**:
- `entryId` (string): ID entry

**Restituisce**: `Promise<void>`

##### `clearHistory()`

Pulisce tutto lo storico articoli.

**Restituisce**: `Promise<void>`

##### `searchHistory(query, options?)`

Cerca entry storico.

**Parametri**:
- `query` (string): Query ricerca
- `options` (object, opzionale):
  - `fields` (array): Campi in cui cercare (default: `['title', 'summary']`)
  - `caseSensitive` (boolean): Ricerca case-sensitive (default: false)

**Restituisce**: `Promise<array>` - Entry storico corrispondenti

**Esempio**:
```javascript
const results = await HistoryManager.searchHistory('cambiamento climatico', {
  fields: ['title', 'summary', 'keyPoints'],
  caseSensitive: false
});
```

##### `filterHistory(filters)`

Filtra entry storico.

**Parametri**:
- `filters` (object):
  - `provider` (string, opzionale): Filtra per provider
  - `language` (string, opzionale): Filtra per lingua
  - `contentType` (string, opzionale): Filtra per tipo contenuto
  - `favorite` (boolean, opzionale): Filtra solo preferiti
  - `dateFrom` (number, opzionale): Filtra da timestamp
  - `dateTo` (number, opzionale): Filtra a timestamp

**Restituisce**: `Promise<array>` - Entry storico filtrate

**Esempio**:
```javascript
const filtered = await HistoryManager.filterHistory({
  provider: 'groq',
  language: 'it',
  favorite: true,
  dateFrom: Date.now() - 7 * 24 * 60 * 60 * 1000 // Ultimi 7 giorni
});
```

#### Storico PDF

##### `savePDFAnalysis(pdfInfo, summary, keyPoints, metadata)`

Salva un'analisi PDF nello storico.

**Parametri**: Simili a `saveSummary()` ma con info specifiche PDF

**Restituisce**: `Promise<string>` - ID entry

##### `getPDFHistory()`

Ottiene tutte le entry storico PDF.

**Restituisce**: `Promise<array>` - Array entry storico PDF

##### `getPDFById(id)`

Ottiene una specifica entry PDF per ID.

**Parametri**:
- `id` (string): ID entry

**Restituisce**: `Promise<object|null>` - Entry PDF o null

##### `importPDFAnalysis(backupEntry)`

Ripristina un'analisi PDF da un backup mantenendo `id` e `timestamp` originali, così reimportare lo stesso file non crea duplicati.

**Parametri**:
- `backupEntry` (object): Voce di `data.pdfAnalysis` di un file di backup

**Restituisce**: `Promise<string|null>` - Id salvato, oppure `null` se l'id era già presente o la voce è stata tagliata dal limite dello storico

#### `deletePDF(id)`

Elimina una entry PDF.

**Parametri**:
- `id` (string): ID entry

**Restituisce**: `Promise<void>`

#### Storico Multi-Analisi

##### `saveMultiAnalysis(analysis, articles)`

Salva un'analisi multi-articolo nello storico.

**Parametri**:
- `analysis` (object): Risultato analisi
- `articles` (array): Array oggetti articolo

**Restituisce**: `Promise<string>` - ID entry

##### `getMultiAnalysisHistory()`

Ottiene tutte le entry storico multi-analisi.

**Restituisce**: `Promise<array>` - Array entry multi-analisi

##### `getMultiAnalysisById(id)`

Ottiene una specifica entry multi-analisi per ID.

**Parametri**:
- `id` (string): ID entry

**Restituisce**: `Promise<object|null>` - Entry multi-analisi o null

##### `deleteMultiAnalysis(id)`

Elimina una entry multi-analisi.

**Parametri**:
- `id` (string): ID entry

**Restituisce**: `Promise<void>`

---

### Ripristino dati compressi

**Posizione**: `src/utils/storage/compressed-data-recovery.js`

Le versioni precedenti comprimevano riassunti dello storico e voci di cache. La compressione non esiste più; questo modulo ripara i dati che ha lasciato.

#### `restoreCompressedData(storage?)`

Decodifica (LZ-String) i riassunti compressi dello storico e scarta le voci di cache compresse, riscrivendo solo ciò che è cambiato. Chiamata da `AutoMaintenance.initialize()` a ogni avvio del service worker, indipendentemente da `autoCleanup`.

**Parametri**:
- `storage` (object, opzionale): Area di storage (predefinita `browser.storage.local`)

**Restituisce**: `Promise<object>` con:
- `historyRestored` (number): Riassunti ripristinati
- `historyUnreadable` (number): Voci non decodificabili (lasciate intatte)
- `cacheDropped` (number): Voci di cache scartate

---

### AutoMaintenance

**Posizione**: `src/utils/core/auto-maintenance.js`

Manutenzione in background schedulata con `browser.alarms`.

#### `initialize()`

Esegue `restoreCompressedData`, poi schedula la manutenzione. Se `autoCleanup` è attivo, ogni 24 ore rimuove le voci di cache scadute, mantiene la cache a 100 voci (LRU) ed elimina i riassunti più vecchi di 180 giorni. I preferiti non vengono mai eliminati.

---

## API Sicurezza

### HtmlSanitizer

**Posizione**: `src/utils/security/html-sanitizer.js`

Previene XSS sanitizzando contenuto prima dell'inserimento DOM.

#### `escape(str)`

Escapa caratteri speciali HTML.

**Parametri**:
- `str` (string): Stringa da escapare

**Restituisce**: `string` - Stringa escapata

**Esempio**:
```javascript
const safe = HtmlSanitizer.escape('<script>alert("XSS")</script>');
// Restituisce: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
```

#### `renderText(text, element)`

Renderizza in modo sicuro contenuto testuale in un elemento DOM.

**Parametri**:
- `text` (string): Testo da renderizzare
- `element` (HTMLElement): Elemento target

**Restituisce**: `void`

**Esempio**:
```javascript
HtmlSanitizer.renderText(aiResponse, document.getElementById('summary'));
```

#### `renderList(items, element, options?)`

Renderizza in modo sicuro una lista di elementi.

**Parametri**:
- `items` (array): Array di oggetti
- `element` (HTMLElement): Elemento target
- `options` (object, opzionale):
  - `titleKey` (string): Chiave per titolo (default: `'title'`)
  - `descKey` (string): Chiave per descrizione (default: `'description'`)
  - `ordered` (boolean): Usa lista ordinata (default: false)

**Restituisce**: `void`

**Esempio**:
```javascript
HtmlSanitizer.renderList(
  keyPoints,
  document.getElementById('keypoints'),
  { titleKey: 'title', descKey: 'description', ordered: true }
);
```

---

### InputSanitizer

**Posizione**: `src/utils/security/input-sanitizer.js`

Pulisce e valida testo prima dell'invio alle API AI.

#### `sanitizeForAI(text, options?)`

Sanitizza testo per invio API AI.

**Parametri**:
- `text` (string): Testo da sanitizzare
- `options` (object, opzionale):
  - `maxLength` (number): Lunghezza massima (default: 10000)
  - `minLength` (number): Lunghezza minima (default: 10)
  - `removeHTML` (boolean): Rimuovi tag HTML (default: true)
  - `removeURLs` (boolean): Rimuovi URL (default: false)
  - `preserveNewlines` (boolean): Preserva newline (default: true)
  - `removeCitations` (boolean): Rimuovi citazioni (default: false)

**Restituisce**: `string` - Testo sanitizzato

**Lancia**: `Error` se il testo è invalido o troppo corto/lungo

**Esempio**:
```javascript
const clean = InputSanitizer.sanitizeForAI(userInput, {
  maxLength: 5000,
  removeHTML: true,
  removeURLs: true
});
```

---

## API Export

### PDFExporter

**Posizione**: `src/utils/export/pdf-exporter.js`

Genera documenti PDF formattati.

#### `exportToPDF(article, summary, keyPoints, metadata, translation?, qaList?, citations?)`

Esporta analisi in PDF.

**Parametri**:
- `article` (object): Oggetto articolo
- `summary` (string): Testo riassunto
- `keyPoints` (array): Array punti chiave
- `metadata` (object): Metadata analisi
- `translation` (string, opzionale): Testo tradotto
- `qaList` (array, opzionale): Lista Q&A
- `citations` (object, opzionale): Oggetto citazioni

**Restituisce**: `void` (attiva download)

**Esempio**:
```javascript
PDFExporter.exportToPDF(
  article,
  summary,
  keyPoints,
  { provider: 'groq', language: 'it' },
  translation,
  qaList,
  citations
);
```

---

### MarkdownExporter

**Posizione**: `src/utils/export/markdown-exporter.js`

Esporta analisi in formato Markdown.

#### `exportToMarkdown(article, summary, keyPoints, metadata, translation?, qaList?, citations?)`

Esporta analisi in Markdown.

**Parametri**: Come `PDFExporter.exportToPDF()`

**Restituisce**: `string` - Testo formattato Markdown

**Esempio**:
```javascript
const markdown = MarkdownExporter.exportToMarkdown(
  article,
  summary,
  keyPoints,
  metadata
);
```

---

### EmailManager

**Posizione**: `src/utils/export/email-manager.js`

Costruisce il contenuto dell'email e apre il client di posta.

#### `formatEmailContent(article, summary, keyPoints, translation?, qaList?, citations?)`

Costruisce oggetto e corpo nella lingua d'interfaccia.

**Restituisce**: `{ subject: string, body: string }`

#### `openEmailClient(recipientEmail, subject, body)`

Apre una bozza `mailto:` indirizzata a un destinatario validato. Lancia un errore se l'indirizzo non è valido.

**Restituisce**: `void`

#### `openEmailDraft(subject, body)`

Apre una bozza `mailto:` senza destinatario; lo sceglie l'utente nel client di posta. Usata dall'analisi multi-articolo.

**Restituisce**: `void`

**Esempio**:
```javascript
const { subject, body } = EmailManager.formatEmailContent(article, summary, keyPoints);
EmailManager.openEmailDraft(subject, body);
```

---

### Etichette dei documenti

**Posizione**: `src/utils/export/doc-labels.js`

I documenti esportati (Markdown, PDF, email, bibliografia, testo copiato, lettura vocale) sono scritti nella lingua d'interfaccia.

- `docLabel(key, vars?)`: etichetta per un documento esportato
- `docHeading(key, vars?)`: la stessa etichetta in maiuscolo
- `docDate(date)`: data formattata per la lingua d'interfaccia
- `citationTypeLabel(type)`: etichetta di un tipo di citazione, `other` se sconosciuto

---

## API Utility

### I18n

**Posizione**: `src/utils/i18n/i18n.js`

Sistema internazionalizzazione.

#### `init()`

Inizializza sistema i18n.

**Restituisce**: `Promise<void>`

#### `setLanguage(lang)`

Cambia lingua UI.

**Parametri**:
- `lang` (string): Codice lingua

**Restituisce**: `Promise<void>`

**Esempio**:
```javascript
await I18n.setLanguage('it');
```

#### `t(key)`

Ottiene traduzione per una chiave.

**Parametri**:
- `key` (string): Chiave traduzione

**Restituisce**: `string` - Testo tradotto

**Esempio**:
```javascript
const text = I18n.t('analyze_button');
// Restituisce: 'Analizza' (se lingua è 'it')
```

#### `tf(key, replacements)`

Ottiene traduzione con sostituzione placeholder.

**Parametri**:
- `key` (string): Chiave traduzione
- `replacements` (object): Valori placeholder

**Restituisce**: `string` - Testo tradotto con sostituzioni

**Esempio**:
```javascript
const text = I18n.tf('greeting', { name: 'Andrea' });
// Restituisce: 'Ciao, Andrea!' (se lingua è 'it')
```

#### `updateUI()`

Aggiorna tutti gli elementi UI con lingua corrente.

**Restituisce**: `void`

---

### Logger

**Posizione**: `src/utils/core/logger.js`

Sistema logging strutturato.

#### `info(message, ...args)`

Logga messaggio info.

**Parametri**:
- `message` (string): Messaggio log
- `...args` (any): Argomenti aggiuntivi

**Restituisce**: `void`

**Esempio**:
```javascript
Logger.info('Analisi completata', { provider: 'groq', time: 1234 });
```

#### `warn(message, ...args)`

Logga messaggio warning.

**Parametri**: Come `info()`

**Restituisce**: `void`

#### `error(message, ...args)`

Logga messaggio errore.

**Parametri**: Come `info()`

**Restituisce**: `void`

---

### VoiceController

**Posizione**: `src/utils/voice/voice-controller.js`

Coordina Text-to-Speech e Speech-to-Text.

#### `initialize()`

Inizializza controller vocale.

**Restituisce**: `Promise<void>`

#### `speak(text, lang?)`

Pronuncia testo ad alta voce.

**Parametri**:
- `text` (string): Testo da pronunciare
- `lang` (string, opzionale): Codice lingua (default: `'it-IT'`)

**Restituisce**: `void`

**Esempio**:
```javascript
const voiceController = new VoiceController();
await voiceController.initialize();
voiceController.speak('Ciao, mondo!', 'it-IT');
```

#### `stopSpeaking()`

Ferma pronuncia.

**Restituisce**: `void`

#### `startListening(lang?)`

Avvia riconoscimento vocale.

**Parametri**:
- `lang` (string, opzionale): Codice lingua (default: `'it-IT'`)

**Restituisce**: `Promise<string>` - Testo trascritto

**Esempio**:
```javascript
const transcript = await voiceController.startListening('it-IT');
console.log('Hai detto:', transcript);
```

#### `stopListening()`

Ferma riconoscimento vocale.

**Restituisce**: `void`

---

## Protocollo Messaggi

### Messaggi Service Worker

L'estensione usa l'API di message passing delle WebExtensions (`browser.runtime`) per la comunicazione tra componenti.

#### Formato Messaggio

```javascript
{
  action: string,      // Tipo azione
  ...params           // Parametri specifici azione
}
```

#### Formato Risposta

```javascript
{
  success: boolean,    // Successo operazione
  result?: any,       // Dati risultato (se successo)
  error?: string      // Messaggio errore (se fallimento)
}
```

#### Azioni Supportate

##### `generateSummary`

Genera riassunto articolo.

**Richiesta**:
```javascript
{
  action: 'generateSummary',
  article: object,
  provider: string,
  settings: object
}
```

**Risposta**:
```javascript
{
  success: true,
  result: {
    summary: string,
    keyPoints: array,
    metadata: object
  }
}
```

##### `extractCitations`

Estrae citazioni da articolo.

**Richiesta**:
```javascript
{
  action: 'extractCitations',
  article: object,
  provider: string,
  settings: object
}
```

**Risposta**:
```javascript
{
  success: true,
  result: {
    citations: array,
    metadata: object
  }
}
```

##### `translateArticle`

Traduce articolo.

**Richiesta**:
```javascript
{
  action: 'translateArticle',
  article: object,
  provider: string,
  targetLanguage: string,
  settings: object
}
```

**Risposta**:
```javascript
{
  success: true,
  result: {
    translation: string,
    metadata: object
  }
}
```

##### `generateCompletion`

Esegue un completamento LLM per una pagina dell'estensione. La API key la legge il service worker, mai la pagina. Accettata solo dalle pagine dell'estensione: il router verifica che `sender.url` inizi con `browser.runtime.getURL('')`, quindi i content script vengono ignorati.

**Richiesta**:
```javascript
{
  action: 'generateCompletion',
  provider: string,
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number,
    maxTokens?: number,
    responseFormat?: 'json'
  }
}
```

Vengono inoltrate solo queste tre opzioni; ogni altra chiave viene scartata.

**Risposta**:
```javascript
{
  success: true,
  result: string    // testo del completamento
}
```

##### `testApiKey`

Testa validità API key.

**Richiesta**:
```javascript
{
  action: 'testApiKey',
  provider: string,
  apiKey: string
}
```

**Risposta**:
```javascript
{
  success: true
}
```

#### Esempio Utilizzo

```javascript
// Invia messaggio da popup a service worker
const response = await browser.runtime.sendMessage({
  action: 'generateSummary',
  article: extractedArticle,
  provider: 'groq',
  settings: userSettings
});
if (response.success) {
  console.log('Riassunto:', response.result.summary);
} else {
  console.error('Errore:', response.error);
}
```

---

## Gestione Errori

### Tipi di Errore

Tutte le API lanciano oggetti `Error` JavaScript standard con messaggi descrittivi.

### Messaggi Errore Comuni

- `"Provider non valido: {provider}"` - Nome provider invalido
- `"API key non configurata per {provider}"` - API key non configurata
- `"Timeout: il provider non ha risposto"` - Timeout API
- `"[RATE_LIMIT:{provider}]"` - Rate limit superato
- `"Testo troppo corto (minimo {min} caratteri)"` - Input troppo corto
- `"File troppo grande. Massimo 20MB."` - File troppo grande

### Best Practice Gestione Errori

```javascript
try {
  const result = await APIOrchestrator.callAPI(provider, apiKey, article, settings);
  // Gestisci successo
} catch (error) {
  if (error.message.includes('RATE_LIMIT')) {
    // Gestisci rate limit
  } else if (error.message.includes('Timeout')) {
    // Gestisci timeout
  } else {
    // Gestisci errore generico
  }
}
```

---

## Versioning

Questo riferimento API è per la versione **2.2.0** dell'estensione Web Article Summarizer.

### Changelog

Vedi [CHANGELOG.md](../../CHANGELOG.md) per storico versioni e breaking changes.

---

## Contribuire

Vedi [CONTRIBUTING.md](CONTRIBUTING.md) per linee guida su come contribuire all'API.

---

## Licenza

Apache License 2.0 - Vedi [LICENSE](../../LICENSE) per dettagli.
