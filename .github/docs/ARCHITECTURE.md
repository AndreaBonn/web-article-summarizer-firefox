# Architecture Documentation

<p align="right">
  <a href="ARCHITECTURE.it.md">🇮🇹 Italiano</a> · <strong>🇺🇸 English</strong>
</p>

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [AI Integration](#ai-integration)
- [Storage Strategy](#storage-strategy)
- [Security Architecture](#security-architecture)
- [Performance Optimizations](#performance-optimizations)

---

## Overview

Web Article Summarizer is a Firefox extension (Manifest V3) that leverages multiple AI providers to analyze web articles and PDFs. The architecture follows a modular, layered design with clear separation of concerns.

### Key Architectural Principles

- **Modularity**: Each feature is isolated in its own module with well-defined interfaces
- **Provider Agnosticism**: AI provider logic is abstracted through orchestration layers
- **Predictable failures**: 60-second request timeout and clear, localized error messages (no automatic retry, no provider fallback)
- **Security-First**: Multi-layered XSS prevention and prompt injection defense
- **Performance**: Intelligent caching and lazy loading

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Firefox Extension                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Content    │  │   Popup      │  │   Reading    │      │
│  │   Script     │  │   Interface  │  │   Mode       │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘               │
│                            │                                  │
│                   ┌────────▼────────┐                        │
│                   │  Service Worker │                        │
│                   │   (Background)  │                        │
│                   └────────┬────────┘                        │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐              │
│         │                  │                  │              │
│    ┌────▼─────┐    ┌──────▼──────┐    ┌─────▼─────┐       │
│    │   AI     │    │   Storage   │    │  Security │       │
│    │ Orchestr.│    │   Manager   │    │  Sanitizer│       │
│    └────┬─────┘    └──────┬──────┘    └───────────┘       │
│         │                  │                                 │
└─────────┼──────────────────┼─────────────────────────────────┘
          │                  │
          │                  │
     ┌────▼────┐      ┌──────▼──────┐
     │   AI    │      │   Browser   │
     │ Providers│      │   Storage   │
     └─────────┘      └─────────────┘
```

### Component Layers

1. **Presentation Layer**: UI components (popup, reading mode, history, options)
2. **Business Logic Layer**: Core utilities, AI orchestration, content processing
3. **Data Layer**: Storage management, caching, history
4. **Integration Layer**: AI provider clients, WebExtensions APIs (`browser.*`)

---

## Core Components

### 1. Background Service Worker

**Location**: `src/background/service-worker.js`

The service worker is the central hub for all API communications and background tasks.

**Responsibilities**:
- Handle messages from content scripts and UI pages
- Coordinate AI API calls through the orchestrator
- Manage automatic cache maintenance via alarms
- Run one-shot LLM completions for extension pages (`generateCompletion`)
- Follow the interface language stored in `storage.local.uiLanguage` (`ui-language.js`)
- Validate and sanitize all incoming requests

**Key Features**:
- Manifest V3 compliant (persistent event listeners)
- Provider validation before processing
- Centralized error handling
- Automatic maintenance scheduling
- Extension-page-only check on `generateCompletion` (`message-router.js`)

### 2. Content Script

**Location**: `src/content/content-script.js`

Injected into web pages to extract article content.

**Responsibilities**:
- Extract article text using Mozilla Readability
- Parse article structure (title, paragraphs, metadata)
- Calculate reading time and word count
- Send extracted data to service worker

**Security**:
- Runs in isolated context
- No direct API access
- All data sanitized before transmission

### 3. AI Orchestration System

**Location**: `src/utils/ai/`

Multi-layered system for managing AI provider interactions.

#### APIOrchestrator (`api-orchestrator.js`)

Central coordinator for all AI operations.

```javascript
// Single entry point for AI calls
APIOrchestrator.generateCompletion(provider, apiKey, systemPrompt, userPrompt, options)
```

**Features**:
- Provider-agnostic interface
- Automatic model selection per provider
- Response format handling (JSON, text)
- Temperature and token limit management

#### ProviderCaller (`provider-caller.js`)

Low-level HTTP client for each AI provider.

**Supported Providers**:
- **Groq**: Llama 3.3 70B (fast, free tier)
- **OpenAI**: GPT-4o (high quality)
- **Anthropic**: Claude Sonnet 4.5 (best reasoning)
- **Gemini**: Gemini 2.5 Pro (large context)

**Features**:
- Fetch timeout protection (60s)
- JSON response validation
- Provider-specific error handling
- Rate limit detection (HTTP 429 raised as `[RATE_LIMIT:Provider]`, mapped to a clear message)

#### Completion client (`completion-client.js`)

Entry point used by extension pages for raw LLM calls.

```javascript
const text = await requestCompletion(provider, systemPrompt, userPrompt, { temperature, maxTokens, responseFormat: 'json' })
```

**Features**:
- Used by multi-analysis (global summary, comparison, Q&A, correlation), content classification in the popup, PDF analysis and multi-article Q&A
- Sends the `generateCompletion` action to the service worker, so pages never read the API key
- `handleGenerateCompletion` (`src/background/message-handlers.js`) reads the key, forwards only `temperature`, `maxTokens` and `responseFormat: 'json'`, and calls `APIOrchestrator.generateCompletion`
- The router (`message-router.js`) accepts the action only when `sender.url` starts with `browser.runtime.getURL('')` (extension pages, not content scripts)

#### PromptBuilder (`prompt-builder.js`)

Constructs optimized prompts for each provider and content type.

**Capabilities**:
- Content-type specific prompts (news, scientific, tutorial, business, opinion)
- Multi-language support (5 languages)
- Prompt injection defense (embedded in system prompts)
- Paragraph numbering for citation matching

#### ContentDetector (`content-detector.js`)

Analyzes article content to determine type and language.

**Detection Methods**:
- **Content Type**: Scoring-based algorithm analyzing keywords and patterns
- **Language**: Pattern matching on common words (supports 5 languages)

**Content Types**:
- `scientific`: Academic papers, research articles
- `news`: News articles, breaking stories
- `tutorial`: How-to guides, technical documentation
- `business`: Business analysis, market reports
- `opinion`: Editorials, opinion pieces
- `general`: Default fallback

### 4. Error Handling

**Location**: `src/utils/core/error-handler.js`

The system does not retry failed requests and does not switch provider on failure. Each call has a 60-second timeout (`AbortController` in `provider-caller.js`), and a failure is reported to the user with an actionable message.

#### ErrorHandler (`error-handler.js`)

**Features**:
- `getErrorMessage` is idempotent: a message that is already mapped (in any language) is recognized and rendered again in the current interface language. This matters because the service worker sends already-mapped messages to the pages
- `classifyError` keeps the error kind (`missing_key`, `unsupported_page`, `page_unreachable`, `generic`), which decides the recovery action the UI offers
- HTTP 429 responses surface as `[RATE_LIMIT:Provider]` and become a clear message

### 5. Storage System

**Location**: `src/utils/storage/`

Storage management with caching and history. Data is stored in `browser.storage.local`, uncompressed.

#### StorageManager (`storage-manager.js`)

Main interface for browser storage operations.

**Stored Data**:
- API keys (per provider)
- User settings (provider, language, content type)
- UI language preference
- Usage statistics

**Security Note**: API keys are stored in `storage.local` in plain text, which is sandboxed per extension. No custom encryption is used because extension source code is always readable. Extension pages do not read the key: LLM calls go through the service worker (`generateCompletion`).

#### CacheManager (`cache-manager.js`)

Response caching with TTL and statistics.

**Cache Strategy**:
- Key: `${url}_${provider}_${language}_${contentType}`
- TTL: 24 hours (configurable)
- Automatic expiration
- LRU eviction when storage is full

**Statistics Tracked**:
- Hit/miss ratio
- Cache size
- Entry age
- Operation logs

#### Compressed data recovery (`compressed-data-recovery.js`)

Earlier versions compressed history summaries and cache entries (LZ-String). Compression no longer exists; this module repairs data it left behind.

**Behavior**:
- `restoreCompressedData` runs from `AutoMaintenance.initialize()` at every service worker start, regardless of `autoCleanup`
- Decodes compressed history summaries and removes the compression markers; entries that cannot be decoded are left untouched
- Discards compressed cache entries (the cache is rebuilt on the next request)
- `lz-string` remains a dependency only for this purpose

#### AutoMaintenance (`src/utils/core/auto-maintenance.js`)

**Automatic Maintenance** (every 24 hours via browser alarms, when `autoCleanup` is enabled):
- Removes expired cache entries
- Keeps the cache at 100 entries (LRU)
- Deletes summaries older than 180 days, **favorites excluded**

The "Run Cleanup Now" button in Options > Advanced runs the same 180-day deletion (favorites excluded) and the LRU trimming.

#### HistoryManager (`history-manager.js`)

Facade for three specialized history repositories.

**Repositories**:
1. **ArticleHistory**: Web article analyses
2. **PDFHistory**: PDF document analyses
3. **MultiAnalysisHistory**: Multi-article comparisons

`HistoryManager.importPDFAnalysis` (delegating to `PDFHistory.importPDFAnalysis`) restores a PDF analysis from a backup keeping its id and timestamp, so importing the same file twice creates no duplicates.

**Features**:
- Search and filtering
- Favorites system
- Notes and annotations
- Export/import (JSON backup, including PDF analyses)

**Backup format** (`src/pages/history/io-backup.js`, `backup-rules.js`): the JSON file holds `data.singleArticles`, `data.multiAnalysis`, `data.pdfAnalysis`, `settings` and `stats`, plus `metadata.totalPDFAnalysis`. Import sanitizes text fields and accepts files up to 50 MB.

### 6. Security System

**Location**: `src/utils/security/`

Multi-layered security architecture.

#### HtmlSanitizer (`html-sanitizer.js`)

Prevents XSS by sanitizing all content before DOM insertion.

**Methods**:
- `escape()`: Escapes HTML special characters
- `renderText()`: Safe text rendering with paragraph preservation
- `renderList()`: Safe list rendering for key points, citations, Q&A

**Usage**:
```javascript
// NEVER use innerHTML directly with AI content
element.innerHTML = aiResponse; // ❌ DANGEROUS

// ALWAYS use HtmlSanitizer
HtmlSanitizer.renderText(aiResponse, element); // ✅ SAFE
```

#### InputSanitizer (`input-sanitizer.js`)

Cleans and validates text before sending to AI APIs.

**Sanitization Steps**:
1. Strip HTML tags and scripts
2. Remove URLs (optional)
3. Remove citations (optional)
4. Normalize whitespace
5. Remove control characters
6. Escape prompt injection attempts
7. Validate length (min/max)
8. Truncate if necessary

**Prompt Injection Defense**:
- Detects common injection patterns
- Escapes system prompt terminators
- Validates input structure

#### Content Security Policy

**Manifest CSP**:
```json
{
  "content_security_policy": {
    "extension_pages": "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; ..."
  }
}
```

**Restrictions**:
- No inline scripts
- No eval()
- Only HTTPS connections
- Whitelisted API endpoints only

### 7. Export System

**Location**: `src/utils/export/`

Multi-format export capabilities.

#### PDFExporter (`pdf-exporter.js`)

Generates formatted PDF documents using jsPDF.

**Sections**:
- Header with metadata
- Article title and stats
- Summary
- Key points (formatted list)
- Translation (if available)
- Q&A (if available)
- Citations (APA format)

#### Document labels (`doc-labels.js`)

Exported documents (Markdown, PDF, email, bibliography, copied text, voice reading) are written in the interface language. `docLabel`, `docHeading`, `docDate` and `citationTypeLabel` resolve titles, section headings, dates and citation types from the locale files.

#### MarkdownExporter (`markdown-exporter.js`)

Exports to Markdown format.

**Features**:
- Proper heading hierarchy
- Formatted lists
- Code blocks for citations
- Metadata frontmatter

#### EmailManager (`email-manager.js`)

Opens default email client with pre-filled content.

**Format**:
- Subject: Article title
- Body: Formatted analysis
- Attachments: Not supported (browser limitation)
- Citations can be included in the message from the popup and the history
- `EmailManager.openEmailDraft(subject, body)` opens a draft without a recipient (`mailto:`); multi-article analysis uses it

### 8. PDF System

**Location**: `src/utils/pdf/`

PDF parsing and analysis pipeline.

#### PDFAnalyzer (`pdf-analyzer.js`)

Main PDF processing coordinator.

**Pipeline**:
1. File validation (size, type, password protection)
2. Cache check (by file hash)
3. Text extraction (pdfjs-dist)
4. AI analysis (same as articles)
5. Cache storage

**Features**:
- 20MB file size limit
- SHA-256 file hashing for cache keys
- Progress callbacks for UI updates
- Automatic cache management

#### PDFCacheManager (`pdf-cache-manager.js`)

Specialized cache for PDF analyses.

**Cache Key**: SHA-256 hash of file content

**Benefits**:
- Same PDF analyzed once (even with different filename)
- Instant results for re-uploads
- Stale entries are dropped by cache expiry

### 9. Internationalization (i18n)

**Location**: `src/utils/i18n/`

i18n system. Every user-visible text goes through `I18n.t` / `I18n.tf`.

#### I18n (`i18n.js`)

Main i18n manager.

**Interface languages** (selectable):
- Italian (it) - Default
- English (en)

Spanish (es), French (fr) and German (de) locale files are partial: a missing key falls back to Italian.

The service worker loads the language from `storage.local.uiLanguage` and follows changes (`src/background/ui-language.js`), so messages it produces match the interface.

**Features**:
- JSON-based translations (`locales/*.json`)
- Automatic UI updates on language change
- Placeholder replacement (`{variable}`)
- Separate UI language and AI output language

**Usage**:
```javascript
// Simple translation
I18n.t('key')

// With placeholders
I18n.tf('greeting', { name: 'Andrea' })

// Update all UI elements
I18n.updateUI()
```

**HTML Integration**:
```html
<button data-i18n="analyze_button">Analyze</button>
<input data-i18n="search_placeholder" placeholder="Search...">
<span data-i18n-title="tooltip_text" title="Tooltip">Icon</span>
```

### 10. Voice System

**Location**: `src/utils/voice/`

Text-to-Speech and Speech-to-Text integration.

#### VoiceController (`voice-controller.js`)

Coordinates TTS and STT managers.

**Features**:
- Multi-language voice support
- Play/pause/stop controls
- Voice input for Q&A
- Language code mapping (output → voice)

#### TTSManager (`tts-manager.js`)

Web Speech API wrapper (`window.speechSynthesis`).

**Features**:
- Voice selection by language
- Rate and pitch control
- Playback state management
- Event-based notifications

#### STTManager (`stt-manager.js`)

Web Speech API wrapper.

**Features**:
- Continuous recognition
- Interim results
- Language switching
- Error handling

---

## Data Flow

### Article Analysis Flow

```
1. User clicks extension icon on article page
   ↓
2. Content script extracts article using Readability
   ↓
3. Content script sends article data to service worker
   ↓
4. Service worker validates and sanitizes input
   ↓
5. APIOrchestrator checks cache
   ↓
6. If cache miss:
   a. ContentDetector analyzes article type and language
   b. PromptBuilder constructs optimized prompt
   c. ProviderCaller calls the provider (60s timeout, single attempt)
   d. ResponseParser extracts summary and key points
   e. CacheManager stores result
   ↓
7. Service worker sends result to popup
   ↓
8. Popup renders with HtmlSanitizer
   ↓
9. HistoryManager saves to history
```

### PDF Analysis Flow

```
1. User uploads PDF in PDF Analysis page
   ↓
2. PDFAnalyzer validates file (size, type, password)
   ↓
3. PDFCacheManager checks cache by file hash
   ↓
4. If cache miss:
   a. pdfjs-dist extracts text from all pages
   b. Text is validated (minimum 100 chars)
   c. APIOrchestrator analyzes text (same as articles)
   d. PDFCacheManager stores result with file hash
   ↓
5. Result displayed in PDF Analysis page
   ↓
6. PDFHistory saves to history
```

### Multi-Article Analysis Flow

```
1. User selects 2+ articles from history
   ↓
2. MultiAnalysisManager validates selection
   ↓
3. Prompt is built combining all article summaries
   ↓
4. requestCompletion sends `generateCompletion` to the service worker, which generates the comparative analysis
   ↓
5. Result displayed in Multi-Analysis page
   ↓
6. MultiAnalysisHistory saves to history
```

---

## AI Integration

### Provider Architecture

Each provider has a dedicated caller method in `ProviderCaller`:

```javascript
// OpenAI-compatible (Groq, OpenAI)
callOpenAICompatible(apiKey, systemPrompt, userPrompt, options, url, providerName)

// Anthropic (Claude)
callAnthropicCompletion(apiKey, systemPrompt, userPrompt, options)

// Google Gemini
callGeminiCompletion(apiKey, systemPrompt, userPrompt, options)
```

### Prompt Engineering

**System Prompt Structure**:
1. Role definition
2. Task description
3. Output format specification
4. Content-type specific instructions
5. Language enforcement
6. Prompt injection defense

**User Prompt Structure**:
1. Article metadata (title, URL, word count)
2. Numbered paragraphs for citation matching
3. Specific instructions based on task

### Response Parsing

**Expected Format**:
```
## RIASSUNTO
[Summary text]

## PUNTI CHIAVE
1. **Title** (§1-3) Description
2. **Title** (§5) Description
...
```

**Parser** (`response-parser.js`):
- Splits on `## PUNTI CHIAVE` marker
- Extracts summary from first section
- Regex-based key point extraction
- Validates minimum content length

---

## Storage Strategy

### Storage Quota

- **Area**: `browser.storage.local` (the extension does not request `unlimitedStorage`)
- **Strategy**: Caching + automatic cleanup

### Storage Allocation

```
├── apiKeys (< 1KB)
├── settings (< 1KB)
├── summaryHistory (2-4MB)
├── summaryCache (1-2MB, TTL 24h)
├── pdfHistory (1-2MB)
├── pdfCache (1-2MB, TTL 24h)
├── multiAnalysisHistory (1-2MB)
└── stats (< 1KB)
```

### Automatic Maintenance

- Runs every 24 hours via browser alarms when `autoCleanup` is enabled
- Removes expired cache entries and trims the cache to 100 entries (LRU)
- Deletes summaries older than 180 days; favorites are always kept
- `restoreCompressedData` runs at every service worker start, independently of `autoCleanup`

---

## Security Architecture

### Defense Layers

1. **Input Validation**: All user input sanitized before processing
2. **Output Sanitization**: All AI responses sanitized before DOM insertion
3. **CSP**: Strict Content Security Policy prevents inline scripts
4. **Prompt Injection Defense**: Multi-language detection and escaping
5. **API Key Protection**: Stored in `browser.storage.local`, sandboxed per extension (plain text, no encryption)
6. **HTTPS Only**: All API calls over HTTPS
7. **Origin Validation**: Messages validated by sender ID

### Threat Model

**Threats Mitigated**:
- XSS via AI responses
- Prompt injection attacks
- API key theft
- Malicious content scripts
- CSRF attacks

**Threats Not Mitigated**:
- User installs malicious extension
- User's Firefox profile is compromised
- API provider is compromised

---

## Performance Optimizations

### Caching Strategy

- **Cache Key**: `${url}_${provider}_${language}_${contentType}`
- **TTL**: 24 hours
- **Eviction**: LRU when storage is full
- **Hit Rate**: ~40-60% for typical usage

### Lazy Loading

- **History Page**: Loads entries in batches of 20
- **PDF Preview**: Renders on-demand
- **Voice**: Loads voices only when needed

### Debouncing

- **Search**: 300ms debounce on the history search field

### Request Optimization

- **Timeout**: 60s timeout (`AbortController`) prevents hanging requests
- **Rate limits**: no client-side limiter; an HTTP 429 from the provider is mapped to a clear message

---

## Extension Points

### Adding a New AI Provider

1. Add provider to `DEFAULT_MODELS` in `api-orchestrator.js`
2. Implement caller method in `provider-caller.js`
3. Update manifest `host_permissions`
4. Add UI option in settings

### Adding a New Language

1. Create `locales/{lang}.json` with translations
2. Import in `i18n.js`
3. Add to `LANGUAGE_CONFIGS` in `prompt-builder.js`
4. Add to `LANGUAGE_TEMPLATES` in `prompt-builder.js`
5. Add detection patterns in `content-detector.js`
6. Update UI language selector

### Adding a New Content Type

1. Add detection logic in `content-detector.js`
2. Create system prompt in `prompts/summary-prompts.js`
3. Add to `PromptRegistry` in `prompt-registry.js`
4. Update UI content type selector

---

## Testing Strategy

### Unit Tests

**Framework**: Vitest + jsdom

**Coverage**:
- AI utilities (prompt building, parsing, detection)
- Storage managers (cache, compressed-data recovery, history)
- Security (sanitizers, validators)
- Export formatters

**Run Tests**:
```bash
npm run test        # Single run
npm run test:watch  # Watch mode
```

### Manual Testing

**Test Scenarios**:
1. Article analysis on various content types
2. PDF upload and analysis
3. Multi-article comparison
4. Translation and citation extraction
5. Export to PDF/Markdown/Email
6. Voice controls (TTS/STT)
7. History search and filtering
8. Settings persistence
9. Error handling and error messages
10. Cache and automatic maintenance

---

## Deployment

### Build Process

```bash
npm run build
```

**Output**: `dist/` folder with:
- Minified JavaScript
- Optimized CSS
- Copied assets
- Updated manifest

### Packaging and Distribution (Firefox)

1. Build production version (`npm run build`)
2. Generate the package with `npm run build:xpi` (runs the build, then `web-ext build` into `web-ext-artifacts/`)
3. For local testing: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `dist/manifest.json`, or `npm run start:firefox` (`web-ext run`)
4. Upload the package to addons.mozilla.org (AMO) Developer Hub
5. Fill in the listing (description, screenshots, privacy policy) and submit for review

### Version Management

**Semantic Versioning**: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features
- **PATCH**: Bug fixes

**Update Process**:
1. Update version in `package.json` and `manifest.json`
2. Update `CHANGELOG.md`
3. Build and test
4. Commit and tag
5. Upload to addons.mozilla.org (AMO)

---

## Monitoring and Debugging

### Logging

**Logger** (`src/utils/core/logger.js`):
- Structured logging with levels (info, warn, error)
- Automatic timestamp
- Color-coded console output
- Production mode disables debug logs

### Telemetry

**Tracked Metrics**:
- API call success/failure rates
- Cache hit/miss ratios
- Provider usage distribution
- Average generation time

**Storage**: `browser.storage.local.stats`

### Debugging

**Firefox Developer Tools**:
- Background script: `about:debugging#/runtime/this-firefox` → Inspect on the extension
- Popup: Right-click extension icon → Inspect (or open the popup page from `about:debugging`)
- Content Script: Inspect page → Console → Filter by extension ID

**Common Issues**:
- API key errors: Check settings page
- Cache issues: Clear cache in history page
- Storage full: Delete old entries or clear history
- Provider timeout: Check network connection

---

## Future Enhancements

### Planned Features

1. **Offline Mode**: Local LLM support (WebLLM)
2. **Collaborative Annotations**: Share analyses with team
3. **Browser Sync**: Sync history across devices
4. **Custom Prompts**: User-defined prompt templates
5. **Advanced Analytics**: Reading patterns and insights
6. **Browser Extension**: Chromium browsers support (Chrome, Edge)

### Technical Debt

1. **Test Coverage**: Increase to 80%+
2. **TypeScript Migration**: Add type safety
3. **Performance**: Optimize large PDF handling
4. **Accessibility**: WCAG 2.1 AA compliance
5. **Documentation**: API reference docs

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

---

## License

Apache License 2.0 - See [LICENSE](../../LICENSE) for details.
