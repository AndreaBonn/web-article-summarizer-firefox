# API Reference

<p align="right">
  <a href="API.it.md">🇮🇹 Italiano</a> · <strong>🇺🇸 English</strong>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Core APIs](#core-apis)
- [AI Integration APIs](#ai-integration-apis)
- [Storage APIs](#storage-apis)
- [Security APIs](#security-apis)
- [Export APIs](#export-apis)
- [Utility APIs](#utility-apis)
- [Message Protocol](#message-protocol)

---

## Overview

This document provides a comprehensive reference for all public APIs in the Web Article Summarizer extension. These APIs are designed for internal use within the extension but can also serve as a guide for contributors and developers extending the functionality.

### API Conventions

- All async functions return Promises
- Errors are thrown as Error objects with descriptive messages
- Optional parameters are marked with `?`
- Type annotations follow JSDoc conventions

---

## Core APIs

### APIOrchestrator

**Location**: `src/utils/ai/api-orchestrator.js`

Central coordinator for all AI provider interactions.

#### `generateCompletion(provider, apiKey, systemPrompt, userPrompt, options?)`

Generate a completion from an AI provider.

**Parameters**:
- `provider` (string): Provider name (`'groq'`, `'openai'`, `'anthropic'`, `'gemini'`)
- `apiKey` (string): API key for the provider
- `systemPrompt` (string): System prompt defining AI behavior
- `userPrompt` (string): User prompt with the actual request
- `options` (object, optional):
  - `temperature` (number): Sampling temperature (0-1, default: 0.3)
  - `maxTokens` (number): Maximum tokens in response (default: 4096)
  - `model` (string): Specific model to use (defaults to provider's default)
  - `responseFormat` (string): Response format (`'json'` or `null`)

**Returns**: `Promise<string>` - The AI-generated text response

**Throws**: `Error` if provider is unsupported or API call fails

**Example**:
```javascript
const response = await APIOrchestrator.generateCompletion(
  'groq',
  'gsk_...',
  'You are a helpful assistant.',
  'Summarize this article: ...',
  { temperature: 0.3, maxTokens: 2000 }
);
```

#### `callAPI(provider, apiKey, article, settings)`

High-level API for article summarization.

**Parameters**:
- `provider` (string): Provider name
- `apiKey` (string): API key
- `article` (object): Article object with `title`, `content`, `paragraphs`, etc.
- `settings` (object): Settings object with `language`, `contentType`, `summaryLength`, etc.

**Returns**: `Promise<string>` - Raw AI response text

**Example**:
```javascript
const response = await APIOrchestrator.callAPI(
  'openai',
  apiKey,
  article,
  { language: 'en', contentType: 'news', summaryLength: 'medium' }
);
```

#### `extractKeyPoints(provider, apiKey, article, settings)`

Extract key points from an article.

**Parameters**: Same as `callAPI()`

**Returns**: `Promise<string>` - Raw AI response with key points

#### `parseResponse(responseText)`

Parse AI response into structured format.

**Parameters**:
- `responseText` (string): Raw AI response

**Returns**: `object` with:
- `summary` (string): Extracted summary
- `keyPoints` (array): Array of key point objects

**Example**:
```javascript
const { summary, keyPoints } = APIOrchestrator.parseResponse(response);
```

---

### ContentDetector

**Location**: `src/utils/ai/content-detector.js`

Analyzes article content to detect type and language.

#### `detectContentType(article)`

Detect the type of content in an article.

**Parameters**:
- `article` (object): Article object with `title` and `content`

**Returns**: `string` - Content type (`'scientific'`, `'news'`, `'tutorial'`, `'business'`, `'opinion'`, `'general'`)

**Algorithm**: Scoring-based detection analyzing keywords, patterns, and structure

**Example**:
```javascript
const contentType = ContentDetector.detectContentType(article);
// Returns: 'scientific'
```

#### `detectLanguage(text)`

Detect the language of a text.

**Parameters**:
- `text` (string): Text to analyze

**Returns**: `string` - Language code (`'it'`, `'en'`, `'es'`, `'fr'`, `'de'`)

**Algorithm**: Pattern matching on common words

**Example**:
```javascript
const language = ContentDetector.detectLanguage(article.content);
// Returns: 'en'
```

---

### PromptBuilder

**Location**: `src/utils/ai/prompt-builder.js`

Constructs optimized prompts for AI providers.

#### `buildPrompt(provider, article, settings, detectContentType, detectLanguage)`

Build a complete prompt for article summarization.

**Parameters**:
- `provider` (string): Provider name
- `article` (object): Article object
- `settings` (object): Settings object
- `detectContentType` (function): Content type detector function
- `detectLanguage` (function): Language detector function

**Returns**: `object` with:
- `systemPrompt` (string): System prompt
- `userPrompt` (string): User prompt

**Example**:
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

Build a prompt for key points extraction.

**Parameters**: Same as `buildPrompt()`

**Returns**: Same as `buildPrompt()`

#### `formatArticleForPrompt(article)`

Format an article for inclusion in a prompt.

**Parameters**:
- `article` (object): Article object

**Returns**: `string` - Formatted article text with numbered paragraphs

---

## AI Integration APIs

### Completion client

**Location**: `src/utils/ai/completion-client.js`

Used by extension pages for raw LLM calls. Pages never read the API key: the call is delegated to the service worker.

#### `requestCompletion(provider, systemPrompt, userPrompt, options?)`

Send one prompt and receive the completion text.

**Parameters**:
- `provider` (string): Provider name
- `systemPrompt` (string): System prompt
- `userPrompt` (string): User prompt
- `options` (object, optional): `temperature` (number), `maxTokens` (number), `responseFormat` (`'json'`). Other keys are ignored by the service worker

**Returns**: `Promise<string>` - Completion text

**Throws**: `Error` with a user-facing message when the service worker reports a failure

**Example**:
```javascript
const text = await requestCompletion('groq', systemPrompt, userPrompt, {
  temperature: 0.2,
  responseFormat: 'json'
});
```

The function sends the `generateCompletion` message (see [Message Protocol](#message-protocol)). There is no automatic retry, no fallback to another provider and no client-side rate limiter: each call is a single attempt with a 60-second timeout.

---

### ErrorHandler

**Location**: `src/utils/core/error-handler.js`

#### `getErrorMessage(error)`

Convert a technical error into a user-facing message in the current interface language. Idempotent: a message that is already mapped (in any language) is recognized and rendered again in the current language. This is needed because the service worker sends already-mapped messages to the pages.

**Returns**: `string`

#### `classifyError(error)`

Return the error kind, preserved for already-mapped messages.

**Returns**: `'missing_key' | 'unsupported_page' | 'page_unreachable' | 'generic'`

---

## Storage APIs

### StorageManager

**Location**: `src/utils/storage/storage-manager.js`

Manages all browser storage operations (`browser.storage.local`). API keys are stored in plain text.

#### API Keys

##### `saveApiKey(provider, apiKey)`

Save an API key for a provider.

**Parameters**:
- `provider` (string): Provider name
- `apiKey` (string): API key to save

**Returns**: `Promise<void>`

**Example**:
```javascript
await StorageManager.saveApiKey('groq', 'gsk_...');
```

##### `getApiKey(provider)`

Get an API key for a provider.

**Parameters**:
- `provider` (string): Provider name

**Returns**: `Promise<string|null>` - API key or null if not found

**Throws**: `Error` if key is in legacy v1.x format

**Example**:
```javascript
const apiKey = await StorageManager.getApiKey('groq');
```

#### Settings

##### `saveSettings(settings)`

Save user settings.

**Parameters**:
- `settings` (object): Settings object

**Returns**: `Promise<void>`

##### `getSettings()`

Get user settings.

**Returns**: `Promise<object>` - Settings object with defaults

**Default Settings**:
```javascript
{
  selectedProvider: 'groq',
  contentType: 'auto',
  summaryLength: 'medium',
  tone: 'neutral',
  saveHistory: true
}
```

#### Language

##### `saveSelectedLanguage(language)`

Save selected output language for AI.

**Parameters**:
- `language` (string): Language code (`'it'`, `'en'`, etc.)

**Returns**: `Promise<void>`

##### `getSelectedLanguage()`

Get selected output language.

**Returns**: `Promise<string>` - Language code (default: `'it'`)

##### `saveUILanguage(language)`

Save UI language preference.

**Parameters**:
- `language` (string): Language code

**Returns**: `Promise<void>`

##### `getUILanguage()`

Get UI language preference.

**Returns**: `Promise<string>` - Language code (default: `'it'`)

#### Statistics

##### `updateStats(provider, wordCount, generationTime)`

Update usage statistics (non-critical, won't throw errors).

**Parameters**:
- `provider` (string): Provider used
- `wordCount` (number): Number of words processed
- `generationTime` (number): Time taken in milliseconds

**Returns**: `Promise<void>`

---

### CacheManager

**Location**: `src/utils/storage/cache-manager.js`

Manages response caching with TTL.

#### `get(key)`

Get a cached response.

**Parameters**:
- `key` (string): Cache key

**Returns**: `Promise<object|null>` - Cached data or null if not found/expired

**Example**:
```javascript
const cacheManager = new CacheManager();
const cached = await cacheManager.get('https://example.com_groq_en_news');
```

#### `set(key, data, ttl?)`

Store a response in cache.

**Parameters**:
- `key` (string): Cache key
- `data` (any): Data to cache
- `ttl` (number, optional): Time to live in milliseconds (default: 24 hours)

**Returns**: `Promise<void>`

**Example**:
```javascript
await cacheManager.set(
  'https://example.com_groq_en_news',
  { summary, keyPoints },
  24 * 60 * 60 * 1000
);
```

#### `clear()`

Clear all cache entries.

**Returns**: `Promise<void>`

#### `getStats()`

Get cache statistics.

**Returns**: `Promise<object>` with:
- `totalEntries` (number): Total cached entries
- `totalSize` (string): Total cache size
- `hitRate` (number): Cache hit rate percentage
- `oldestEntry` (string): Age of oldest entry

---

### HistoryManager

**Location**: `src/utils/storage/history-manager.js`

Manages analysis history for articles, PDFs, and multi-analyses.

#### Article History

##### `saveSummary(article, summary, keyPoints, metadata)`

Save an article analysis to history.

**Parameters**:
- `article` (object): Article object
- `summary` (string): Generated summary
- `keyPoints` (array): Array of key points
- `metadata` (object): Analysis metadata (provider, language, etc.)

**Returns**: `Promise<string>` - Entry ID

**Example**:
```javascript
const entryId = await HistoryManager.saveSummary(
  article,
  summary,
  keyPoints,
  { provider: 'groq', language: 'en', contentType: 'news' }
);
```

##### `getHistory()`

Get all article history entries.

**Returns**: `Promise<array>` - Array of history entries, sorted by date (newest first)

##### `getSummaryById(id)`

Get a specific history entry by ID.

**Parameters**:
- `id` (string): Entry ID

**Returns**: `Promise<object|null>` - History entry or null if not found

##### `deleteSummary(id)`

Delete a history entry.

**Parameters**:
- `id` (string): Entry ID

**Returns**: `Promise<void>`

##### `toggleFavorite(entryId)`

Toggle favorite status of an entry.

**Parameters**:
- `entryId` (string): Entry ID

**Returns**: `Promise<void>`

##### `clearHistory()`

Clear all article history.

**Returns**: `Promise<void>`

##### `searchHistory(query, options?)`

Search history entries.

**Parameters**:
- `query` (string): Search query
- `options` (object, optional):
  - `fields` (array): Fields to search in (default: `['title', 'summary']`)
  - `caseSensitive` (boolean): Case-sensitive search (default: false)

**Returns**: `Promise<array>` - Matching history entries

**Example**:
```javascript
const results = await HistoryManager.searchHistory('climate change', {
  fields: ['title', 'summary', 'keyPoints'],
  caseSensitive: false
});
```

##### `filterHistory(filters)`

Filter history entries.

**Parameters**:
- `filters` (object):
  - `provider` (string, optional): Filter by provider
  - `language` (string, optional): Filter by language
  - `contentType` (string, optional): Filter by content type
  - `favorite` (boolean, optional): Filter favorites only
  - `dateFrom` (number, optional): Filter from timestamp
  - `dateTo` (number, optional): Filter to timestamp

**Returns**: `Promise<array>` - Filtered history entries

**Example**:
```javascript
const filtered = await HistoryManager.filterHistory({
  provider: 'groq',
  language: 'en',
  favorite: true,
  dateFrom: Date.now() - 7 * 24 * 60 * 60 * 1000 // Last 7 days
});
```

#### PDF History

##### `savePDFAnalysis(pdfInfo, summary, keyPoints, metadata)`

Save a PDF analysis to history.

**Parameters**: Similar to `saveSummary()` but with PDF-specific info

**Returns**: `Promise<string>` - Entry ID

##### `getPDFHistory()`

Get all PDF history entries.

**Returns**: `Promise<array>` - Array of PDF history entries

##### `getPDFById(id)`

Get a specific PDF entry by ID.

**Parameters**:
- `id` (string): Entry ID

**Returns**: `Promise<object|null>` - PDF entry or null

##### `importPDFAnalysis(backupEntry)`

Restore a PDF analysis from a backup, keeping its original `id` and `timestamp` so that importing the same file again creates no duplicates.

**Parameters**:
- `backupEntry` (object): Entry from `data.pdfAnalysis` of a backup file

**Returns**: `Promise<string|null>` - Stored id, or `null` when the id was already present or the entry was cut by the history limit

#### `deletePDF(id)`

Delete a PDF entry.

**Parameters**:
- `id` (string): Entry ID

**Returns**: `Promise<void>`

#### Multi-Analysis History

##### `saveMultiAnalysis(analysis, articles)`

Save a multi-article analysis to history.

**Parameters**:
- `analysis` (object): Analysis result
- `articles` (array): Array of article objects

**Returns**: `Promise<string>` - Entry ID

##### `getMultiAnalysisHistory()`

Get all multi-analysis history entries.

**Returns**: `Promise<array>` - Array of multi-analysis entries

##### `getMultiAnalysisById(id)`

Get a specific multi-analysis entry by ID.

**Parameters**:
- `id` (string): Entry ID

**Returns**: `Promise<object|null>` - Multi-analysis entry or null

##### `deleteMultiAnalysis(id)`

Delete a multi-analysis entry.

**Parameters**:
- `id` (string): Entry ID

**Returns**: `Promise<void>`

---

### Compressed data recovery

**Location**: `src/utils/storage/compressed-data-recovery.js`

Earlier versions compressed history summaries and cache entries. Compression no longer exists; this module repairs the data it left behind.

#### `restoreCompressedData(storage?)`

Decode (LZ-String) the compressed history summaries and discard the compressed cache entries, writing back only what changed. Called by `AutoMaintenance.initialize()` at every service worker start, regardless of `autoCleanup`.

**Parameters**:
- `storage` (object, optional): Storage area (default `browser.storage.local`)

**Returns**: `Promise<object>` with:
- `historyRestored` (number): Summaries restored
- `historyUnreadable` (number): Entries that could not be decoded (left untouched)
- `cacheDropped` (number): Cache entries discarded

---

### AutoMaintenance

**Location**: `src/utils/core/auto-maintenance.js`

Background maintenance scheduled with `browser.alarms`.

#### `initialize()`

Runs `restoreCompressedData`, then schedules maintenance. When `autoCleanup` is enabled, every 24 hours it removes expired cache entries, keeps the cache at 100 entries (LRU) and deletes summaries older than 180 days. Favorites are never deleted.

---

## Security APIs

### HtmlSanitizer

**Location**: `src/utils/security/html-sanitizer.js`

Prevents XSS by sanitizing content before DOM insertion.

#### `escape(str)`

Escape HTML special characters.

**Parameters**:
- `str` (string): String to escape

**Returns**: `string` - Escaped string

**Example**:
```javascript
const safe = HtmlSanitizer.escape('<script>alert("XSS")</script>');
// Returns: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
```

#### `renderText(text, element)`

Safely render text content in a DOM element.

**Parameters**:
- `text` (string): Text to render
- `element` (HTMLElement): Target element

**Returns**: `void`

**Example**:
```javascript
HtmlSanitizer.renderText(aiResponse, document.getElementById('summary'));
```

#### `renderList(items, element, options?)`

Safely render a list of items.

**Parameters**:
- `items` (array): Array of objects
- `element` (HTMLElement): Target element
- `options` (object, optional):
  - `titleKey` (string): Key for title (default: `'title'`)
  - `descKey` (string): Key for description (default: `'description'`)
  - `ordered` (boolean): Use ordered list (default: false)

**Returns**: `void`

**Example**:
```javascript
HtmlSanitizer.renderList(
  keyPoints,
  document.getElementById('keypoints'),
  { titleKey: 'title', descKey: 'description', ordered: true }
);
```

---

### InputSanitizer

**Location**: `src/utils/security/input-sanitizer.js`

Cleans and validates text before sending to AI APIs.

#### `sanitizeForAI(text, options?)`

Sanitize text for AI API submission.

**Parameters**:
- `text` (string): Text to sanitize
- `options` (object, optional):
  - `maxLength` (number): Maximum length (default: 10000)
  - `minLength` (number): Minimum length (default: 10)
  - `removeHTML` (boolean): Remove HTML tags (default: true)
  - `removeURLs` (boolean): Remove URLs (default: false)
  - `preserveNewlines` (boolean): Preserve newlines (default: true)
  - `removeCitations` (boolean): Remove citations (default: false)

**Returns**: `string` - Sanitized text

**Throws**: `Error` if text is invalid or too short/long

**Example**:
```javascript
const clean = InputSanitizer.sanitizeForAI(userInput, {
  maxLength: 5000,
  removeHTML: true,
  removeURLs: true
});
```

---

## Export APIs

### PDFExporter

**Location**: `src/utils/export/pdf-exporter.js`

Generates formatted PDF documents.

#### `exportToPDF(article, summary, keyPoints, metadata, translation?, qaList?, citations?)`

Export analysis to PDF.

**Parameters**:
- `article` (object): Article object
- `summary` (string): Summary text
- `keyPoints` (array): Key points array
- `metadata` (object): Analysis metadata
- `translation` (string, optional): Translated text
- `qaList` (array, optional): Q&A list
- `citations` (object, optional): Citations object

**Returns**: `void` (triggers download)

**Example**:
```javascript
PDFExporter.exportToPDF(
  article,
  summary,
  keyPoints,
  { provider: 'groq', language: 'en' },
  translation,
  qaList,
  citations
);
```

---

### MarkdownExporter

**Location**: `src/utils/export/markdown-exporter.js`

Exports analysis to Markdown format.

#### `exportToMarkdown(article, summary, keyPoints, metadata, translation?, qaList?, citations?)`

Export analysis to Markdown.

**Parameters**: Same as `PDFExporter.exportToPDF()`

**Returns**: `string` - Markdown formatted text

**Example**:
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

**Location**: `src/utils/export/email-manager.js`

Builds email content and opens the mail client.

#### `formatEmailContent(article, summary, keyPoints, translation?, qaList?, citations?)`

Build subject and body in the interface language.

**Returns**: `{ subject: string, body: string }`

#### `openEmailClient(recipientEmail, subject, body)`

Open a `mailto:` draft addressed to a validated recipient. Throws if the address is invalid.

**Returns**: `void`

#### `openEmailDraft(subject, body)`

Open a `mailto:` draft without a recipient; the user picks one in the mail client. Used by the multi-article analysis.

**Returns**: `void`

**Example**:
```javascript
const { subject, body } = EmailManager.formatEmailContent(article, summary, keyPoints);
EmailManager.openEmailDraft(subject, body);
```

---

### Document labels

**Location**: `src/utils/export/doc-labels.js`

Exported documents (Markdown, PDF, email, bibliography, copied text, voice reading) are written in the interface language.

- `docLabel(key, vars?)`: label for an exported document
- `docHeading(key, vars?)`: the same label in capitals
- `docDate(date)`: date formatted for the interface language
- `citationTypeLabel(type)`: label of a citation type, `other` when unknown

---

## Utility APIs

### I18n

**Location**: `src/utils/i18n/i18n.js`

Internationalization system.

#### `init()`

Initialize i18n system.

**Returns**: `Promise<void>`

#### `setLanguage(lang)`

Change UI language.

**Parameters**:
- `lang` (string): Language code

**Returns**: `Promise<void>`

**Example**:
```javascript
await I18n.setLanguage('en');
```

#### `t(key)`

Get translation for a key.

**Parameters**:
- `key` (string): Translation key

**Returns**: `string` - Translated text

**Example**:
```javascript
const text = I18n.t('analyze_button');
// Returns: 'Analyze' (if language is 'en')
```

#### `tf(key, replacements)`

Get translation with placeholder replacement.

**Parameters**:
- `key` (string): Translation key
- `replacements` (object): Placeholder values

**Returns**: `string` - Translated text with replacements

**Example**:
```javascript
const text = I18n.tf('greeting', { name: 'Andrea' });
// Returns: 'Hello, Andrea!' (if language is 'en')
```

#### `updateUI()`

Update all UI elements with current language.

**Returns**: `void`

---

### Logger

**Location**: `src/utils/core/logger.js`

Structured logging system.

#### `info(message, ...args)`

Log info message.

**Parameters**:
- `message` (string): Log message
- `...args` (any): Additional arguments

**Returns**: `void`

**Example**:
```javascript
Logger.info('Analysis completed', { provider: 'groq', time: 1234 });
```

#### `warn(message, ...args)`

Log warning message.

**Parameters**: Same as `info()`

**Returns**: `void`

#### `error(message, ...args)`

Log error message.

**Parameters**: Same as `info()`

**Returns**: `void`

---

### VoiceController

**Location**: `src/utils/voice/voice-controller.js`

Coordinates Text-to-Speech and Speech-to-Text.

#### `initialize()`

Initialize voice controller.

**Returns**: `Promise<void>`

#### `speak(text, lang?)`

Speak text aloud.

**Parameters**:
- `text` (string): Text to speak
- `lang` (string, optional): Language code (default: `'it-IT'`)

**Returns**: `void`

**Example**:
```javascript
const voiceController = new VoiceController();
await voiceController.initialize();
voiceController.speak('Hello, world!', 'en-US');
```

#### `stopSpeaking()`

Stop speaking.

**Returns**: `void`

#### `startListening(lang?)`

Start voice recognition.

**Parameters**:
- `lang` (string, optional): Language code (default: `'it-IT'`)

**Returns**: `Promise<string>` - Transcribed text

**Example**:
```javascript
const transcript = await voiceController.startListening('en-US');
console.log('You said:', transcript);
```

#### `stopListening()`

Stop voice recognition.

**Returns**: `void`

---

## Message Protocol

### Service Worker Messages

The extension uses the WebExtensions message passing API (`browser.runtime`) for communication between components.

#### Message Format

```javascript
{
  action: string,      // Action type
  ...params           // Action-specific parameters
}
```

#### Response Format

```javascript
{
  success: boolean,    // Operation success
  result?: any,       // Result data (if success)
  error?: string      // Error message (if failure)
}
```

#### Supported Actions

##### `generateSummary`

Generate article summary.

**Request**:
```javascript
{
  action: 'generateSummary',
  article: object,
  provider: string,
  settings: object
}
```

**Response**:
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

Extract citations from article.

**Request**:
```javascript
{
  action: 'extractCitations',
  article: object,
  provider: string,
  settings: object
}
```

**Response**:
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

Translate article.

**Request**:
```javascript
{
  action: 'translateArticle',
  article: object,
  provider: string,
  targetLanguage: string,
  settings: object
}
```

**Response**:
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

Run one LLM completion for an extension page. The service worker reads the API key; the page never does. Accepted only from extension pages: the router checks that `sender.url` starts with `browser.runtime.getURL('')`, so content scripts are ignored.

**Request**:
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

Only these three options are forwarded; any other key is dropped.

**Response**:
```javascript
{
  success: true,
  result: string    // completion text
}
```

##### `testApiKey`

Test API key validity.

**Request**:
```javascript
{
  action: 'testApiKey',
  provider: string,
  apiKey: string
}
```

**Response**:
```javascript
{
  success: true
}
```

#### Example Usage

```javascript
// Send message from popup to service worker
const response = await browser.runtime.sendMessage({
  action: 'generateSummary',
  article: extractedArticle,
  provider: 'groq',
  settings: userSettings
});
if (response.success) {
  console.log('Summary:', response.result.summary);
} else {
  console.error('Error:', response.error);
}
```

---

## Error Handling

### Error Types

All APIs throw standard JavaScript `Error` objects with descriptive messages.

### Common Error Messages

- `"Provider non valido: {provider}"` - Invalid provider name
- `"API key non configurata per {provider}"` - API key not configured
- `"Timeout: il provider non ha risposto"` - API timeout
- `"[RATE_LIMIT:{provider}]"` - Rate limit exceeded
- `"Testo troppo corto (minimo {min} caratteri)"` - Input too short
- `"File troppo grande. Massimo 20MB."` - File too large

### Error Handling Best Practices

```javascript
try {
  const result = await APIOrchestrator.callAPI(provider, apiKey, article, settings);
  // Handle success
} catch (error) {
  if (error.message.includes('RATE_LIMIT')) {
    // Handle rate limit
  } else if (error.message.includes('Timeout')) {
    // Handle timeout
  } else {
    // Handle generic error
  }
}
```

---

## Versioning

This API reference is for version **2.2.0** of the Web Article Summarizer extension.

### Changelog

See [CHANGELOG.md](../../CHANGELOG.md) for version history and breaking changes.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to the API.

---

## License

Apache License 2.0 - See [LICENSE](../../LICENSE) for details.
