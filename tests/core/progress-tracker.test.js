import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@utils/security/html-sanitizer.js', () => ({
  HtmlSanitizer: {
    escape: vi.fn((text) => text),
  },
}));

import { ProgressTracker } from '@utils/core/progress-tracker.js';

describe('ProgressTracker', () => {
  let tracker;
  let container, messageEl, progressBarEl, percentEl;

  const steps = [
    { name: 'extract', label: 'Estrazione articolo', weight: 10 },
    { name: 'classify', label: 'Classificazione tipo', weight: 15 },
    { name: 'generate', label: 'Generazione riassunto', weight: 60 },
    { name: 'save', label: 'Salvataggio', weight: 15 },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    container = { classList: { add: vi.fn(), remove: vi.fn() } };
    messageEl = { innerHTML: '' };
    progressBarEl = { style: { width: '0%', transition: '', backgroundColor: '' } };
    percentEl = { textContent: '0%' };
    tracker = new ProgressTracker(container, messageEl, progressBarEl, percentEl);
  });

  describe('defineSteps()', () => {
    it('test_defineSteps_setsStepsAndCalculatesTotalWeight', () => {
      tracker.defineSteps(steps);
      expect(tracker.steps).toEqual(steps);
      expect(tracker.totalWeight).toBe(100);
      expect(tracker.currentStep).toBe(0);
    });
  });

  describe('start()', () => {
    it('test_start_activatesAndShowsContainer', () => {
      tracker.defineSteps(steps);
      tracker.start();

      expect(tracker.isActive).toBe(true);
      expect(container.classList.remove).toHaveBeenCalledWith('hidden');
    });
  });

  describe('nextStep()', () => {
    it('test_nextStep_advancesToNextStep', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.nextStep();

      expect(tracker.currentStep).toBe(1);
    });

    it('test_nextStep_atLastStep_doesNotGoBeyo', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.nextStep();
      tracker.nextStep();
      tracker.nextStep(); // At last step (index 3)
      tracker.nextStep(); // Should not go beyond

      expect(tracker.currentStep).toBe(3);
    });
  });

  describe('setStep()', () => {
    it('test_setStep_validName_setsCorrectStep', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.setStep('generate');

      expect(tracker.currentStep).toBe(2);
    });

    it('test_setStep_invalidName_doesNothing', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.setStep('nonexistent');

      expect(tracker.currentStep).toBe(0);
    });

    it('test_setStep_withCustomMessage_updatesUI', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.setStep('generate', 'Custom message');

      expect(messageEl.innerHTML).toContain('Custom message');
    });
  });

  describe('updateUI()', () => {
    it('test_updateUI_calculatesPercentBasedOnWeights', () => {
      tracker.defineSteps(steps);
      tracker.start();

      // Step 0: completedWeight=0, currentStepProgress=5 (10*0.5), total=5/100=5%
      expect(percentEl.textContent).toBe('5%');
    });

    it('test_updateUI_secondStep_showsHigherPercent', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.nextStep();

      // Step 1: completedWeight=10, currentStepProgress=7.5 (15*0.5), total=17.5/100=18%
      expect(percentEl.textContent).toBe('18%');
    });

    it('test_updateUI_notActive_doesNothing', () => {
      tracker.defineSteps(steps);
      // Not started
      tracker.updateUI();
      expect(percentEl.textContent).toBe('0%');
    });

    it('test_updateUI_showsEveryStepWithItsState', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.setStep('generate');

      const html = messageEl.innerHTML;
      expect(html).toContain('progress-steps');
      expect(html).toMatch(/progress-step--done[^>]*>[^<]*Estrazione articolo/);
      expect(html).toMatch(/progress-step--done[^>]*>[^<]*Classificazione tipo/);
      expect(html).toMatch(/progress-step--current[^>]*>[^<]*Generazione riassunto/);
      expect(html).toMatch(/progress-step--pending[^>]*>[^<]*Salvataggio/);
    });

    it('test_updateUI_customMessage_replacesOnlyCurrentStepLabel', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.setStep('classify', 'Rilevato: Notizia');

      const html = messageEl.innerHTML;
      expect(html).toMatch(/progress-step--current[^>]*>[^<]*Rilevato: Notizia/);
      expect(html).not.toContain('Classificazione tipo');
      expect(html).toContain('Estrazione articolo');
    });

    it('test_updateUI_escapesStepLabels', async () => {
      const { HtmlSanitizer } = await import('@utils/security/html-sanitizer.js');
      tracker.defineSteps(steps);
      tracker.start();
      expect(HtmlSanitizer.escape).toHaveBeenCalledWith('Estrazione articolo');
      expect(HtmlSanitizer.escape).toHaveBeenCalledWith('Salvataggio');
    });
  });

  describe('complete()', () => {
    it('test_complete_sets100PercentAndDeactivates', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.complete();

      expect(tracker.isActive).toBe(false);
      expect(progressBarEl.style.width).toBe('100%');
      expect(percentEl.textContent).toBe('100%');
      expect(messageEl.innerHTML).toContain('Completato!');
    });

    it('test_complete_hidesAfterDelay', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.complete();

      vi.advanceTimersByTime(800);
      expect(container.classList.add).toHaveBeenCalledWith('hidden');
    });
  });

  describe('error()', () => {
    it('test_error_showsErrorMessageAndDeactivates', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.error('Something failed');

      expect(tracker.isActive).toBe(false);
      expect(messageEl.innerHTML).toContain('Something failed');
      expect(progressBarEl.style.backgroundColor).toBe('#e74c3c');
    });
  });

  describe('reset()', () => {
    it('test_reset_resetsAllState', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.nextStep();
      tracker.reset();

      expect(tracker.currentStep).toBe(0);
      expect(progressBarEl.style.width).toBe('0%');
      expect(percentEl.textContent).toBe('0%');
      expect(messageEl.innerHTML).toBe('');
    });
  });

  describe('setProgress()', () => {
    it('test_setProgress_setsExactPercent', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.setProgress(42, 'Loading data...');

      expect(progressBarEl.style.width).toBe('42%');
      expect(percentEl.textContent).toBe('42%');
      expect(messageEl.innerHTML).toContain('Loading data...');
    });

    it('test_setProgress_over100_capsAt100', () => {
      tracker.defineSteps(steps);
      tracker.start();
      tracker.setProgress(150, 'test');

      expect(progressBarEl.style.width).toBe('100%');
    });

    it('test_setProgress_notActive_doesNothing', () => {
      tracker.setProgress(50, 'test');
      expect(progressBarEl.style.width).toBe('0%');
    });
  });

  describe('hide() / show()', () => {
    it('test_hide_addsHiddenClass', () => {
      tracker.hide();
      expect(container.classList.add).toHaveBeenCalledWith('hidden');
      expect(tracker.isActive).toBe(false);
    });

    it('test_show_removesHiddenClass', () => {
      tracker.show();
      expect(container.classList.remove).toHaveBeenCalledWith('hidden');
    });
  });
});
