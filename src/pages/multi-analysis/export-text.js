import { I18n } from '../../utils/i18n/i18n.js';
import { docHeading } from '../../utils/export/doc-labels.js';

/** Build an email with the selected articles and enabled analysis sections.
 * @param {object} data
 * @returns {string}
 */
export function buildMultiAnalysisEmailContent({
  analysis,
  selectedIds,
  allArticles,
  options,
  dateLocale,
}) {
  let content = `# ${I18n.t('multi.emailTitle')}\n\n`;
  content += `${I18n.t('multi.emailDate')} ${new Date(analysis.timestamp).toLocaleDateString(dateLocale)}\n\n`;
  content += `${I18n.t('multi.emailArticlesCount')} ${selectedIds.length}\n\n`;
  content += '---\n\n';

  content += `${I18n.t('multi.emailArticlesSection')}\n\n`;
  selectedIds.forEach((id, index) => {
    const article = allArticles.find((a) => a.id === id);
    if (article) {
      content += `${index + 1}. ${article.article.title}\n`;
    }
  });
  content += '\n---\n\n';

  content = appendAnalysisSections(content, analysis, options);
  return appendEmailQuestions(content, analysis, options);
}

/** Append enabled analysis sections.
 * @param {string} content
 * @param {object} analysis
 * @param {object} options
 * @returns {string}
 */
function appendAnalysisSections(content, analysis, options) {
  if (options.includeSummary && analysis.globalSummary) {
    content += `${I18n.t('multi.emailSummarySection')}\n\n`;
    content += analysis.globalSummary + '\n\n---\n\n';
  }

  if (options.includeComparison && analysis.comparison) {
    content += `${I18n.t('multi.emailComparisonSection')}\n\n`;
    content += analysis.comparison + '\n\n---\n\n';
  }

  return content;
}

/** Append enabled saved questions and answers.
 * @param {string} content
 * @param {object} analysis
 * @param {object} options
 * @returns {string}
 */
function appendEmailQuestions(content, analysis, options) {
  if (
    options.includeQA &&
    analysis.qa &&
    analysis.qa.questions &&
    analysis.qa.questions.length > 0
  ) {
    content += `${I18n.t('multi.emailQASection')}\n\n`;
    analysis.qa.questions.forEach((qa, index) => {
      content += `${I18n.tf('multi.emailQuestion', { index: index + 1 })} ${qa.question}\n\n`;
      content += `${I18n.tf('multi.emailAnswer', { index: index + 1 })} ${qa.answer}\n\n`;
    });
    content += '---\n\n';
  }
  return content;
}

/** Build clipboard text from analysis data and visible chat messages.
 * @param {object} analysis
 * @param {string[]} qaMessageTexts
 * @returns {string}
 */
export function buildMultiAnalysisCopyText(analysis, qaMessageTexts) {
  let text = '';

  if (analysis.globalSummary) {
    text += `${docHeading('globalSummary')}:\n\n` + analysis.globalSummary + '\n\n';
  }

  if (analysis.comparison) {
    text += '='.repeat(50) + `\n\n${docHeading('comparison')}:\n\n` + analysis.comparison + '\n\n';
  }

  if (analysis.qa && analysis.qa.interactive) {
    if (qaMessageTexts.length > 0) {
      text += '='.repeat(50) + `\n\n${docHeading('qaConversation')}:\n\n`;
      qaMessageTexts.forEach((message) => {
        text += message + '\n\n';
      });
    }
  }
  return text;
}
