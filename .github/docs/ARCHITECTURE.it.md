# Documentazione Architettura

<p align="right">
  <strong>🇮🇹 Italiano</strong> · <a href="ARCHITECTURE.md">🇺🇸 English</a>
</p>

---

## Indice

- [Panoramica](#panoramica)
- [Architettura di Sistema](#architettura-di-sistema)
- [Componenti Principali](#componenti-principali)
- [Flusso dei Dati](#flusso-dei-dati)
- [Integrazione AI](#integrazione-ai)
- [Strategia di Storage](#strategia-di-storage)
- [Architettura di Sicurezza](#architettura-di-sicurezza)
- [Ottimizzazioni delle Prestazioni](#ottimizzazioni-delle-prestazioni)

---

## Panoramica

Web Article Summarizer è un'estensione Firefox (Manifest V3) che sfrutta più provider AI per analizzare articoli web e PDF. L'architettura segue un design modulare a livelli con chiara separazione delle responsabilità.

### Principi Architetturali Chiave

- **Modularità**: Ogni funzionalità è isolata nel proprio modulo con interfacce ben definite
- **Agnosticismo del Provider**: La logica dei provider AI è astratta attraverso livelli di orchestrazione
- **Errori prevedibili**: timeout di 60 secondi sulle richieste e messaggi di errore chiari e localizzati (nessun retry automatico, nessun fallback fra provider)
- **Security-First**: Prevenzione XSS multi-livello e difesa da prompt injection
- **Performance**: Caching intelligente e lazy loading

---

## Architettura di Sistema

### Architettura di Alto Livello

```
┌─────────────────────────────────────────────────────────────┐
│                  Estensione Firefox                          │
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
     │ Provider│      │   Storage   │
     └─────────┘      └─────────────┘
```

### Livelli dei Componenti

1. **Livello Presentazione**: Componenti UI (popup, reading mode, history, options)
2. **Livello Business Logic**: Utility core, orchestrazione AI, elaborazione contenuti
3. **Livello Dati**: Gestione storage, caching, storico
4. **Livello Integrazione**: Client provider AI, API WebExtensions (`browser.*`)

---

## Componenti Principali

### 1. Background Service Worker

**Posizione**: `src/background/service-worker.js`

Il service worker è il centro nevralgico per tutte le comunicazioni API e task in background.

**Responsabilità**:
- Gestire messaggi da content script e pagine UI
- Coordinare chiamate API AI attraverso l'orchestratore
- Gestire manutenzione automatica cache via alarms
- Eseguire completamenti LLM singoli per le pagine dell'estensione (`generateCompletion`)
- Seguire la lingua dell'interfaccia salvata in `storage.local.uiLanguage` (`ui-language.js`)
- Validare e sanitizzare tutte le richieste in ingresso

**Caratteristiche Chiave**:
- Conforme a Manifest V3 (listener eventi persistenti)
- Validazione provider prima dell'elaborazione
- Gestione errori centralizzata
- Schedulazione manutenzione automatica
- Controllo "solo pagine dell'estensione" su `generateCompletion` (`message-router.js`)

### 2. Content Script

**Posizione**: `src/content/content-script.js`

Iniettato nelle pagine web per estrarre il contenuto degli articoli.

**Responsabilità**:
- Estrarre testo articolo usando Mozilla Readability
- Analizzare struttura articolo (titolo, paragrafi, metadata)
- Calcolare tempo di lettura e conteggio parole
- Inviare dati estratti al service worker

**Sicurezza**:
- Esegue in contesto isolato
- Nessun accesso diretto alle API
- Tutti i dati sanitizzati prima della trasmissione

### 3. Sistema di Orchestrazione AI

**Posizione**: `src/utils/ai/`

Sistema multi-livello per gestire le interazioni con i provider AI.

#### APIOrchestrator (`api-orchestrator.js`)

Coordinatore centrale per tutte le operazioni AI.

```javascript
// Punto di ingresso unico per chiamate AI
APIOrchestrator.generateCompletion(provider, apiKey, systemPrompt, userPrompt, options)
```

**Funzionalità**:
- Interfaccia agnostica rispetto al provider
- Selezione automatica modello per provider
- Gestione formato risposta (JSON, testo)
- Gestione temperatura e limite token

#### ProviderCaller (`provider-caller.js`)

Client HTTP di basso livello per ogni provider AI.

**Provider Supportati**:
- **Groq**: Llama 3.3 70B (veloce, tier gratuito)
- **OpenAI**: GPT-4o (alta qualità)
- **Anthropic**: Claude Sonnet 4.5 (miglior ragionamento)
- **Gemini**: Gemini 2.5 Pro (contesto ampio)

**Funzionalità**:
- Protezione timeout fetch (60s)
- Validazione risposta JSON
- Gestione errori specifica per provider
- Rilevamento rate limit (le risposte HTTP 429 diventano `[RATE_LIMIT:Provider]`, mappato in un messaggio chiaro)

#### Completion client (`completion-client.js`)

Punto di ingresso usato dalle pagine dell'estensione per le chiamate LLM dirette.

```javascript
const text = await requestCompletion(provider, systemPrompt, userPrompt, { temperature, maxTokens, responseFormat: 'json' })
```

**Funzionalità**:
- Usato da multi-analisi (riassunto globale, confronto, Q&A, correlazione), classificazione del contenuto nel popup, analisi PDF e Q&A multi-articolo
- Invia l'azione `generateCompletion` al service worker, quindi le pagine non leggono mai la API key
- `handleGenerateCompletion` (`src/background/message-handlers.js`) legge la chiave, inoltra solo `temperature`, `maxTokens` e `responseFormat: 'json'` e chiama `APIOrchestrator.generateCompletion`
- Il router (`message-router.js`) accetta l'azione solo se `sender.url` inizia con `browser.runtime.getURL('')` (pagine dell'estensione, non content script)

#### PromptBuilder (`prompt-builder.js`)

Costruisce prompt ottimizzati per ogni provider e tipo di contenuto.

**Capacità**:
- Prompt specifici per tipo di contenuto (news, scientifico, tutorial, business, opinione)
- Supporto multi-lingua (5 lingue)
- Difesa da prompt injection (integrata nei system prompt)
- Numerazione paragrafi per matching citazioni

#### ContentDetector (`content-detector.js`)

Analizza il contenuto dell'articolo per determinare tipo e lingua.

**Metodi di Rilevamento**:
- **Tipo Contenuto**: Algoritmo basato su scoring che analizza parole chiave e pattern
- **Lingua**: Pattern matching su parole comuni (supporta 5 lingue)

**Tipi di Contenuto**:
- `scientific`: Paper accademici, articoli di ricerca
- `news`: Articoli di notizie, breaking news
- `tutorial`: Guide how-to, documentazione tecnica
- `business`: Analisi business, report di mercato
- `opinion`: Editoriali, pezzi di opinione
- `general`: Fallback predefinito

### 4. Gestione Errori

**Posizione**: `src/utils/core/error-handler.js`

Il sistema non ritenta le richieste fallite e non cambia provider in caso di errore. Ogni chiamata ha un timeout di 60 secondi (`AbortController` in `provider-caller.js`) e il fallimento viene comunicato all'utente con un messaggio utile.

#### ErrorHandler (`error-handler.js`)

**Funzionalità**:
- `getErrorMessage` è idempotente: un messaggio già mappato (in qualunque lingua) viene riconosciuto e ri-renderizzato nella lingua corrente. Serve perché il service worker invia alle pagine messaggi già mappati
- `classifyError` conserva il tipo di errore (`missing_key`, `unsupported_page`, `page_unreachable`, `generic`), che decide l'azione di recupero proposta dalla UI
- Le risposte HTTP 429 emergono come `[RATE_LIMIT:Provider]` e diventano un messaggio chiaro

### 5. Sistema di Storage

**Posizione**: `src/utils/storage/`

Gestione storage con caching e storico. I dati sono salvati in `browser.storage.local`, non compressi.

#### StorageManager (`storage-manager.js`)

Interfaccia principale per le operazioni di storage del browser.

**Dati Memorizzati**:
- API key (per provider)
- Impostazioni utente (provider, lingua, tipo contenuto)
- Preferenza lingua UI
- Statistiche utilizzo

**Nota Sicurezza**: Le API key sono memorizzate in `storage.local` in chiaro, area sandboxed per estensione. Non viene usata cifratura custom perché il codice sorgente dell'estensione è sempre leggibile. Le pagine dell'estensione non leggono la chiave: le chiamate LLM passano dal service worker (`generateCompletion`).

#### CacheManager (`cache-manager.js`)

Caching risposte con TTL e statistiche.

**Strategia Cache**:
- Chiave: `${url}_${provider}_${language}_${contentType}`
- TTL: 24 ore (configurabile)
- Scadenza automatica
- Eviction LRU quando storage è pieno

**Statistiche Tracciate**:
- Rapporto hit/miss
- Dimensione cache
- Età entry
- Log operazioni

#### Ripristino dati compressi (`compressed-data-recovery.js`)

Le versioni precedenti comprimevano riassunti dello storico e voci di cache (LZ-String). La compressione non esiste più; questo modulo ripara i dati che ha lasciato.

**Comportamento**:
- `restoreCompressedData` viene eseguito da `AutoMaintenance.initialize()` a ogni avvio del service worker, indipendentemente da `autoCleanup`
- Decodifica i riassunti compressi dello storico e rimuove i marcatori di compressione; le voci non decodificabili restano intatte
- Scarta le voci di cache compresse (la cache si ricostruisce alla richiesta successiva)
- `lz-string` resta dipendenza solo per questo scopo

#### AutoMaintenance (`src/utils/core/auto-maintenance.js`)

**Manutenzione Automatica** (ogni 24 ore via browser alarms, se `autoCleanup` è attivo):
- Rimuove le voci di cache scadute
- Mantiene la cache a 100 voci (LRU)
- Elimina i riassunti più vecchi di 180 giorni, **esclusi i preferiti**

Il pulsante "Esegui Cleanup Ora" in Opzioni > Avanzate esegue la stessa eliminazione a 180 giorni (preferiti esclusi) e il taglio LRU.

#### HistoryManager (`history-manager.js`)

Facade per tre repository storici specializzati.

**Repository**:
1. **ArticleHistory**: Analisi articoli web
2. **PDFHistory**: Analisi documenti PDF
3. **MultiAnalysisHistory**: Confronti multi-articolo

`HistoryManager.importPDFAnalysis` (che delega a `PDFHistory.importPDFAnalysis`) ripristina un'analisi PDF da un backup mantenendo id e timestamp, quindi reimportare lo stesso file non crea duplicati.

**Funzionalità**:
- Ricerca e filtraggio
- Sistema preferiti
- Note e annotazioni
- Export/import (backup JSON, incluse le analisi PDF)

**Formato backup** (`src/pages/history/io-backup.js`, `backup-rules.js`): il file JSON contiene `data.singleArticles`, `data.multiAnalysis`, `data.pdfAnalysis`, `settings` e `stats`, più `metadata.totalPDFAnalysis`. L'import sanifica i campi di testo e accetta file fino a 50 MB.

### 6. Sistema di Sicurezza

**Posizione**: `src/utils/security/`

Architettura di sicurezza multi-livello.

#### HtmlSanitizer (`html-sanitizer.js`)

Previene XSS sanitizzando tutto il contenuto prima dell'inserimento nel DOM.

**Metodi**:
- `escape()`: Escapa caratteri speciali HTML
- `renderText()`: Rendering testo sicuro con preservazione paragrafi
- `renderList()`: Rendering lista sicuro per punti chiave, citazioni, Q&A

**Utilizzo**:
```javascript
// MAI usare innerHTML direttamente con contenuto AI
element.innerHTML = aiResponse; // ❌ PERICOLOSO

// SEMPRE usare HtmlSanitizer
HtmlSanitizer.renderText(aiResponse, element); // ✅ SICURO
```

#### InputSanitizer (`input-sanitizer.js`)

Pulisce e valida testo prima dell'invio alle API AI.

**Passaggi Sanitizzazione**:
1. Rimuovi tag HTML e script
2. Rimuovi URL (opzionale)
3. Rimuovi citazioni (opzionale)
4. Normalizza spazi bianchi
5. Rimuovi caratteri di controllo
6. Escapa tentativi prompt injection
7. Valida lunghezza (min/max)
8. Tronca se necessario

**Difesa Prompt Injection**:
- Rileva pattern injection comuni
- Escapa terminatori system prompt
- Valida struttura input

#### Content Security Policy

**CSP Manifest**:
```json
{
  "content_security_policy": {
    "extension_pages": "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; ..."
  }
}
```

**Restrizioni**:
- Nessuno script inline
- Nessun eval()
- Solo connessioni HTTPS
- Solo endpoint API whitelisted

### 7. Sistema di Export

**Posizione**: `src/utils/export/`

Capacità di export multi-formato.

#### PDFExporter (`pdf-exporter.js`)

Genera documenti PDF formattati usando jsPDF.

**Sezioni**:
- Header con metadata
- Titolo articolo e statistiche
- Riassunto
- Punti chiave (lista formattata)
- Traduzione (se disponibile)
- Q&A (se disponibile)
- Citazioni (formato APA)

#### Etichette dei documenti (`doc-labels.js`)

I documenti esportati (Markdown, PDF, email, bibliografia, testo copiato, lettura vocale) sono scritti nella lingua dell'interfaccia. `docLabel`, `docHeading`, `docDate` e `citationTypeLabel` ricavano titoli, intestazioni di sezione, date e tipi di citazione dai file di locale.

#### MarkdownExporter (`markdown-exporter.js`)

Export in formato Markdown.

**Funzionalità**:
- Gerarchia heading corretta
- Liste formattate
- Blocchi codice per citazioni
- Frontmatter metadata

#### EmailManager (`email-manager.js`)

Apre client email predefinito con contenuto pre-compilato.

**Formato**:
- Oggetto: Titolo articolo
- Corpo: Analisi formattata
- Allegati: Non supportati (limitazione browser)
- Le citazioni possono essere incluse nel messaggio da popup e storico
- `EmailManager.openEmailDraft(subject, body)` apre una bozza senza destinatario (`mailto:`); l'analisi multi-articolo la usa

### 8. Sistema PDF

**Posizione**: `src/utils/pdf/`

Pipeline parsing e analisi PDF.

#### PDFAnalyzer (`pdf-analyzer.js`)

Coordinatore principale elaborazione PDF.

**Pipeline**:
1. Validazione file (dimensione, tipo, protezione password)
2. Controllo cache (per hash file)
3. Estrazione testo (pdfjs-dist)
4. Analisi AI (come articoli)
5. Storage cache

**Funzionalità**:
- Limite dimensione file 20MB
- Hashing file SHA-256 per chiavi cache
- Callback progresso per aggiornamenti UI
- Gestione cache automatica

#### PDFCacheManager (`pdf-cache-manager.js`)

Cache specializzata per analisi PDF.

**Chiave Cache**: Hash SHA-256 del contenuto file

**Benefici**:
- Stesso PDF analizzato una volta (anche con nome file diverso)
- Risultati istantanei per ri-upload
- Le entry obsolete vengono scartate alla scadenza della cache

### 9. Internazionalizzazione (i18n)

**Posizione**: `src/utils/i18n/`

Sistema i18n. Ogni testo visibile all'utente passa da `I18n.t` / `I18n.tf`.

#### I18n (`i18n.js`)

Manager i18n principale.

**Lingue d'interfaccia** (selezionabili):
- Italiano (it) - Predefinito
- Inglese (en)

I file di locale per spagnolo (es), francese (fr) e tedesco (de) sono parziali: una chiave mancante ricade sull'italiano.

Il service worker carica la lingua da `storage.local.uiLanguage` e segue i cambi (`src/background/ui-language.js`), così i messaggi che produce coincidono con l'interfaccia.

**Funzionalità**:
- Traduzioni basate su JSON (`locales/*.json`)
- Aggiornamenti UI automatici al cambio lingua
- Sostituzione placeholder (`{variabile}`)
- Lingua UI e lingua output AI separate

**Utilizzo**:
```javascript
// Traduzione semplice
I18n.t('chiave')

// Con placeholder
I18n.tf('saluto', { nome: 'Andrea' })

// Aggiorna tutti gli elementi UI
I18n.updateUI()
```

**Integrazione HTML**:
```html
<button data-i18n="analyze_button">Analizza</button>
<input data-i18n="search_placeholder" placeholder="Cerca...">
<span data-i18n-title="tooltip_text" title="Tooltip">Icona</span>
```

### 10. Sistema Vocale

**Posizione**: `src/utils/voice/`

Integrazione Text-to-Speech e Speech-to-Text.

#### VoiceController (`voice-controller.js`)

Coordina manager TTS e STT.

**Funzionalità**:
- Supporto voce multi-lingua
- Controlli play/pause/stop
- Input vocale per Q&A
- Mappatura codici lingua (output → voce)

#### TTSManager (`tts-manager.js`)

Wrapper della Web Speech API (`window.speechSynthesis`).

**Funzionalità**:
- Selezione voce per lingua
- Controllo velocità e tono
- Gestione stato riproduzione
- Notifiche basate su eventi

#### STTManager (`stt-manager.js`)

Wrapper Web Speech API.

**Funzionalità**:
- Riconoscimento continuo
- Risultati intermedi
- Cambio lingua
- Gestione errori

---

## Flusso dei Dati

### Flusso Analisi Articolo

```
1. Utente clicca icona estensione su pagina articolo
   ↓
2. Content script estrae articolo usando Readability
   ↓
3. Content script invia dati articolo al service worker
   ↓
4. Service worker valida e sanitizza input
   ↓
5. APIOrchestrator controlla cache
   ↓
6. Se cache miss:
   a. ContentDetector analizza tipo articolo e lingua
   b. PromptBuilder costruisce prompt ottimizzato
   c. ProviderCaller chiama il provider (timeout 60s, un solo tentativo)
   d. ResponseParser estrae riassunto e punti chiave
   e. CacheManager memorizza risultato
   ↓
7. Service worker invia risultato al popup
   ↓
8. Popup renderizza con HtmlSanitizer
   ↓
9. HistoryManager salva nello storico
```

### Flusso Analisi PDF

```
1. Utente carica PDF nella pagina PDF Analysis
   ↓
2. PDFAnalyzer valida file (dimensione, tipo, password)
   ↓
3. PDFCacheManager controlla cache per hash file
   ↓
4. Se cache miss:
   a. pdfjs-dist estrae testo da tutte le pagine
   b. Testo viene validato (minimo 100 caratteri)
   c. APIOrchestrator analizza testo (come articoli)
   d. PDFCacheManager memorizza risultato con hash file
   ↓
5. Risultato visualizzato nella pagina PDF Analysis
   ↓
6. PDFHistory salva nello storico
```

### Flusso Analisi Multi-Articolo

```
1. Utente seleziona 2+ articoli dallo storico
   ↓
2. MultiAnalysisManager valida selezione
   ↓
3. Prompt costruito combinando tutti i riassunti articoli
   ↓
4. requestCompletion invia `generateCompletion` al service worker, che genera l'analisi comparativa
   ↓
5. Risultato visualizzato nella pagina Multi-Analysis
   ↓
6. MultiAnalysisHistory salva nello storico
```

---

## Integrazione AI

### Architettura Provider

Ogni provider ha un metodo caller dedicato in `ProviderCaller`:

```javascript
// Compatibile OpenAI (Groq, OpenAI)
callOpenAICompatible(apiKey, systemPrompt, userPrompt, options, url, providerName)

// Anthropic (Claude)
callAnthropicCompletion(apiKey, systemPrompt, userPrompt, options)

// Google Gemini
callGeminiCompletion(apiKey, systemPrompt, userPrompt, options)
```

### Prompt Engineering

**Struttura System Prompt**:
1. Definizione ruolo
2. Descrizione task
3. Specifica formato output
4. Istruzioni specifiche tipo contenuto
5. Enforcement lingua
6. Difesa prompt injection

**Struttura User Prompt**:
1. Metadata articolo (titolo, URL, conteggio parole)
2. Paragrafi numerati per matching citazioni
3. Istruzioni specifiche basate su task

### Parsing Risposta

**Formato Atteso**:
```
## RIASSUNTO
[Testo riassunto]

## PUNTI CHIAVE
1. **Titolo** (§1-3) Descrizione
2. **Titolo** (§5) Descrizione
...
```

**Parser** (`response-parser.js`):
- Divide su marker `## PUNTI CHIAVE`
- Estrae riassunto dalla prima sezione
- Estrazione punti chiave basata su regex
- Valida lunghezza minima contenuto

---

## Strategia di Storage

### Quota Storage

- **Area**: `browser.storage.local` (l'estensione non richiede `unlimitedStorage`)
- **Strategia**: Caching + pulizia automatica

### Allocazione Storage

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

### Manutenzione Automatica

- Esegue ogni 24 ore via browser alarms se `autoCleanup` è attivo
- Rimuove le voci di cache scadute e riduce la cache a 100 voci (LRU)
- Elimina i riassunti più vecchi di 180 giorni; i preferiti vengono sempre conservati
- `restoreCompressedData` gira a ogni avvio del service worker, indipendentemente da `autoCleanup`

---

## Architettura di Sicurezza

### Livelli di Difesa

1. **Validazione Input**: Tutto l'input utente sanitizzato prima dell'elaborazione
2. **Sanitizzazione Output**: Tutte le risposte AI sanitizzate prima dell'inserimento DOM
3. **CSP**: Content Security Policy stretta previene script inline
4. **Difesa Prompt Injection**: Rilevamento e escaping multi-lingua
5. **Protezione API Key**: Memorizzate in `browser.storage.local`, sandboxed per estensione (in chiaro, senza cifratura)
6. **Solo HTTPS**: Tutte le chiamate API su HTTPS
7. **Validazione Origine**: Messaggi validati per ID mittente

### Modello di Minaccia

**Minacce Mitigate**:
- XSS via risposte AI
- Attacchi prompt injection
- Furto API key
- Content script malevoli
- Attacchi CSRF

**Minacce Non Mitigate**:
- Utente installa estensione malevola
- Profilo Firefox utente compromesso
- Provider API compromesso

---

## Ottimizzazioni delle Prestazioni

### Strategia Caching

- **Chiave Cache**: `${url}_${provider}_${language}_${contentType}`
- **TTL**: 24 ore
- **Eviction**: LRU quando storage è pieno
- **Hit Rate**: ~40-60% per utilizzo tipico

### Lazy Loading

- **Pagina Storico**: Carica entry in batch di 20
- **Anteprima PDF**: Renderizza on-demand
- **Voce**: Carica voci solo quando necessario

### Debouncing

- **Ricerca**: debounce di 300ms sul campo di ricerca della cronologia

### Ottimizzazione Richieste

- **Timeout**: Timeout 60s (`AbortController`) previene richieste bloccate
- **Rate limit**: nessun limiter lato client; un HTTP 429 del provider viene mappato in un messaggio chiaro

---

## Punti di Estensione

### Aggiungere un Nuovo Provider AI

1. Aggiungi provider a `DEFAULT_MODELS` in `api-orchestrator.js`
2. Implementa metodo caller in `provider-caller.js`
3. Aggiorna `host_permissions` nel manifest
4. Aggiungi opzione UI nelle impostazioni

### Aggiungere una Nuova Lingua

1. Crea `locales/{lang}.json` con traduzioni
2. Importa in `i18n.js`
3. Aggiungi a `LANGUAGE_CONFIGS` in `prompt-builder.js`
4. Aggiungi a `LANGUAGE_TEMPLATES` in `prompt-builder.js`
5. Aggiungi pattern rilevamento in `content-detector.js`
6. Aggiorna selettore lingua UI

### Aggiungere un Nuovo Tipo di Contenuto

1. Aggiungi logica rilevamento in `content-detector.js`
2. Crea system prompt in `prompts/summary-prompts.js`
3. Aggiungi a `PromptRegistry` in `prompt-registry.js`
4. Aggiorna selettore tipo contenuto UI

---

## Strategia di Testing

### Test Unitari

**Framework**: Vitest + jsdom

**Copertura**:
- Utility AI (costruzione prompt, parsing, rilevamento)
- Manager storage (cache, ripristino dati compressi, storico)
- Sicurezza (sanitizer, validator)
- Formatter export

**Esegui Test**:
```bash
npm run test        # Esecuzione singola
npm run test:watch  # Modalità watch
```

### Test Manuali

**Scenari di Test**:
1. Analisi articolo su vari tipi di contenuto
2. Upload e analisi PDF
3. Confronto multi-articolo
4. Estrazione traduzione e citazioni
5. Export in PDF/Markdown/Email
6. Controlli vocali (TTS/STT)
7. Ricerca e filtraggio storico
8. Persistenza impostazioni
9. Gestione errori e messaggi di errore
10. Cache e manutenzione automatica

---

## Deployment

### Processo di Build

```bash
npm run build
```

**Output**: Cartella `dist/` con:
- JavaScript minificato
- CSS ottimizzato
- Asset copiati
- Manifest aggiornato

### Pacchettizzazione e Distribuzione (Firefox)

1. Costruisci versione produzione (`npm run build`)
2. Genera il pacchetto con `npm run build:xpi` (esegue la build, poi `web-ext build` in `web-ext-artifacts/`)
3. Per il test locale: `about:debugging#/runtime/this-firefox` → Carica componente aggiuntivo temporaneo → seleziona `dist/manifest.json`, oppure `npm run start:firefox` (`web-ext run`)
4. Carica il pacchetto sul Developer Hub di addons.mozilla.org (AMO)
5. Compila il listing (descrizione, screenshot, privacy policy) e invia per revisione

### Gestione Versioni

**Semantic Versioning**: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: Nuove funzionalità
- **PATCH**: Bug fix

**Processo Aggiornamento**:
1. Aggiorna versione in `package.json` e `manifest.json`
2. Aggiorna `CHANGELOG.md`
3. Build e test
4. Commit e tag
5. Carica su addons.mozilla.org (AMO)

---

## Monitoraggio e Debugging

### Logging

**Logger** (`src/utils/core/logger.js`):
- Logging strutturato con livelli (info, warn, error)
- Timestamp automatico
- Output console color-coded
- Modalità produzione disabilita log debug

### Telemetria

**Metriche Tracciate**:
- Tassi successo/fallimento chiamate API
- Rapporti hit/miss cache
- Distribuzione utilizzo provider
- Tempo medio generazione

**Storage**: `browser.storage.local.stats`

### Debugging

**Strumenti per sviluppatori di Firefox**:
- Background script: `about:debugging#/runtime/this-firefox` → Ispeziona sull'estensione
- Popup: Click destro icona estensione → Ispeziona (oppure apri la pagina del popup da `about:debugging`)
- Content Script: Ispeziona pagina → Console → Filtra per ID estensione

**Problemi Comuni**:
- Errori API key: Controlla pagina impostazioni
- Problemi cache: Pulisci cache nella pagina storico
- Storage pieno: Elimina vecchie entry o pulisci storico
- Timeout provider: Controlla connessione rete

---

## Miglioramenti Futuri

### Funzionalità Pianificate

1. **Modalità Offline**: Supporto LLM locale (WebLLM)
2. **Annotazioni Collaborative**: Condividi analisi con team
3. **Browser Sync**: Sincronizza storico tra dispositivi
4. **Prompt Personalizzati**: Template prompt definiti dall'utente
5. **Analytics Avanzate**: Pattern di lettura e insights
6. **Estensione Browser**: Supporto per i browser Chromium (Chrome, Edge)

### Debito Tecnico

1. **Copertura Test**: Aumentare a 80%+
2. **Migrazione TypeScript**: Aggiungere type safety
3. **Performance**: Ottimizzare gestione PDF grandi
4. **Accessibilità**: Conformità WCAG 2.1 AA
5. **Documentazione**: Docs riferimento API

---

## Contribuire

Vedi [CONTRIBUTING.md](CONTRIBUTING.md) per linee guida sviluppo.

---

## Licenza

Apache License 2.0 - Vedi [LICENSE](../../LICENSE) per dettagli.
