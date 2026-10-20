import { buildMultiArticleQAPrompts } from '../../utils/ai/prompts/multi-qa-prompts.js';
import { HtmlSanitizer } from '../../utils/security/html-sanitizer.js';
import { InputSanitizer } from '../../utils/security/input-sanitizer.js';
import { StorageManager } from '../../utils/storage/storage-manager.js';
import { requestCompletion } from '../../utils/ai/completion-client.js';
import { HistoryManager } from '../../utils/storage/history-manager.js';
import { state } from './state.js';
import { Logger } from '../../utils/core/logger.js';

export async function submitQuestion() {
  const input = document.getElementById('qaInput');
  const question = input.value.trim();

  if (!question) return;

  const chatContainer = document.getElementById('qaChatContainer');
  const questionEl = document.createElement('div');
  questionEl.className = 'qa-message qa-question-msg';
  questionEl.innerHTML = `<strong>Tu:</strong> ${HtmlSanitizer.escape(question)}`;
  chatContainer.appendChild(questionEl);

  const loadingEl = document.createElement('div');
  loadingEl.className = 'qa-message qa-loading';
  loadingEl.innerHTML = '⏳ Sto pensando...';
  chatContainer.appendChild(loadingEl);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  input.value = '';
  input.disabled = true;
  document.getElementById('qaSubmitBtn').disabled = true;

  try {
    const answer = await askQuestionToArticles(question);

    loadingEl.remove();

    const answerEl = document.createElement('div');
    answerEl.className = 'qa-message qa-answer-msg';
    answerEl.innerHTML = `<strong>Assistente:</strong> ${HtmlSanitizer.escape(answer)}`;
    chatContainer.appendChild(answerEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    if (!state.currentAnalysis.qa.questions) {
      state.currentAnalysis.qa.questions = [];
    }
    state.currentAnalysis.qa.questions.push({ question, answer });

    if (state.currentAnalysis.id) {
      try {
        await HistoryManager.updateMultiAnalysisWithQA(state.currentAnalysis.id, question, answer);
      } catch (error) {
        Logger.error('Errore aggiornamento cronologia:', error);
      }
    }
  } catch (error) {
    loadingEl.remove();
    const errorEl = document.createElement('div');
    errorEl.className = 'qa-message qa-error-msg';
    errorEl.innerHTML = `<strong>Errore:</strong> ${HtmlSanitizer.escape(error.message)}`;
    chatContainer.appendChild(errorEl);
  } finally {
    input.disabled = false;
    document.getElementById('qaSubmitBtn').disabled = false;
    input.focus();
  }
}

async function askQuestionToArticles(rawQuestion) {
  const question = InputSanitizer.sanitizeUserPrompt(rawQuestion, {
    maxLength: 500,
    minLength: 3,
  });

  const settings = await StorageManager.getSettings();
  const provider = settings.selectedProvider || 'groq';

  const { systemPrompt, userPrompt } = buildMultiArticleQAPrompts(
    state.currentAnalysis.qa.articles,
    question,
  );

  return await requestCompletion(provider, systemPrompt, userPrompt, {
    temperature: 0.1,
    maxTokens: 1000,
  });
}
