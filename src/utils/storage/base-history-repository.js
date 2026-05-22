// Base History Repository — CRUD generico parametrizzato sulla chiave di storage

export class BaseHistoryRepository {
  constructor(storageKey, maxEntries) {
    this.storageKey = storageKey;
    this.maxEntries = maxEntries;
  }

  async _safeStorageSet(data) {
    try {
      await browser.storage.local.set(data);
    } catch (error) {
      if (error.message?.includes('QUOTA_BYTES')) {
        throw new Error(
          'Spazio di archiviazione esaurito. Pulisci la cronologia nelle impostazioni.',
          { cause: error },
        );
      }
      throw new Error(`Errore salvataggio: ${error.message}`, { cause: error });
    }
  }

  async _getAll() {
    try {
      const result = await browser.storage.local.get([this.storageKey]);
      return result[this.storageKey] || [];
    } catch (error) {
      throw new Error(`Impossibile leggere la cronologia: ${error.message}`, { cause: error });
    }
  }

  async _saveAll(history) {
    await this._safeStorageSet({ [this.storageKey]: history });
  }

  async getAll() {
    return this._getAll();
  }

  async getById(id) {
    const history = await this._getAll();
    return history.find((entry) => entry.id === id);
  }

  async save(entry) {
    let history = await this._getAll();

    entry.id = crypto.randomUUID();
    entry.timestamp = Date.now();

    history.unshift(entry);

    if (history.length > this.maxEntries) {
      history = history.slice(0, this.maxEntries);
    }

    await this._saveAll(history);
    return entry.id;
  }

  async delete(id) {
    const history = await this._getAll();
    const filtered = history.filter((entry) => entry.id !== id);
    await this._saveAll(filtered);
  }

  async toggleFavorite(id) {
    const history = await this._getAll();
    const entry = history.find((e) => e.id === id);

    if (entry) {
      entry.favorite = !entry.favorite;
      await this._saveAll(history);
      return entry.favorite;
    }
    return false;
  }

  async clear() {
    const history = await this._getAll();
    const favorites = history.filter((entry) => entry.favorite);
    await this._saveAll(favorites);
  }

  async updateField(id, field, value) {
    const history = await this._getAll();
    const entry = history.find((e) => e.id === id);

    if (entry) {
      entry[field] = value;
      await this._saveAll(history);
    }
  }

  async findByField(fieldPath, value) {
    const history = await this._getAll();
    return history.find((e) => {
      const parts = fieldPath.split('.');
      let current = e;
      for (const part of parts) {
        if (current === undefined || current === null) return false;
        current = current[part];
      }
      return current === value;
    });
  }

  async updateByField(fieldPath, matchValue, field, value) {
    const history = await this._getAll();
    const entry = history.find((e) => {
      const parts = fieldPath.split('.');
      let current = e;
      for (const part of parts) {
        if (current === undefined || current === null) return false;
        current = current[part];
      }
      return current === matchValue;
    });

    if (entry) {
      entry[field] = value;
      await this._saveAll(history);
    }
  }

  // Utility statiche condivise
  static formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ora';
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays < 7) return `${diffDays} giorni fa`;

    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  static formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
