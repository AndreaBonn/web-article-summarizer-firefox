// Event Cleanup Manager - Gestisce la rimozione automatica degli event listeners
import { Logger } from './logger.js';

export class EventCleanupManager {
  constructor() {
    this.listeners = new Map(); // Map<element, Array<{event, handler}>>
    this.setupUnloadHandler();
  }

  /**
   * Registra un event listener per cleanup automatico
   */
  addEventListener(element, event, handler, options = {}) {
    if (!element) {
      Logger.warn('EventCleanupManager: elemento non valido');
      return;
    }

    // Aggiungi listener
    element.addEventListener(event, handler, options);

    // Registra per cleanup
    if (!this.listeners.has(element)) {
      this.listeners.set(element, []);
    }

    this.listeners.get(element).push({ event, handler, options });

    Logger.debug(`Listener registrato: ${event} su`, element);
  }

  /**
   * Rimuovi un listener specifico
   */
  removeEventListener(element, event, handler) {
    if (!element) return;

    const elementListeners = this.listeners.get(element);
    const index = elementListeners
      ? elementListeners.findIndex((l) => l.event === event && l.handler === handler)
      : -1;

    // Stesse options (capture) usate in add, altrimenti il listener resta attaccato
    element.removeEventListener(
      event,
      handler,
      index !== -1 ? elementListeners[index].options : undefined,
    );

    // Rimuovi dalla registrazione
    if (elementListeners) {
      if (index !== -1) {
        elementListeners.splice(index, 1);
        Logger.debug(`Listener rimosso: ${event} da`, element);
      }

      // Se non ci sono più listener per questo elemento, rimuovi la entry
      if (elementListeners.length === 0) {
        this.listeners.delete(element);
      }
    }
  }

  /**
   * Rimuovi tutti i listener da un elemento
   */
  removeAllListeners(element) {
    if (!this.listeners.has(element)) return;

    const elementListeners = this.listeners.get(element);

    elementListeners.forEach(({ event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });

    this.listeners.delete(element);
    Logger.debug(`Tutti i listener rimossi da`, element);
  }

  /**
   * Cleanup completo di tutti i listener registrati
   */
  cleanupAll() {
    Logger.debug('Cleanup di tutti i listener...');

    let count = 0;
    this.listeners.forEach((elementListeners, element) => {
      elementListeners.forEach(({ event, handler, options }) => {
        try {
          element.removeEventListener(event, handler, options);
          count++;
        } catch (error) {
          Logger.warn('Errore rimozione listener:', error);
        }
      });
    });

    this.listeners.clear();
    Logger.info(`${count} listener rimossi`);
  }

  /**
   * Setup handler per cleanup automatico su unload
   */
  setupUnloadHandler() {
    window.addEventListener('unload', () => {
      this.cleanupAll();
    });

    // Per popup che si chiudono senza unload
    window.addEventListener('beforeunload', () => {
      this.cleanupAll();
    });
  }

  /**
   * Ottieni statistiche sui listener registrati
   */
  getStats() {
    let totalListeners = 0;
    const eventTypes = {};

    this.listeners.forEach((elementListeners) => {
      elementListeners.forEach(({ event }) => {
        totalListeners++;
        eventTypes[event] = (eventTypes[event] || 0) + 1;
      });
    });

    return {
      totalElements: this.listeners.size,
      totalListeners,
      eventTypes,
    };
  }
}

// Istanza globale
export const eventCleanup = new EventCleanupManager();
