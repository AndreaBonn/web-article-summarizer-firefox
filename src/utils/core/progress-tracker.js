// Progress Tracker - Sistema di tracking progresso granulare
// Mostra step dettagliati durante operazioni lunghe
import { HtmlSanitizer } from '../security/html-sanitizer.js';
import { I18n } from '../i18n/i18n.js';

export class ProgressTracker {
  constructor(containerEl, messageEl, progressBarEl, percentEl) {
    this.container = containerEl;
    this.messageEl = messageEl;
    this.progressBarEl = progressBarEl;
    this.percentEl = percentEl;

    this.steps = [];
    this.currentStep = 0;
    this.isActive = false;
  }

  /**
   * Definisci gli step del processo
   * @param {Array} steps - Array di step: [{ name, label, weight }]
   *
   * Esempio:
   * [
   *   { name: 'extract', label: '📄 Estrazione articolo', weight: 10 },
   *   { name: 'classify', label: '🔍 Classificazione tipo', weight: 15 },
   *   { name: 'generate', label: '🤖 Generazione riassunto', weight: 60 },
   *   { name: 'save', label: '💾 Salvataggio', weight: 15 }
   * ]
   */
  defineSteps(steps) {
    this.steps = steps;
    this.currentStep = 0;
    this.totalWeight = steps.reduce((sum, s) => sum + s.weight, 0);
  }

  /**
   * Avvia il tracking
   */
  start() {
    this.isActive = true;
    this.currentStep = 0;
    this.container.classList.remove('hidden');
    this.updateUI();
  }

  /**
   * Passa allo step successivo
   * @param {string} message - Messaggio custom opzionale
   */
  nextStep(message = null) {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.updateUI(message);
    }
  }

  /**
   * Imposta uno step specifico per nome
   * @param {string} stepName - Nome dello step
   * @param {string} message - Messaggio custom opzionale
   */
  setStep(stepName, message = null) {
    const index = this.steps.findIndex((s) => s.name === stepName);
    if (index !== -1) {
      this.currentStep = index;
      this.updateUI(message);
    }
  }

  /**
   * Aggiorna l'interfaccia utente
   * @param {string} customMessage - Messaggio custom opzionale
   */
  updateUI(customMessage = null) {
    if (!this.isActive) return;

    if (this.currentStep >= this.steps.length) {
      this.complete();
      return;
    }

    const step = this.steps[this.currentStep];

    // Calcola percentuale basata sui pesi
    const completedWeight = this.steps
      .slice(0, this.currentStep)
      .reduce((sum, s) => sum + s.weight, 0);

    // Aggiungi metà del peso dello step corrente per smoothness
    const currentStepProgress = step.weight * 0.5;
    const totalProgress = completedWeight + currentStepProgress;

    const percent = Math.min(Math.round((totalProgress / this.totalWeight) * 100), 99);

    // Every step stays visible, so the user sees what is done and what is left
    const items = this.steps
      .map((s, index) => {
        if (index < this.currentStep) {
          return `<li class="progress-step progress-step--done">✓ ${HtmlSanitizer.escape(s.label)}</li>`;
        }
        if (index === this.currentStep) {
          const label = HtmlSanitizer.escape(customMessage || s.label);
          return `<li class="progress-step progress-step--current" aria-current="step">● ${label}</li>`;
        }
        return `<li class="progress-step progress-step--pending">○ ${HtmlSanitizer.escape(s.label)}</li>`;
      })
      .join('');
    this.messageEl.innerHTML = `<ol class="progress-steps">${items}</ol>`;

    // Aggiorna progress bar con animazione
    this.progressBarEl.style.width = percent + '%';
    this.percentEl.textContent = percent + '%';

    // Animazione smooth
    this.progressBarEl.style.transition = 'width 0.3s ease';
  }

  /**
   * Completa il processo
   */
  complete() {
    this.isActive = false;
    this.progressBarEl.style.width = '100%';
    this.percentEl.textContent = '100%';
    this.messageEl.innerHTML = `
      <div class="progress-complete">
        <span class="progress-complete-icon">✓</span>
        <span class="progress-complete-text">${HtmlSanitizer.escape(I18n.t('progress.done'))}</span>
      </div>
    `;

    // Nascondi dopo un breve delay
    setTimeout(() => {
      this.container.classList.add('hidden');
      this.reset();
    }, 800);
  }

  /**
   * Mostra errore
   * @param {string} message - Messaggio di errore
   */
  error(message) {
    this.isActive = false;
    this.messageEl.innerHTML = `
      <div class="progress-error">
        <span class="progress-error-icon">❌</span>
        <span class="progress-error-text">${HtmlSanitizer.escape(message)}</span>
      </div>
    `;
    this.progressBarEl.style.backgroundColor = '#e74c3c';
    this.progressBarEl.style.width = '100%';

    // Mantieni visibile per permettere all'utente di leggere l'errore
    // Non nascondere automaticamente
  }

  /**
   * Reset del tracker
   */
  reset() {
    this.currentStep = 0;
    this.progressBarEl.style.width = '0%';
    this.progressBarEl.style.backgroundColor = '';
    this.percentEl.textContent = '0%';
    this.messageEl.innerHTML = '';
  }

  /**
   * Nascondi il tracker
   */
  hide() {
    this.isActive = false;
    this.container.classList.add('hidden');
  }

  /**
   * Mostra il tracker
   */
  show() {
    this.container.classList.remove('hidden');
  }

  /**
   * Aggiorna la percentuale manualmente (per operazioni custom)
   * @param {number} percent - Percentuale (0-100)
   * @param {string} message - Messaggio da mostrare
   */
  setProgress(percent, message) {
    if (!this.isActive) return;

    this.progressBarEl.style.width = Math.min(percent, 100) + '%';
    this.percentEl.textContent = Math.min(percent, 100) + '%';

    if (message) {
      this.messageEl.innerHTML = `
        <div class="progress-step-indicator">
          <span class="progress-step-label">${HtmlSanitizer.escape(message)}</span>
        </div>
      `;
    }
  }

  /**
   * Incrementa la percentuale di un delta
   * @param {number} delta - Incremento percentuale
   * @param {string} message - Messaggio opzionale
   */
  incrementProgress(delta, message = null) {
    const currentPercent = parseInt(this.progressBarEl.style.width) || 0;
    const newPercent = Math.min(currentPercent + delta, 99);
    this.setProgress(newPercent, message);
  }
}
