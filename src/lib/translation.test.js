import { describe, expect, it } from 'vitest';
import { detectInputLanguage, translateText } from './translation.js';

describe('detectInputLanguage', () => {
  it('detects Chinese by Han characters', () => {
    expect(detectInputLanguage('你好，今天怎么样？')).toBe('zh');
  });

  it('detects Japanese by Kana characters', () => {
    expect(detectInputLanguage('こんにちは、今日はどうですか')).toBe('ja');
  });

  it('detects English from Latin text', () => {
    expect(
      detectInputLanguage('Please explain the benefits of local inference in the browser.'),
    ).toBe('en');
  });
});

describe('translateText', () => {
  it('returns original text for same source/target', async () => {
    const out = await translateText({ text: 'hello', source: 'en', target: 'en' });
    expect(out).toBe('hello');
  });

  it('calls translation endpoint and returns translated text', async () => {
    const fetchMock = async () => ({
      ok: true,
      async json() {
        return { translatedText: '你好' };
      },
    });

    const out = await translateText({
      text: 'hello',
      source: 'en',
      target: 'zh',
      apiBase: 'https://example.test',
      fetchImpl: fetchMock,
    });

    expect(out).toBe('你好');
  });
});
