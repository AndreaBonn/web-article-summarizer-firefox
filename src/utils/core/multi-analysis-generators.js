// Multi-Analysis Generators — AI generation functions for multi-article analysis
// Pure static functions: receive data, return results (no internal state)

import { APIOrchestrator as APIClient } from '../ai/api-orchestrator.js';
import { parseLLMJson } from '../ai/json-repair.js';
import { Logger } from './logger.js';
import { getTranslationText } from '../../shared/translation-text.js';
import {
  getGlobalSummaryPrompt,
  getComparisonPrompt,
  getQAPrompt,
} from '../ai/prompts/multi-analysis-prompts.js';

export async function generateGlobalSummary(articles, provider, apiKey) {
  const articlesContent = articles
    .map((a, index) => {
      const content = getTranslationText(a.translation) || a.summary;
      return `
## ARTICOLO ${index + 1}: ${a.article.title}

**URL:** ${a.article.url}
**Parole:** ${a.article.wordCount}

### Contenuto:
${content}

${
  a.keyPoints && a.keyPoints.length > 0
    ? `
### Punti Chiave:
${a.keyPoints.map((kp, i) => `${i + 1}. ${kp.title}: ${kp.description}`).join('\n')}
`
    : ''
}
`;
    })
    .join('\n\n' + '='.repeat(80) + '\n\n');

  const systemPrompt = getGlobalSummaryPrompt(provider);

  const userPrompt = `Crea un riassunto globale unificato dei seguenti ${articles.length} articoli:

${articlesContent}

---

Genera un riassunto globale che integri tutti questi contenuti in una narrazione coerente, organizzata per temi principali piuttosto che per singolo articolo.`;

  const options = {
    temperature: 0.3,
    maxTokens: provider === 'gemini' ? 8192 : 4000,
  };

  return await APIClient.generateCompletion(provider, apiKey, systemPrompt, userPrompt, options);
}

export async function generateComparison(articles, provider, apiKey) {
  const articlesContent = articles
    .map((a, index) => {
      const content = getTranslationText(a.translation) || a.summary;
      return `
## ARTICOLO ${index + 1}: ${a.article.title}

${content}
`;
    })
    .join('\n\n');

  const systemPrompt = getComparisonPrompt(provider);

  const userPrompt = `Analizza e confronta le idee presenti nei seguenti ${articles.length} articoli:

${articlesContent}

---

Genera un'analisi comparativa dettagliata che evidenzi idee comuni, conflitti, prospettive diverse e complementarietà tra gli articoli.`;

  const options = {
    temperature: 0.2,
    maxTokens: 4000,
  };

  // Gemini supporta output più lunghi e contesti più ampi
  if (provider === 'gemini') {
    options.maxTokens = 8000;
    options.model = 'gemini-2.5-pro';
  }

  return await APIClient.generateCompletion(provider, apiKey, systemPrompt, userPrompt, options);
}

export async function generateQA(articles, provider, apiKey) {
  const articlesContent = articles
    .map((a, index) => {
      const content = getTranslationText(a.translation) || a.summary;
      return `
## ARTICOLO ${index + 1}: ${a.article.title}

${content}
`;
    })
    .join('\n\n');

  const systemPrompt = getQAPrompt(provider);

  const userPrompt = `Genera 8-10 domande e risposte basate sui seguenti ${articles.length} articoli:

${articlesContent}

---

Genera domande che richiedano di:
- Sintetizzare informazioni da più articoli
- Confrontare posizioni e prospettive diverse
- Integrare contenuti complementari
- Analizzare implicazioni complessive

IMPORTANTE: Rispondi SOLO con il JSON nel formato specificato, senza markup markdown o testo aggiuntivo.`;

  const options = {
    temperature: 0.2,
    maxTokens: provider === 'gemini' ? 4096 : 3000,
  };

  const response = await APIClient.generateCompletion(
    provider,
    apiKey,
    systemPrompt,
    userPrompt,
    options,
  );

  try {
    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      return parseLLMJson(cleanedResponse);
    } catch (parseError) {
      Logger.warn('JSON parsing Q&A fallito, fallback a text parsing:', parseError.message);
    }

    return parseQAFromText(response);
  } catch (error) {
    Logger.error('Errore parsing Q&A:', error);
    return parseQAFromText(response);
  }
}

export function parseQAFromText(text) {
  const qa = [];
  const lines = text.split('\n');
  let currentQ = null;
  let currentA = '';

  for (const line of lines) {
    const qMatch = line.match(/^Q\d+[:.]?\s*(.+)/i);
    const aMatch = line.match(/^R\d+[:.]?\s*(.+)/i);

    if (qMatch) {
      if (currentQ && currentA) {
        qa.push({ question: currentQ, answer: currentA.trim() });
      }
      currentQ = qMatch[1].trim();
      currentA = '';
    } else if (aMatch) {
      currentA = aMatch[1].trim();
    } else if (currentA && line.trim()) {
      currentA += ' ' + line.trim();
    }
  }

  if (currentQ && currentA) {
    qa.push({ question: currentQ, answer: currentA.trim() });
  }

  return qa.length > 0
    ? qa
    : [
        {
          question: 'Quali sono i temi principali trattati negli articoli?',
          answer:
            "Gli articoli trattano diversi temi interconnessi che richiedono un'analisi approfondita.",
        },
      ];
}
