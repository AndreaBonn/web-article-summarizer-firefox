# Security Overview

> **Lingua:** English | [Italiano](SECURITY.it.md)

This document describes the security architecture and protective measures implemented in AI Article Summarizer. It is intended for users who want to understand how their data and browsing activity are protected, and for developers evaluating the codebase.

---

## Table of Contents

- [Architecture Principles](#architecture-principles)
- [XSS Prevention](#xss-prevention)
- [Input Sanitization](#input-sanitization)
- [Prompt Injection Defense](#prompt-injection-defense)
- [Content Security Policy](#content-security-policy)
- [Extension Permissions](#extension-permissions)
- [Message Passing Security](#message-passing-security)
- [API Key Management](#api-key-management)
- [Network Security](#network-security)
- [Iframe Sandboxing](#iframe-sandboxing)
- [Content Extraction Safety](#content-extraction-safety)
- [Error Handling and Information Disclosure](#error-handling-and-information-disclosure)
- [Storage Security](#storage-security)
- [Export Security](#export-security)
- [Backup Import Validation](#backup-import-validation)
- [Dependency Management](#dependency-management)
- [CI/CD Pipeline](#cicd-pipeline)
- [Reporting a Vulnerability](#reporting-a-vulnerability)

---

## Architecture Principles

The extension follows a **defense-in-depth** strategy with multiple independent layers of protection. Compromising one layer does not automatically compromise the others.

| Principle | Implementation |
|---|---|
| **Least Privilege** | Minimal permissions; no `<all_urls>` |
| **Input Validation at Boundaries** | All external data sanitized before use |
| **Separation of Concerns** | Content script has no API key access; all LLM calls go through the service worker |
| **Fail Secure** | Errors produce safe user-friendly messages; no sensitive data is exposed |
| **No Secrets in Code** | API keys stored in sandboxed `browser.storage.local`, never in source code |

---

## XSS Prevention

**Module:** `src/utils/security/html-sanitizer.js`

All dynamic content inserted into the DOM passes through `HtmlSanitizer.escape()`, which uses the browser's own escaping mechanism:

```javascript
static escape(text) {
  const div = document.createElement('div');
  div.textContent = text;     // browser auto-escapes
  return div.innerHTML;       // returns safe HTML entities
}
```

This pattern is applied consistently to:
- Article titles, authors, URLs
- AI-generated summaries and key points
- Citation data and Q&A answers
- History entries and metadata badges
- Translation output
- `data-id` attributes in innerHTML templates

Dedicated rendering methods (`renderText()`, `renderList()`) build HTML from pre-escaped fragments, preventing injection even when composing complex structures.

---

## Input Sanitization

**Module:** `src/utils/security/input-sanitizer.js`

A multi-stage pipeline sanitizes all user-supplied and web-extracted text before it reaches the AI provider:

| Stage | Purpose |
|---|---|
| **HTML Tag Stripping** | Removes `<script>`, `<style>`, `<noscript>` and all remaining tags |
| **URL Removal** | Optionally strips URLs to reduce noise |
| **Control Character Removal** | Strips ASCII control characters (0x00-0x1F, 0x7F) |
| **Prompt Injection Escaping** | Detects and neutralizes injection patterns (see below) |
| **Length Validation** | Enforces min/max bounds to prevent empty or oversized inputs |

A non-destructive `validate()` method is also available for checking inputs without modifying them.

---

## Prompt Injection Defense

**Module:** `src/utils/security/input-sanitizer.js` — `escapePromptInjection()`

The extension defends against prompt injection using a three-step approach:

### 1. Unicode Normalization
Text is normalized to **NFKC form** before pattern matching, preventing Unicode bypass techniques (e.g., using full-width characters or homoglyphs).

### 2. Zero-Width Character Removal
The following invisible characters are stripped:
- Zero-width space (U+200B)
- Zero-width non-joiner/joiner (U+200C-U+200D)
- Left/right-to-right marks (U+200E-U+200F)
- Line/paragraph separators (U+2028-U+2029)
- Various embedding controls (U+202A-U+202F)
- Byte order mark (U+FEFF)
- Soft hyphen (U+00AD)

### 3. Multi-Language Pattern Detection
Injection patterns are detected in **five languages**:

| Language | Example Patterns |
|---|---|
| English | "ignore previous instructions", "disregard all prior context" |
| Italian | "ignora istruzioni precedenti", "dimentica istruzioni" |
| French | "ignorer instructions precedentes", "oublie instructions" |
| Spanish | "ignora instrucciones anteriores", "olvida instrucciones" |
| German | "ignoriere vorherige anweisungen", "vergiss anweisungen" |

Additionally, special tokens used by LLM systems are detected and removed: `system:`, `assistant:`, `user:`, `<|...|>`, `[INST]`, `[/INST]`.

User Q&A input is further limited to **2,000 characters** via `sanitizeUserPrompt()`.

---

## Content Security Policy

**File:** `manifest.json`

The extension enforces a strict CSP on all extension pages:

```
default-src 'none';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self';
font-src 'self';
object-src 'none';
img-src 'self' data:;
media-src 'none';
connect-src https://api.groq.com https://api.openai.com
            https://api.anthropic.com https://generativelanguage.googleapis.com;
frame-src https:;
```

| Directive | Purpose |
|---|---|
| `default-src 'none'` | Whitelist-only approach; everything blocked unless explicitly allowed |
| `script-src 'self'` | Only bundled extension scripts can execute; no inline scripts, no `eval()` |
| `'wasm-unsafe-eval'` | Required by PDF.js for WebAssembly-based parsing |
| `connect-src` | Network requests limited to the four LLM provider APIs |
| `object-src 'none'` | Blocks Flash, Java applets, and other plugin content |
| `frame-src https:` | Iframes restricted to HTTPS (used for article original view) |

---

## Extension Permissions

**File:** `manifest.json`

The extension requests only the permissions strictly necessary for its functionality:

| Permission | Purpose | Scope |
|---|---|---|
| `activeTab` | Access the current tab to extract article content | Only the active tab, only when clicked |
| `storage` | Save settings, history, and cache locally | Extension-sandboxed storage |
| `tts` | Text-to-speech for reading summaries aloud | Local synthesis only |
| `alarms` | Schedule automatic cache maintenance | Internal timing only |

### Host Permissions

Network access is restricted to the four LLM provider endpoints:

```
https://api.groq.com/*
https://api.openai.com/*
https://api.anthropic.com/*
https://generativelanguage.googleapis.com/*
```

The extension does **not** request `<all_urls>`, `tabs`, `webRequest`, `cookies`, `clipboard`, `downloads`, `debugger`, or any other broad permission.

### Content Script Exclusions

The content script is explicitly excluded from sensitive pages:

```json
"exclude_matches": [
  "https://accounts.google.com/*",
  "*://*.bank*/*"
]
```

---

## Message Passing Security

**Module:** `src/background/service-worker.js`

All inter-component communication (popup, content script, service worker) is validated:

### Sender Verification
Every incoming message is checked against the extension's own ID:

```javascript
if (sender.id !== browser.runtime.id) {
  return false;
}
```

This prevents other extensions or web pages from sending messages to the service worker.

### Provider Whitelist
A strict `Set`-based whitelist validates provider names before any API operation:

```javascript
const VALID_PROVIDERS = new Set(['groq', 'openai', 'anthropic', 'gemini']);
```

Invalid providers are rejected immediately with an error response, before any async operation begins.

### Error Message Filtering
All error responses sent back through the message channel pass through `ErrorHandler.getErrorMessage()`, which maps technical errors to user-friendly messages — preventing information leakage through error responses.

---

## API Key Management

**Module:** `src/utils/storage/storage-manager.js`

### Storage
API keys are stored in `browser.storage.local`, which is automatically sandboxed by Firefox: each extension has its own isolated storage area that other extensions and web pages cannot access.

### Why Not Encrypted?
Keys are stored in clear text in `storage.local`: there is no encryption layer.

The extension deliberately does **not** apply custom encryption to stored keys. The reasoning:

> In a browser extension, the source code is always readable (extensions are distributed as plain JavaScript). Any encryption key or algorithm embedded in the code provides no meaningful protection: an attacker with access to the extension's storage also has access to the decryption logic. `browser.storage.local` sandboxing is the real security boundary.

### Isolation
- API keys are **never** accessible from the content script
- All LLM calls are routed through the **service worker**, which retrieves keys directly from storage
- Keys are **never** transmitted in runtime messages (except during the initial test flow, which reads from a just-entered input field)
- Extension pages (multi-article analysis, PDF analysis, content classification in the popup) never read the key: they call `requestCompletion()` (`src/utils/ai/completion-client.js`), which sends the `generateCompletion` action to the service worker. The handler (`handleGenerateCompletion` in `src/background/message-handlers.js`) reads the key inside the worker, forwards only `temperature`, `maxTokens` and `responseFormat: 'json'`, and calls `APIOrchestrator.generateCompletion`
- The message router (`src/background/message-router.js`) accepts `generateCompletion` only when `sender.url` starts with the extension's own URL (`browser.runtime.getURL('')`), so content scripts, which share the extension ID, cannot drive the user's keys
- Keys are **masked** in the Options UI (showing only the last 4 characters)

---

## Network Security

**Module:** `src/utils/ai/provider-caller.js`

### Timeout Enforcement
Every API call has a **60-second timeout** enforced via `AbortController`:

```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000);
```

The timeout is always cleared in a `finally` block to prevent resource leaks.

### Provider Errors and Rate Limits
There is no automatic retry, no fallback between providers and no client-side rate limiter: a failed call is reported to the user as is. A provider's HTTP 429 response is raised as `[RATE_LIMIT:Provider]` and mapped by `ErrorHandler` to a message that suggests changing the API key or switching provider in the settings.

---

## Iframe Sandboxing

**Files:** `src/pages/reading-mode/reading-mode.html`, `display.js`

The reading mode iframe (used to display the original article) is maximally sandboxed:

```html
<iframe sandbox="" referrerpolicy="no-referrer"></iframe>
```

`sandbox=""` (empty) blocks:
- JavaScript execution
- Form submission
- Pop-ups and modals
- Same-origin access to the extension
- Downloads and plugins

### URL Validation
Before loading any URL into the iframe, the protocol is validated against a whitelist (`https:`, `http:`). URLs with `javascript:`, `data:`, or `file:` protocols are rejected, and the UI falls back to the safe text view.

---

## Content Extraction Safety

**Module:** `src/utils/core/content-extractor.js`

### DOM-Level Noise Removal
Before extracting article text, the following elements are removed from the DOM clone:
- Scripts, styles, iframes, forms
- Navigation, headers, footers, sidebars
- Ads, paywalls, subscription blocks, cookie banners
- Social sharing widgets, newsletters, popups
- Related/recommended content blocks

### Text-Level Pattern Detection
Paragraphs matching known noise patterns are filtered out:
- Pricing and subscription text (multi-currency, multi-language)
- Call-to-action and promotional content
- Cookie consent and login prompts
- Free trial and cancellation offers

### Deduplication
Near-identical paragraphs (common in paywall-repeated content) are deduplicated via normalized text comparison before being sent to the AI.

---

## Error Handling and Information Disclosure

**Module:** `src/utils/core/error-handler.js`

### User-Facing Error Messages
Technical error messages are **never** shown directly to users. `ErrorHandler.getErrorMessage()` maps every error category to a safe, actionable message:

| Technical Error | User Message |
|---|---|
| HTTP 401/Unauthorized | "API key non valida. Verifica la configurazione nelle impostazioni." |
| HTTP 429/Too Many Requests | "Rate limit raggiunto. La tua chiave API ha esaurito le richieste disponibili. [...]" |
| Network/fetch errors | "Errore di connessione. Verifica la tua connessione internet." |
| Unsupported pages (`about:` pages, `http:` sites; only `https:` is read) | "Questa pagina non si può riassumere: l'estensione legge gli articoli dei siti https. [...]" |
| QUOTA_BYTES | "Spazio di archiviazione esaurito. Pulisci la cache nelle impostazioni." |
| Unrecognized errors | "Si è verificato un errore imprevisto. Riprova." |

Messages are rendered in the current interface language (Italian or English; the Italian text is shown above). `getErrorMessage()` is idempotent: a message that was already mapped, in any language, is recognised and re-rendered in the current language, which is what lets the service worker send mapped messages to the pages.

### Error Log Privacy
Error logs stored for diagnostics follow strict privacy rules:
- **Original messages** are truncated to 200 characters
- **Stack traces** retain only the top 5 frames
- **URLs** are stripped of query parameters and fragments (only `origin + pathname`)
- **No API keys** or user PII are ever logged
- Logs are rotated at 50 entries (FIFO)

---

## Storage Security

**Modules:** `src/utils/storage/cache-store.js`, `base-history-repository.js`, `compressed-data-recovery.js`

### Legacy Compressed Data
History and cache are stored as plain JSON in `browser.storage.local`; IndexedDB is not used. History summaries compressed by older versions are decoded with LZ-string and cache entries compressed by older versions are discarded by `restoreCompressedData()`, which runs at every service worker start.

### Quota Protection
- `_safeStorageSet()` catches `QUOTA_BYTES` errors and provides an actionable user message
- Automatic maintenance runs every 24 hours via `browser.alarms` when automatic cleanup is enabled: expired cache removal, cache limited to 100 entries (LRU) and deletion of summaries older than 180 days, favorites excluded
- Cache entries have configurable TTL (time-to-live) with automatic eviction

### Storage Isolation
All data resides in `browser.storage.local`, which is:
- Sandboxed per-extension (no cross-extension access)
- Inaccessible from web pages
- Cleared when the extension is uninstalled

---

## Export Security

**Module:** `src/utils/export/email-manager.js`

### Email Header Injection Prevention
Before constructing `mailto:` links:
1. Recipient email is stripped of `\r`, `\n`, `\t`, and `%` characters
2. Email format is validated via regex
3. Article titles have newlines replaced with spaces
4. Subject and body are encoded with `encodeURIComponent()`

### PDF Export
PDF generation via jsPDF operates entirely client-side with no network calls. Content is escaped before being written to the PDF document.

---

## Backup Import Validation

**Module:** `src/pages/history/io-backup.js`

Importing backup data from JSON files goes through a comprehensive validation pipeline:

| Check | Detail |
|---|---|
| **File type** | Must be JSON (MIME type or `.json` extension) |
| **File size** | Maximum 50 MB to prevent denial-of-service (backups can contain the full text of PDFs) |
| **JSON parsing** | Wrapped in try-catch with descriptive error |
| **Structure validation** | Must contain `version` (string) and `data` (object) |
| **Content validation** | Must include `singleArticles`, `multiAnalysis` or `pdfAnalysis` arrays |
| **Metadata sanitization** | Provider and content type whitelisted; language validated via `/^[a-z]{2}(-[A-Z]{2})?$/` |
| **Field sanitization** | Title (500 chars), content (100 KB), excerpt (1 KB) max lengths enforced; PDF name and text, notes and summaries are sanitized as well |
| **ID handling** | Entries keep their `id` and timestamp; an entry without a valid `id` receives a new `crypto.randomUUID()` |
| **Duplicate prevention** | Existing IDs are checked before import, so importing the same file again adds nothing |
| **User confirmation** | Modal dialog shows backup metadata before proceeding |

---

## Dependency Management

**File:** `package.json`

The extension uses a minimal set of well-known, actively maintained dependencies:

| Dependency | Purpose | Security Profile |
|---|---|---|
| `@mozilla/readability` | Article content extraction | Mozilla-maintained, battle-tested |
| `jspdf` | PDF generation | Client-side only, no network calls |
| `lz-string` | Decoding history compressed by older versions | Pure JavaScript, no dependencies |
| `pdfjs-dist` | PDF parsing | Mozilla-maintained, worker-sandboxed |

### Vulnerability Overrides
Known transitive vulnerabilities are addressed via npm overrides:
```json
"overrides": {
  "rollup": ">=2.80.0"
}
```

---

## CI/CD Pipeline

**File:** `.github/workflows/ci.yml`

Every push and pull request triggers an automated pipeline:

| Step | Purpose |
|---|---|
| `npm audit --audit-level=high` | Fails the build if high-severity CVEs are found in dependencies |
| `npm run lint` | ESLint with security-focused rules (`no-eval`, `eqeqeq`) |
| `npm test` | 641 unit tests covering security-critical modules |
| `npm run build` | Ensures the production bundle compiles without errors |

---

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer at the address listed in the GitHub profile: [@AndreaBonn](https://github.com/AndreaBonn)
3. Include a description of the vulnerability, steps to reproduce, and potential impact
4. Allow reasonable time for a fix before public disclosure

We aim to acknowledge reports within 48 hours and provide a fix within 7 days for critical issues.

---

*This document reflects the security posture as of version 2.2.0 (April 2026).*
