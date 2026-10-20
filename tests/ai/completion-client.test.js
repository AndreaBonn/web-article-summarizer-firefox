import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestCompletion } from '@utils/ai/completion-client.js';

describe('requestCompletion', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubWorker(response) {
    const sendMessage = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('browser', { runtime: { sendMessage } });
    return sendMessage;
  }

  it('sends the prompts to the service worker and returns its completion', async () => {
    const sendMessage = stubWorker({ success: true, result: 'answer' });

    const answer = await requestCompletion('anthropic', 'sys', 'user', { maxTokens: 10 });

    expect(answer).toBe('answer');
    expect(sendMessage).toHaveBeenCalledWith({
      action: 'generateCompletion',
      provider: 'anthropic',
      systemPrompt: 'sys',
      userPrompt: 'user',
      options: { maxTokens: 10 },
    });
  });

  it('throws the error the service worker reports', async () => {
    stubWorker({ success: false, error: 'Manca la chiave API' });
    await expect(requestCompletion('groq', 's', 'u')).rejects.toThrow('Manca la chiave API');
  });

  it('throws a reload hint when the service worker does not answer', async () => {
    stubWorker(undefined);
    await expect(requestCompletion('groq', 's', 'u')).rejects.toThrow('Il servizio non risponde');
  });
});
