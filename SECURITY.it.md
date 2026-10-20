# Panoramica Sicurezza

> **Lingua:** [English](SECURITY.md) | Italiano

Questo documento descrive l'architettura di sicurezza e le misure di protezione implementate in AI Article Summarizer. È pensato per gli utenti che vogliono capire come i loro dati e la loro navigazione vengono protetti, e per gli sviluppatori che valutano il codebase.

---

## Indice

- [Principi Architetturali](#principi-architetturali)
- [Prevenzione XSS](#prevenzione-xss)
- [Sanitizzazione Input](#sanitizzazione-input)
- [Difesa contro Prompt Injection](#difesa-contro-prompt-injection)
- [Content Security Policy](#content-security-policy)
- [Permessi dell'Estensione](#permessi-dellestensione)
- [Sicurezza del Message Passing](#sicurezza-del-message-passing)
- [Gestione delle API Key](#gestione-delle-api-key)
- [Sicurezza di Rete](#sicurezza-di-rete)
- [Sandboxing degli Iframe](#sandboxing-degli-iframe)
- [Estrazione Contenuti Sicura](#estrazione-contenuti-sicura)
- [Gestione Errori e Protezione delle Informazioni](#gestione-errori-e-protezione-delle-informazioni)
- [Sicurezza dello Storage](#sicurezza-dello-storage)
- [Sicurezza delle Esportazioni](#sicurezza-delle-esportazioni)
- [Validazione Import Backup](#validazione-import-backup)
- [Gestione delle Dipendenze](#gestione-delle-dipendenze)
- [Pipeline CI/CD](#pipeline-cicd)
- [Segnalare una Vulnerabilità](#segnalare-una-vulnerabilità)

---

## Principi Architetturali

L'estensione segue una strategia di **difesa in profondità** con layer di protezione multipli e indipendenti. La compromissione di un layer non compromette automaticamente gli altri.

| Principio | Implementazione |
|---|---|
| **Privilegio Minimo** | Permessi minimali; nessun `<all_urls>` |
| **Validazione ai Confini** | Tutti i dati esterni sanitizzati prima dell'uso |
| **Separazione delle Responsabilità** | Il content script non ha accesso alle API key; tutte le chiamate LLM passano dal service worker |
| **Fallimento Sicuro** | Gli errori producono messaggi user-friendly; nessun dato sensibile viene esposto |
| **Nessun Segreto nel Codice** | Le API key sono in `browser.storage.local` sandboxato, mai nel codice sorgente |

---

## Prevenzione XSS

**Modulo:** `src/utils/security/html-sanitizer.js`

Tutto il contenuto dinamico inserito nel DOM passa attraverso `HtmlSanitizer.escape()`, che utilizza il meccanismo di escaping nativo del browser:

```javascript
static escape(text) {
  const div = document.createElement('div');
  div.textContent = text;     // il browser esegue l'escape automaticamente
  return div.innerHTML;       // restituisce entità HTML sicure
}
```

Questo pattern è applicato in modo sistematico a:
- Titoli degli articoli, autori, URL
- Riassunti e punti chiave generati dall'AI
- Citazioni e risposte Q&A
- Voci della cronologia e badge dei metadati
- Output delle traduzioni
- Attributi `data-id` nei template innerHTML

Metodi di rendering dedicati (`renderText()`, `renderList()`) costruiscono HTML da frammenti pre-escaped, prevenendo l'injection anche nella composizione di strutture complesse.

---

## Sanitizzazione Input

**Modulo:** `src/utils/security/input-sanitizer.js`

Una pipeline multi-stadio sanitizza tutto il testo fornito dall'utente e estratto dal web prima che raggiunga il provider AI:

| Stadio | Scopo |
|---|---|
| **Rimozione tag HTML** | Rimuove `<script>`, `<style>`, `<noscript>` e tutti i tag rimanenti |
| **Rimozione URL** | Rimuove opzionalmente gli URL per ridurre il rumore |
| **Rimozione caratteri di controllo** | Rimuove i caratteri di controllo ASCII (0x00-0x1F, 0x7F) |
| **Escaping prompt injection** | Rileva e neutralizza i pattern di injection (vedi sotto) |
| **Validazione lunghezza** | Impone limiti min/max per prevenire input vuoti o sovradimensionati |

Un metodo non distruttivo `validate()` è disponibile anche per controllare gli input senza modificarli.

---

## Difesa contro Prompt Injection

**Modulo:** `src/utils/security/input-sanitizer.js` — `escapePromptInjection()`

L'estensione si difende dal prompt injection con un approccio a tre fasi:

### 1. Normalizzazione Unicode
Il testo viene normalizzato in **forma NFKC** prima del pattern matching, prevenendo tecniche di bypass Unicode (es. caratteri a larghezza piena o omoglifi).

### 2. Rimozione Caratteri Zero-Width
I seguenti caratteri invisibili vengono rimossi:
- Spazio zero-width (U+200B)
- Non-joiner/joiner zero-width (U+200C-U+200D)
- Segni left-to-right/right-to-left (U+200E-U+200F)
- Separatori di riga/paragrafo (U+2028-U+2029)
- Vari controlli di embedding (U+202A-U+202F)
- Byte order mark (U+FEFF)
- Trattino morbido (U+00AD)

### 3. Rilevamento Pattern Multi-Lingua
I pattern di injection vengono rilevati in **cinque lingue**:

| Lingua | Esempi di Pattern |
|---|---|
| Inglese | "ignore previous instructions", "disregard all prior context" |
| Italiano | "ignora istruzioni precedenti", "dimentica istruzioni" |
| Francese | "ignorer instructions precedentes", "oublie instructions" |
| Spagnolo | "ignora instrucciones anteriores", "olvida instrucciones" |
| Tedesco | "ignoriere vorherige anweisungen", "vergiss anweisungen" |

Vengono inoltre rilevati e rimossi i token speciali usati dai sistemi LLM: `system:`, `assistant:`, `user:`, `<|...|>`, `[INST]`, `[/INST]`.

L'input Q&A dell'utente è inoltre limitato a **2.000 caratteri** tramite `sanitizeUserPrompt()`.

---

## Content Security Policy

**File:** `manifest.json`

L'estensione applica una CSP restrittiva su tutte le pagine dell'estensione:

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

| Direttiva | Scopo |
|---|---|
| `default-src 'none'` | Approccio whitelist; tutto bloccato se non esplicitamente consentito |
| `script-src 'self'` | Solo gli script dell'estensione possono eseguire; nessun inline script, nessun `eval()` |
| `'wasm-unsafe-eval'` | Richiesto da PDF.js per il parsing basato su WebAssembly |
| `connect-src` | Richieste di rete limitate ai quattro provider LLM |
| `object-src 'none'` | Blocca Flash, applet Java e altri contenuti plugin |
| `frame-src https:` | Iframe limitati a HTTPS (usato per la vista originale degli articoli) |

---

## Permessi dell'Estensione

**File:** `manifest.json`

L'estensione richiede solo i permessi strettamente necessari per le sue funzionalità:

| Permesso | Scopo | Ambito |
|---|---|---|
| `activeTab` | Accedere al tab corrente per estrarre il contenuto dell'articolo | Solo il tab attivo, solo al click |
| `storage` | Salvare impostazioni, cronologia e cache localmente | Storage sandboxato per estensione |
| `tts` | Text-to-speech per leggere i riassunti ad alta voce | Solo sintesi locale |
| `alarms` | Schedulare la manutenzione automatica della cache | Solo timing interno |

### Permessi Host

L'accesso di rete è limitato ai quattro endpoint dei provider LLM:

```
https://api.groq.com/*
https://api.openai.com/*
https://api.anthropic.com/*
https://generativelanguage.googleapis.com/*
```

L'estensione **non** richiede `<all_urls>`, `tabs`, `webRequest`, `cookies`, `clipboard`, `downloads`, `debugger`, né alcun altro permesso ampio.

### Esclusioni del Content Script

Il content script è esplicitamente escluso dalle pagine sensibili:

```json
"exclude_matches": [
  "https://accounts.google.com/*",
  "*://*.bank*/*"
]
```

---

## Sicurezza del Message Passing

**Modulo:** `src/background/service-worker.js`

Tutta la comunicazione tra componenti (popup, content script, service worker) viene validata:

### Verifica del Mittente
Ogni messaggio in ingresso viene controllato rispetto all'ID dell'estensione:

```javascript
if (sender.id !== browser.runtime.id) {
  return false;
}
```

Questo impedisce ad altre estensioni o pagine web di inviare messaggi al service worker.

### Whitelist dei Provider
Una whitelist rigorosa basata su `Set` valida i nomi dei provider prima di qualsiasi operazione API:

```javascript
const VALID_PROVIDERS = new Set(['groq', 'openai', 'anthropic', 'gemini']);
```

I provider non validi vengono rifiutati immediatamente con una risposta di errore, prima che qualsiasi operazione asincrona inizi.

### Filtraggio dei Messaggi di Errore
Tutte le risposte di errore inviate attraverso il canale di comunicazione passano attraverso `ErrorHandler.getErrorMessage()`, che mappa gli errori tecnici in messaggi user-friendly — prevenendo la fuga di informazioni attraverso le risposte di errore.

---

## Gestione delle API Key

**Modulo:** `src/utils/storage/storage-manager.js`

### Storage
Le API key sono salvate in `browser.storage.local`, che è automaticamente sandboxato da Firefox: ogni estensione ha la propria area di storage isolata a cui altre estensioni e pagine web non possono accedere.

### Perché Non Crittografato?
Le chiavi sono salvate in chiaro in `storage.local`: non esiste un livello di crittografia.

L'estensione deliberatamente **non** applica crittografia custom alle chiavi memorizzate. Il ragionamento:

> In un'estensione del browser, il codice sorgente è sempre leggibile (le estensioni sono distribuite come JavaScript in chiaro). Qualsiasi chiave di crittografia o algoritmo incorporato nel codice non offre protezione significativa: un attaccante con accesso allo storage dell'estensione ha anche accesso alla logica di decrittazione. Il sandboxing di `browser.storage.local` è il vero confine di sicurezza.

### Isolamento
- Le API key non sono **mai** accessibili dal content script
- Tutte le chiamate LLM passano dal **service worker**, che recupera le chiavi direttamente dallo storage
- Le chiavi non vengono **mai** trasmesse nei messaggi runtime (tranne durante il flusso di test iniziale, che legge dal campo di input appena inserito)
- Le pagine dell'estensione (analisi multi-articolo, analisi PDF, classificazione del contenuto nel popup) non leggono mai la chiave: chiamano `requestCompletion()` (`src/utils/ai/completion-client.js`), che invia l'azione `generateCompletion` al service worker. L'handler (`handleGenerateCompletion` in `src/background/message-handlers.js`) legge la chiave dentro il worker, inoltra solo `temperature`, `maxTokens` e `responseFormat: 'json'`, e chiama `APIOrchestrator.generateCompletion`
- Il router dei messaggi (`src/background/message-router.js`) accetta `generateCompletion` solo se `sender.url` inizia con l'URL dell'estensione (`browser.runtime.getURL('')`), quindi i content script, che condividono l'ID dell'estensione, non possono usare le chiavi dell'utente
- Le chiavi sono **mascherate** nell'interfaccia Opzioni (mostrando solo gli ultimi 4 caratteri)

---

## Sicurezza di Rete

**Modulo:** `src/utils/ai/provider-caller.js`

### Timeout Forzato
Ogni chiamata API ha un **timeout di 60 secondi** imposto tramite `AbortController`:

```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000);
```

Il timeout viene sempre cancellato in un blocco `finally` per prevenire perdite di risorse.

### Errori dei Provider e Rate Limit
Non esistono retry automatico, fallback fra provider né rate limiter lato client: una chiamata fallita viene riportata all'utente così com'è. La risposta HTTP 429 di un provider diventa `[RATE_LIMIT:Provider]` e `ErrorHandler` la mappa in un messaggio che suggerisce di cambiare chiave API o provider nelle impostazioni.

---

## Sandboxing degli Iframe

**File:** `src/pages/reading-mode/reading-mode.html`, `display.js`

L'iframe della modalità lettura (usato per visualizzare l'articolo originale) è sandboxato al massimo:

```html
<iframe sandbox="" referrerpolicy="no-referrer"></iframe>
```

`sandbox=""` (vuoto) blocca:
- Esecuzione JavaScript
- Invio di form
- Pop-up e modali
- Accesso same-origin all'estensione
- Download e plugin

### Validazione URL
Prima di caricare qualsiasi URL nell'iframe, il protocollo viene validato contro una whitelist (`https:`, `http:`). Gli URL con protocolli `javascript:`, `data:` o `file:` vengono rifiutati, e l'interfaccia passa alla vista testo sicura.

---

## Estrazione Contenuti Sicura

**Modulo:** `src/utils/core/content-extractor.js`

### Rimozione Rumore a Livello DOM
Prima di estrarre il testo dell'articolo, i seguenti elementi vengono rimossi dal clone del DOM:
- Script, stili, iframe, form
- Navigazione, header, footer, sidebar
- Pubblicità, paywall, blocchi abbonamento, banner cookie
- Widget di condivisione social, newsletter, popup
- Contenuti correlati/consigliati

### Rilevamento Pattern a Livello Testo
I paragrafi che corrispondono a pattern di rumore noti vengono filtrati:
- Testo di pricing e abbonamento (multi-valuta, multi-lingua)
- Contenuti promozionali e call-to-action
- Richieste di consenso cookie e login
- Offerte di prova gratuita e cancellazione

### Deduplicazione
I paragrafi quasi identici (comuni nei contenuti ripetuti dai paywall) vengono deduplicati tramite confronto testuale normalizzato prima dell'invio all'AI.

---

## Gestione Errori e Protezione delle Informazioni

**Modulo:** `src/utils/core/error-handler.js`

### Messaggi di Errore per l'Utente
I messaggi di errore tecnici non vengono **mai** mostrati direttamente agli utenti. `ErrorHandler.getErrorMessage()` mappa ogni categoria di errore a un messaggio sicuro e azionabile:

| Errore Tecnico | Messaggio Utente |
|---|---|
| HTTP 401/Unauthorized | "API key non valida. Verifica la configurazione nelle impostazioni." |
| HTTP 429/Too Many Requests | "Rate limit raggiunto. La tua chiave API ha esaurito le richieste disponibili. [...]" |
| Errori Network/fetch | "Errore di connessione. Verifica la tua connessione internet." |
| Pagine non supportate (pagine `about:`, siti `http:`; si legge solo `https:`) | "Questa pagina non si può riassumere: l'estensione legge gli articoli dei siti https. [...]" |
| QUOTA_BYTES | "Spazio di archiviazione esaurito. Pulisci la cache nelle impostazioni." |
| Errori non riconosciuti | "Si è verificato un errore imprevisto. Riprova." |

I messaggi sono mostrati nella lingua corrente dell'interfaccia (italiano o inglese; sopra il testo italiano). `getErrorMessage()` è idempotente: un messaggio già mappato, in qualunque lingua, viene riconosciuto e ri-renderizzato nella lingua corrente, ed è ciò che permette al service worker di inviare alle pagine messaggi già mappati.

### Privacy dei Log di Errore
I log degli errori memorizzati per la diagnostica seguono regole di privacy rigide:
- I **messaggi originali** sono troncati a 200 caratteri
- Gli **stack trace** mantengono solo i primi 5 frame
- Gli **URL** sono privati dei parametri di query e dei fragment (solo `origin + pathname`)
- **Nessuna API key** o dato personale viene mai registrato
- I log vengono ruotati a 50 voci (FIFO)

---

## Sicurezza dello Storage

**Moduli:** `src/utils/storage/cache-store.js`, `base-history-repository.js`, `compressed-data-recovery.js`

### Dati Compressi Precedenti
Cronologia e cache sono salvate come JSON semplice in `browser.storage.local`; IndexedDB non è usato. I riassunti compressi da versioni precedenti vengono decodificati con LZ-string e le voci di cache compresse da versioni precedenti vengono scartate da `restoreCompressedData()`, eseguita a ogni avvio del service worker.

### Protezione Quota
- `_safeStorageSet()` cattura gli errori `QUOTA_BYTES` e fornisce un messaggio azionabile all'utente
- La manutenzione automatica viene eseguita ogni 24 ore tramite `browser.alarms` quando la pulizia automatica è attiva: rimozione delle cache scadute, cache limitata a 100 voci (LRU) ed eliminazione dei riassunti più vecchi di 180 giorni, preferiti esclusi
- Le voci della cache hanno TTL configurabile (time-to-live) con eviction automatica

### Isolamento dello Storage
Tutti i dati risiedono in `browser.storage.local`, che è:
- Sandboxato per estensione (nessun accesso cross-extension)
- Inaccessibile dalle pagine web
- Cancellato quando l'estensione viene disinstallata

---

## Sicurezza delle Esportazioni

**Modulo:** `src/utils/export/email-manager.js`

### Prevenzione Email Header Injection
Prima di costruire i link `mailto:`:
1. L'email del destinatario viene privata dei caratteri `\r`, `\n`, `\t` e `%`
2. Il formato email viene validato tramite regex
3. I titoli degli articoli hanno i newline sostituiti con spazi
4. Oggetto e corpo sono codificati con `encodeURIComponent()`

### Esportazione PDF
La generazione PDF tramite jsPDF opera interamente lato client senza chiamate di rete. Il contenuto viene escaped prima della scrittura nel documento PDF.

---

## Validazione Import Backup

**Modulo:** `src/pages/history/io-backup.js`

L'importazione di dati di backup da file JSON passa attraverso una pipeline di validazione completa:

| Controllo | Dettaglio |
|---|---|
| **Tipo file** | Deve essere JSON (tipo MIME o estensione `.json`) |
| **Dimensione file** | Massimo 50 MB per prevenire denial-of-service (i backup possono contenere il testo completo dei PDF) |
| **Parsing JSON** | Wrappato in try-catch con errore descrittivo |
| **Validazione struttura** | Deve contenere `version` (stringa) e `data` (oggetto) |
| **Validazione contenuto** | Deve includere array `singleArticles`, `multiAnalysis` o `pdfAnalysis` |
| **Sanitizzazione metadati** | Provider e tipo contenuto da whitelist; lingua validata con `/^[a-z]{2}(-[A-Z]{2})?$/` |
| **Sanitizzazione campi** | Lunghezze massime: titolo (500 char), contenuto (100 KB), estratto (1 KB); vengono sanificati anche nome e testo del PDF, note e riassunti |
| **Gestione ID** | Le voci mantengono `id` e timestamp; una voce senza `id` valido riceve un nuovo `crypto.randomUUID()` |
| **Prevenzione duplicati** | Gli ID esistenti vengono controllati prima dell'import, quindi reimportare lo stesso file non aggiunge nulla |
| **Conferma utente** | Finestra modale mostra i metadati del backup prima di procedere |

---

## Gestione delle Dipendenze

**File:** `package.json`

L'estensione utilizza un set minimale di dipendenze ben note e attivamente mantenute:

| Dipendenza | Scopo | Profilo di Sicurezza |
|---|---|---|
| `@mozilla/readability` | Estrazione contenuto articoli | Mantenuto da Mozilla, ampiamente testato |
| `jspdf` | Generazione PDF | Solo lato client, nessuna chiamata di rete |
| `lz-string` | Decodifica della cronologia compressa da versioni precedenti | JavaScript puro, nessuna dipendenza |
| `pdfjs-dist` | Parsing PDF | Mantenuto da Mozilla, sandboxato via worker |

### Override delle Vulnerabilità
Le vulnerabilità note nelle dipendenze transitive sono indirizzate tramite override npm:
```json
"overrides": {
  "rollup": ">=2.80.0"
}
```

---

## Pipeline CI/CD

**File:** `.github/workflows/ci.yml`

Ogni push e pull request attiva una pipeline automatizzata:

| Step | Scopo |
|---|---|
| `npm audit --audit-level=high` | Blocca la build se vengono trovate CVE ad alta severità nelle dipendenze |
| `npm run lint` | ESLint con regole orientate alla sicurezza (`no-eval`, `eqeqeq`) |
| `npm test` | 641 test unitari che coprono i moduli critici per la sicurezza |
| `npm run build` | Garantisce che il bundle di produzione compili senza errori |

---

## Segnalare una Vulnerabilità

Se scopri una vulnerabilità di sicurezza, per favore segnalala responsabilmente:

1. **Non** aprire una issue pubblica su GitHub
2. Invia un'email al maintainer all'indirizzo presente nel profilo GitHub: [@AndreaBonn](https://github.com/AndreaBonn)
3. Includi una descrizione della vulnerabilità, i passaggi per riprodurla e l'impatto potenziale
4. Consenti un tempo ragionevole per la correzione prima della divulgazione pubblica

Puntiamo a confermare le segnalazioni entro 48 ore e fornire una correzione entro 7 giorni per le issue critiche.

---

*Questo documento riflette lo stato della sicurezza alla versione 2.2.0 (aprile 2026).*
