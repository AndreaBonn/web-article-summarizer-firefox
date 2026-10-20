# Guida alla Contribuzione

<p align="right">
  <strong>🇮🇹 Italiano</strong> · <a href="CONTRIBUTING.md">🇺🇸 English</a>
</p>

---

## Benvenuti Contributori! 👋

Grazie per il tuo interesse nel contribuire a Web Article Summarizer! Questa guida ti aiuterà a iniziare a contribuire al progetto.

---

## Indice

- [Codice di Condotta](#codice-di-condotta)
- [Per Iniziare](#per-iniziare)
- [Setup Sviluppo](#setup-sviluppo)
- [Struttura Progetto](#struttura-progetto)
- [Workflow di Sviluppo](#workflow-di-sviluppo)
- [Standard di Codifica](#standard-di-codifica)
- [Linee Guida Testing](#linee-guida-testing)
- [Linee Guida Commit](#linee-guida-commit)
- [Processo Pull Request](#processo-pull-request)
- [Aree di Contribuzione](#aree-di-contribuzione)
- [Ottenere Aiuto](#ottenere-aiuto)

---

## Codice di Condotta

Questo progetto segue un semplice codice di condotta:

- Sii rispettoso e inclusivo
- Fornisci feedback costruttivo
- Concentrati su ciò che è meglio per la comunità
- Mostra empatia verso gli altri contributori

---

## Per Iniziare

### Prerequisiti

- **Node.js**: Versione 22 o superiore
- **npm**: Viene fornito con Node.js
- **Git**: Per il controllo versione
- **Firefox**: 126 o successivo, per testare l'estensione
- **Editor di Codice**: VS Code consigliato

### Fork e Clone

1. Fai il fork del repository su GitHub
2. Clona il tuo fork localmente:
   ```bash
   git clone https://github.com/TUO_USERNAME/web-article-summarizer.git
   cd web-article-summarizer
   ```
3. Aggiungi remote upstream:
   ```bash
   git remote add upstream https://github.com/AndreaBonn/web-article-summarizer.git
   ```

---

## Setup Sviluppo

### Installa Dipendenze

```bash
npm install
```

### Avvia Server di Sviluppo

```bash
npm run dev
```

Questo avvia Vite con hot module replacement (HMR).

### Carica Estensione in Firefox

1. Esegui `npm run build`
2. Apri Firefox e vai su `about:debugging#/runtime/this-firefox`
3. Clicca **Carica componente aggiuntivo temporaneo**
4. Seleziona `dist/manifest.json` dal progetto

In alternativa, `npm run start:firefox` avvia Firefox con l'estensione caricata da `dist/` (tramite web-ext).

### Configura API Keys

1. Clicca l'icona dell'estensione nella toolbar di Firefox
2. Vai su **Impostazioni** (icona ingranaggio)
3. Inserisci almeno una API key per i test

**Consigliato per Sviluppo**:
- **Groq**: Tier gratuito con limiti generosi ([Ottieni API Key](https://console.groq.com))
- **Gemini**: Tier gratuito disponibile ([Ottieni API Key](https://aistudio.google.com))

---

## Struttura Progetto

```
web-article-summarizer/
├── .github/
│   └── docs/              # Documentazione
│       ├── ARCHITECTURE.md
│       ├── API.md
│       └── CONTRIBUTING.md
├── public/
│   ├── icons/             # Icone estensione
│   └── workers/           # Web workers (PDF.js)
├── src/
│   ├── background/        # Service worker
│   ├── content/           # Content script
│   ├── pages/             # Pagine UI
│   │   ├── popup/
│   │   ├── reading-mode/
│   │   ├── history/
│   │   ├── multi-analysis/
│   │   ├── pdf-analysis/
│   │   └── options/
│   ├── shared/            # Componenti condivisi
│   └── utils/             # Moduli utility
│       ├── ai/            # Integrazione AI
│       ├── core/          # Utility core
│       ├── export/        # Funzionalità export
│       ├── i18n/          # Internazionalizzazione
│       ├── pdf/           # Elaborazione PDF
│       ├── security/      # Utility sicurezza
│       ├── storage/       # Gestione storage
│       └── voice/         # Funzionalità vocali
├── manifest.json          # Manifest estensione
├── package.json
└── vite.config.js         # Configurazione build
```

---

## Workflow di Sviluppo

### 1. Crea un Branch Feature

```bash
git checkout -b feature/mia-nuova-feature
```

Convenzioni naming branch:
- `feature/` - Nuove funzionalità
- `fix/` - Bug fix
- `docs/` - Aggiornamenti documentazione
- `refactor/` - Refactoring codice
- `test/` - Aggiunte/aggiornamenti test

### 2. Fai le Tue Modifiche

- Scrivi codice pulito e leggibile
- Segui lo stile di codice esistente
- Aggiungi commenti per logica complessa
- Aggiorna documentazione se necessario

### 3. Testa le Tue Modifiche

```bash
# Esegui unit test
npm run test

# Esegui linter
npm run lint

# Formatta codice
npm run format
```

### 4. Committa le Tue Modifiche

```bash
git add .
git commit -m "feat: aggiungi nuova funzionalità"
```

Vedi [Linee Guida Commit](#linee-guida-commit) per il formato messaggio commit.

### 5. Push e Crea Pull Request

```bash
git push origin feature/mia-nuova-feature
```

Poi crea una Pull Request su GitHub.

---

## Standard di Codifica

### Stile JavaScript

- **Sintassi ES6+**: Usa funzionalità JavaScript moderne
- **Moduli**: Usa import/export ES6
- **Async/Await**: Preferisci rispetto a callback e promise grezze
- **Arrow Functions**: Usa per funzioni brevi e callback
- **Destructuring**: Usa per codice più pulito

**Esempio**:
```javascript
// Buono ✅
export async function analyzeArticle(article, settings) {
  const { provider, language } = settings;
  try {
    const result = await APIOrchestrator.callAPI(provider, apiKey, article, settings);
    return result;
  } catch (error) {
    Logger.error('Analisi fallita:', error);
    throw error;
  }
}

// Evita ❌
function analyzeArticle(article, settings, callback) {
  var provider = settings.provider;
  APIOrchestrator.callAPI(provider, apiKey, article, settings)
    .then(function(result) {
      callback(null, result);
    })
    .catch(function(error) {
      callback(error);
    });
}
```

### Organizzazione Codice

- **Singola Responsabilità**: Ogni funzione/classe dovrebbe fare una cosa
- **Principio DRY**: Non ripeterti
- **Nomi Significativi**: Usa nomi descrittivi per variabili e funzioni
- **Funzioni Piccole**: Mantieni funzioni focalizzate e concise

### Commenti

- Usa JSDoc per API pubbliche
- Aggiungi commenti inline per logica complessa
- Evita commenti ovvi

**Esempio**:
```javascript
/**
 * Rileva il tipo di contenuto di un articolo
 * @param {object} article - Oggetto articolo con titolo e contenuto
 * @returns {string} Tipo contenuto (scientific, news, tutorial, business, opinion, general)
 */
export function detectContentType(article) {
  // Rilevamento basato su scoring: conta corrispondenze per categoria
  const scores = { scientific: 0, news: 0, tutorial: 0 };
  
  // Scientifico: marker alta confidenza
  if (/\bp\s*=\s*0\.\d+/.test(article.content)) {
    scores.scientific += 3;
  }
  
  // ... altra logica rilevamento
}
```

### Best Practice Sicurezza

- **Mai usare `innerHTML` con contenuto non fidato** - Usa `HtmlSanitizer`
- **Sanitizza sempre input utente** - Usa `InputSanitizer`
- **Valida tutti i dati esterni** - Controlla tipi e range
- **Usa codice conforme CSP** - Nessuno script inline o eval()

**Esempio**:
```javascript
// Buono ✅
HtmlSanitizer.renderText(aiResponse, element);

// Pericoloso ❌
element.innerHTML = aiResponse;
```

### Gestione Errori

- Gestisci sempre gli errori appropriatamente
- Fornisci messaggi errore significativi
- Logga errori per debugging
- Non esporre informazioni sensibili negli errori

**Esempio**:
```javascript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  Logger.error('Operazione fallita:', error);
  throw new Error('Impossibile completare operazione. Riprova.');
}
```

---

## Linee Guida Testing

### Unit Test

Usiamo **Vitest** per unit testing.

**Posizione File Test**: Posiziona file test accanto al codice che testano:
```
src/utils/ai/content-detector.js
src/utils/ai/content-detector.test.js
```

**Struttura Test**:
```javascript
import { describe, it, expect } from 'vitest';
import { ContentDetector } from './content-detector.js';

describe('ContentDetector', () => {
  describe('detectContentType', () => {
    it('dovrebbe rilevare articoli scientifici', () => {
      const article = {
        title: 'Studio di Ricerca',
        content: 'metodologia ipotesi p = 0.05'
      };
      
      const type = ContentDetector.detectContentType(article);
      expect(type).toBe('scientific');
    });
    
    it('dovrebbe rilevare articoli di notizie', () => {
      const article = {
        title: 'Breaking News',
        content: 'riportato oggi secondo fonti'
      };
      
      const type = ContentDetector.detectContentType(article);
      expect(type).toBe('news');
    });
  });
});
```

**Esecuzione Test**:
```bash
npm run test          # Esegui una volta
npm run test:watch    # Modalità watch
```

### Checklist Testing Manuale

Prima di inviare una PR, testa questi scenari:

- [ ] Analisi articolo su diversi tipi di contenuto
- [ ] Upload e analisi PDF
- [ ] Confronto multi-articolo
- [ ] Funzionalità traduzione
- [ ] Estrazione citazioni
- [ ] Export in PDF/Markdown/Email
- [ ] Controlli vocali (se modificati)
- [ ] Ricerca e filtraggio storico
- [ ] Persistenza impostazioni
- [ ] Gestione errori e casi limite

---

## Linee Guida Commit

Seguiamo la specifica **Conventional Commits**.

### Formato Messaggio Commit

```
<tipo>(<scope>): <soggetto>

<corpo>

<footer>
```

### Tipi

- `feat`: Nuova funzionalità
- `fix`: Bug fix
- `docs`: Modifiche documentazione
- `style`: Modifiche stile codice (formattazione, nessuna modifica logica)
- `refactor`: Refactoring codice
- `perf`: Miglioramenti performance
- `test`: Aggiunta o aggiornamento test
- `chore`: Task manutenzione (dipendenze, build, ecc.)

### Esempi

```bash
# Funzionalità
git commit -m "feat(ai): aggiungi supporto per modello Gemini 2.0 Flash"

# Bug fix
git commit -m "fix(cache): risolvi problema scadenza cache"

# Documentazione
git commit -m "docs: aggiorna riferimento API per StorageManager"

# Refactoring
git commit -m "refactor(prompt): semplifica logica prompt builder"

# Modifiche multiple
git commit -m "feat(export): aggiungi formato export CSV

- Aggiungi classe CSVExporter
- Aggiorna UI modale export
- Aggiungi test per generazione CSV"
```

### Best Practice Commit

- Usa tempo presente ("aggiungi feature" non "aggiunta feature")
- Usa modo imperativo ("sposta cursore a..." non "sposta cursore a...")
- Mantieni riga soggetto sotto 72 caratteri
- Capitalizza prima lettera soggetto
- Nessun punto alla fine del soggetto
- Separa soggetto da corpo con riga vuota
- Wrappa corpo a 72 caratteri
- Spiega cosa e perché, non come

---

## Processo Pull Request

### Prima di Inviare

1. **Aggiorna da upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Esegui tutti i controlli**:
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

3. **Testa manualmente** in Firefox

### Titolo PR

Segui lo stesso formato dei messaggi commit:
```
feat(ai): aggiungi supporto per modello Gemini 2.0 Flash
```

### Template Descrizione PR

```markdown
## Descrizione
Breve descrizione delle modifiche

## Tipo di Modifica
- [ ] Bug fix
- [ ] Nuova funzionalità
- [ ] Breaking change
- [ ] Aggiornamento documentazione

## Testing
- [ ] Unit test aggiunti/aggiornati
- [ ] Testing manuale completato
- [ ] Tutti i test passano

## Screenshot (se applicabile)
Aggiungi screenshot per modifiche UI

## Checklist
- [ ] Il codice segue le linee guida stile progetto
- [ ] Self-review completata
- [ ] Commenti aggiunti per codice complesso
- [ ] Documentazione aggiornata
- [ ] Nessun nuovo warning generato
```

### Processo di Review

1. Il maintainer revisionerà la tua PR
2. Affronta feedback o modifiche richieste
3. Una volta approvata, il maintainer farà il merge

### Dopo il Merge

1. Elimina il tuo branch feature:
   ```bash
   git branch -d feature/mia-nuova-feature
   git push origin --delete feature/mia-nuova-feature
   ```

2. Aggiorna il tuo main locale:
   ```bash
   git checkout main
   git pull upstream main
   ```

---

## Aree di Contribuzione

### Good First Issues

Cerca issue etichettate `good first issue` su GitHub. Questi sono task adatti ai principianti.

### Aree Alta Priorità

1. **Copertura Test**: Aumentare copertura unit test
2. **Accessibilità**: Migliorare conformità WCAG
3. **Performance**: Ottimizzare gestione PDF grandi
4. **Documentazione**: Migliorare documentazione inline
5. **Internazionalizzazione**: Aggiungere più traduzioni lingue

### Idee Funzionalità

- Modalità offline con LLM locale (WebLLM)
- Browser sync per storico
- Template prompt personalizzati
- Dashboard analytics avanzata
- Supporto per i browser Chromium (Chrome, Edge)

### Bug Fix

Controlla la pagina [Issues](https://github.com/AndreaBonn/web-article-summarizer/issues) per bug segnalati.

---

## Ottenere Aiuto

### Documentazione

- [Documentazione Architettura](ARCHITECTURE.it.md)
- [Riferimento API](API.it.md)
- [README](../../README.it.md)

### Comunicazione

- **GitHub Issues**: Per segnalazioni bug e richieste funzionalità
- **GitHub Discussions**: Per domande e discussione generale
- **Commenti Pull Request**: Per domande specifiche sul codice

### Domande?

Se hai domande sulla contribuzione:

1. Controlla documentazione esistente
2. Cerca issue e PR chiuse
3. Apri una nuova discussione su GitHub
4. Tagga maintainer se urgente

---

## Riconoscimento

I contributori saranno riconosciuti in:
- Pagina contributori GitHub
- Note di rilascio (per contributi significativi)
- README progetto (per funzionalità maggiori)

---

## Licenza

Contribuendo, accetti che i tuoi contributi saranno licenziati sotto Apache License 2.0.

---

Grazie per aver contribuito a Web Article Summarizer! 🎉
