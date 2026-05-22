# Architecture

Technical reference for the internal architecture of Web Article Summarizer.

## Extension Architecture

How the Firefox Extension components communicate. Pages send messages to the Service Worker via `browser.runtime.sendMessage`. The Popup also communicates with the Content Script via `browser.tabs.sendMessage` for article extraction.

```mermaid
%%{init: {'theme': 'default'}}%%
graph LR
  subgraph pages["Extension Pages"]
    direction TB
    popup["Popup"]
    reading["Reading Mode"]
    history["History"]
    multi["Multi-Analysis"]
    pdf_page["PDF Analysis"]
    options["Options"]
  end

  subgraph browser_layer["Browser APIs"]
    direction TB
    sw["Service Worker"]
    cs["Content Script"]
    storage[("Browser Storage")]
  end

  subgraph providers["LLM Providers"]
    direction TB
    groq["Groq"]
    openai["OpenAI"]
    anthropic["Anthropic"]
    gemini["Gemini"]
  end

  popup -->|"extractArticle"| cs
  cs -->|"article data"| popup
  pages -->|"browser.runtime<br/>sendMessage"| sw
  sw --> storage
  sw -->|"API call"| providers

  classDef core fill:#2563eb,stroke:#1d4ed8,color:#fff
  classDef data fill:#d97706,stroke:#b45309,color:#fff
  classDef ext fill:#6b7280,stroke:#4b5563,color:#fff
  classDef engine fill:#059669,stroke:#047857,color:#fff

  class popup,reading,history,multi,pdf_page,options core
  class sw,cs engine
  class storage data
  class groq,openai,anthropic,gemini ext
```

**Legend:** Blue = UI pages, Green = browser runtime components, Amber = storage, Grey = external providers.

## Article Analysis Flow

The main user flow from clicking "Analyze" to seeing results. The Service Worker checks the cache before calling the LLM provider, and saves both cache and history on success.

```mermaid
sequenceDiagram
  actor user as User
  participant popup as Popup
  participant cs as Content Script
  participant sw as Service Worker
  participant llm as LLM Provider
  participant store as Browser Storage

  user->>popup: Click Analyze
  popup->>+cs: extractArticle
  cs->>cs: Readability extract
  cs-->>-popup: article data

  popup->>+sw: generateSummary
  sw->>+store: Check cache
  store-->>-sw: cache miss

  sw->>+llm: API request
  llm-->>-sw: AI response

  sw->>store: Save to cache
  sw->>store: Save to history
  sw-->>-popup: summary + key points
  popup->>user: Display results
```

### Message Types

The Service Worker handles these message actions via `browser.runtime.onMessage`:

| Action                | Direction                 | Description                           |
| --------------------- | ------------------------- | ------------------------------------- |
| `extractArticle`      | Popup -> Content Script   | Extract article from current page DOM |
| `generateSummary`     | Page -> Service Worker    | Generate AI summary                   |
| `extractCitations`    | Page -> Service Worker    | Extract bibliographic citations       |
| `translateArticle`    | Page -> Service Worker    | Translate article content             |
| `askQuestion`         | Page -> Service Worker    | Q&A on article content                |
| `translatePDF`        | Page -> Service Worker    | Translate PDF content                 |
| `extractPDFCitations` | Page -> Service Worker    | Extract citations from PDF            |
| `askPDFQuestion`      | Page -> Service Worker    | Q&A on PDF content                    |
| `testApiKey`          | Options -> Service Worker | Validate provider API key             |

## AI Processing Pipeline

How `APIOrchestrator.callAPI` processes a request internally. Content detection feeds into prompt building, which uses the PromptRegistry facade to select the right prompt module. The ProviderCaller dispatches to one of 4 LLM providers with retry and fallback support.

```mermaid
%%{init: {'theme': 'default'}}%%
graph LR
  input["callAPI<br/>provider, article,<br/>settings"]
  detect["ContentDetector<br/>type + language"]
  build["PromptBuilder<br/>system + user prompt"]
  registry["PromptRegistry"]
  caller["ProviderCaller"]
  parser["ResponseParser"]

  subgraph prompts["Prompt Modules"]
    direction TB
    p_sum["summary"]
    p_key["keypoints"]
    p_trans["translation"]
    p_cite["citation"]
  end

  subgraph resilience["Resilience"]
    direction TB
    retry["RetryStrategy"]
    fallback["FallbackStrategy"]
    rate["RateLimiter"]
  end

  input --> detect --> build
  build --> registry --> prompts
  build --> caller
  resilience --> caller
  caller --> parser

  classDef core fill:#2563eb,stroke:#1d4ed8,color:#fff
  classDef data fill:#d97706,stroke:#b45309,color:#fff
  classDef ext fill:#6b7280,stroke:#4b5563,color:#fff
  classDef engine fill:#059669,stroke:#047857,color:#fff

  class input,detect,build core
  class registry,p_sum,p_key,p_trans,p_cite data
  class caller,parser engine
  class retry,fallback,rate ext
```

### Default Models

| Provider  | Model                        |
| --------- | ---------------------------- |
| Groq      | `llama-3.3-70b-versatile`    |
| OpenAI    | `gpt-4o`                     |
| Anthropic | `claude-sonnet-4-5-20250514` |
| Gemini    | `gemini-2.5-pro`             |

## Storage Architecture

All persistent data flows through CompressionManager (lz-string) before reaching Browser Storage. CacheManager handles response caching with content hash validation and TTL. HistoryManager delegates to specialized repositories per content type.

```mermaid
%%{init: {'theme': 'default'}}%%
graph TD
  subgraph cache_layer["Cache Layer"]
    direction LR
    cache_mgr["CacheManager<br/>TTL + content hash"]
    cache_store["CacheStore"]
    cache_stats["CacheStats"]
    cache_inv["CacheInvalidation"]
    trans_cache["TranslationCache"]
  end

  subgraph history_layer["History Layer"]
    direction LR
    hist_mgr["HistoryManager"]
    base_repo["BaseHistoryRepository"]
    art_hist["ArticleHistory"]
    pdf_hist["PdfHistory"]
    multi_hist["MultiAnalysisHistory"]
  end

  storage_mgr["StorageManager<br/>settings + API keys"]
  compress["CompressionManager<br/>lz-string"]
  browser_store[("Browser Storage API")]

  cache_mgr --> cache_store
  cache_mgr --> cache_stats
  cache_mgr --> cache_inv
  hist_mgr --> base_repo
  base_repo --> art_hist
  base_repo --> pdf_hist
  base_repo --> multi_hist

  storage_mgr --> compress
  cache_layer --> compress
  history_layer --> compress
  trans_cache --> compress
  compress --> browser_store

  classDef core fill:#2563eb,stroke:#1d4ed8,color:#fff
  classDef data fill:#d97706,stroke:#b45309,color:#fff
  classDef ext fill:#6b7280,stroke:#4b5563,color:#fff
  classDef engine fill:#059669,stroke:#047857,color:#fff

  class storage_mgr,cache_mgr,hist_mgr core
  class cache_store,cache_stats,cache_inv,trans_cache,art_hist,pdf_hist,multi_hist data
  class compress engine
  class browser_store ext
  class base_repo data
```

**Legend:** Blue = manager facades, Amber = data stores/repositories, Green = processing, Grey = browser platform.
