import { franc } from 'franc-min';

export const DEFAULT_TRANSLATE_API_BASE = 'https://translate.argosopentech.com';

const FRANC_TO_LANG = {
  cmn: 'zh',
  zho: 'zh',
  yue: 'zh',
  eng: 'en',
  jpn: 'ja',
  kor: 'ko',
  spa: 'es',
  fra: 'fr',
  deu: 'de',
  ita: 'it',
  por: 'pt',
  rus: 'ru',
};

export function detectInputLanguage(text) {
  const value = String(text || '').trim();
  if (!value) {
    return 'en';
  }

  if (/[\u3040-\u30ff]/.test(value)) {
    return 'ja';
  }

  if (/[\uac00-\ud7af]/.test(value)) {
    return 'ko';
  }

  if (/[\u4e00-\u9fff]/.test(value)) {
    return 'zh';
  }

  const detected = franc(value, { minLength: 3 });
  return FRANC_TO_LANG[detected] || 'en';
}

export async function translateText({
  text,
  source,
  target,
  apiBase = DEFAULT_TRANSLATE_API_BASE,
  fetchImpl = fetch,
}) {
  const value = String(text || '');
  if (!value.trim() || source === target) {
    return value;
  }

  const response = await fetchImpl(`${apiBase}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: value,
      source,
      target,
      format: 'text',
    }),
  });

  if (!response.ok) {
    throw new Error(`Translation API failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload.translatedText !== 'string') {
    throw new Error('Translation API returned an invalid payload');
  }

  return payload.translatedText;
}
