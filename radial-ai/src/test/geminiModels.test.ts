import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  pickReplacementModel, isModelUnavailableError, geminiGenerateContent,
} from '../../api/_geminiModels';

const AVAILABLE = [
  'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-3-pro-image-preview',
  'gemini-3.8-flash-preview-tts', 'gemma-4-31b-it',
];

describe('pickReplacementModel', () => {
  it('stays in the same tier and takes the newest version', () => {
    expect(pickReplacementModel('gemini-3.1-flash-lite-preview', AVAILABLE)).toBe('gemini-3.5-flash-lite');
    expect(pickReplacementModel('gemini-3-flash-preview', AVAILABLE)).toBe('gemini-3.8-flash');
    expect(pickReplacementModel('gemini-3-pro-preview', AVAILABLE)).toBe('gemini-3.1-pro-preview');
  });

  it('never picks image / tts / non-gemini variants', () => {
    expect(pickReplacementModel('gemini-9-pro', ['gemini-3-pro-image-preview', 'gemma-4-31b-it'])).toBeNull();
  });

  it('prefers stable over preview at the same version and compares versions numerically', () => {
    expect(pickReplacementModel('gemini-1-flash', ['gemini-3.9-flash', 'gemini-3.10-flash-preview', 'gemini-3.10-flash']))
      .toBe('gemini-3.10-flash');
  });

  it('falls back to a neighbouring tier, and unknown ids to flash-lite', () => {
    expect(pickReplacementModel('gemini-3.1-flash-lite', ['gemini-3.8-flash'])).toBe('gemini-3.8-flash');
    expect(pickReplacementModel('gemma-3-27b-it', AVAILABLE)).toBe('gemini-3.5-flash-lite');
  });
});

describe('isModelUnavailableError', () => {
  it('flags missing-model errors but not key / quota errors', () => {
    expect(isModelUnavailableError(404, { error: { status: 'NOT_FOUND' } })).toBe(true);
    expect(isModelUnavailableError(400, { error: { message: 'models/x is not found for API version v1beta' } })).toBe(true);
    expect(isModelUnavailableError(400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid.' } })).toBe(false);
    expect(isModelUnavailableError(429, { error: { status: 'RESOURCE_EXHAUSTED' } })).toBe(false);
  });
});

describe('geminiGenerateContent', () => {
  afterEach(() => vi.unstubAllGlobals());

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('discovers a live model on 404, retries, and remembers the replacement', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url.replace(/\?.*/, '').replace(/^.*\/v1beta\//, ''));
      if (url.includes('/models?')) {
        return json(200, { models: AVAILABLE.map(id => ({ name: `models/${id}`, supportedGenerationMethods: ['generateContent'] })) });
      }
      if (url.includes('gemini-0.1-flash-lite-preview')) return json(404, { error: { status: 'NOT_FOUND' } });
      return json(200, { candidates: [] });
    }));

    const first = await geminiGenerateContent('k', 'gemini-0.1-flash-lite-preview', {});
    expect(first.res.ok).toBe(true);
    expect(first.model).toBe('gemini-3.5-flash-lite');
    expect(calls).toEqual([
      'models/gemini-0.1-flash-lite-preview:generateContent',
      'models',
      'models/gemini-3.5-flash-lite:generateContent',
    ]);

    calls.length = 0;
    await geminiGenerateContent('k', 'gemini-0.1-flash-lite-preview', {});
    expect(calls).toEqual(['models/gemini-3.5-flash-lite:generateContent']);
  });

  it('returns the original error untouched for non-model failures', async () => {
    const fetchMock = vi.fn(async () => json(400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid.' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { res, model } = await geminiGenerateContent('bad', 'gemini-3.8-flash', {});
    expect(res.status).toBe(400);
    expect(model).toBe('gemini-3.8-flash');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
