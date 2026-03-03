import { describe, expect, it } from 'vitest';
import { shouldSubmitOnEnter } from './input-submit.js';

describe('shouldSubmitOnEnter', () => {
  it('returns true for Enter without Shift when not composing', () => {
    expect(
      shouldSubmitOnEnter({
        key: 'Enter',
        shiftKey: false,
        isComposing: false,
        nativeEventIsComposing: false,
        keyCode: 13,
      }),
    ).toBe(true);
  });

  it('returns false for Shift+Enter', () => {
    expect(
      shouldSubmitOnEnter({
        key: 'Enter',
        shiftKey: true,
        isComposing: false,
        nativeEventIsComposing: false,
        keyCode: 13,
      }),
    ).toBe(false);
  });

  it('returns false while IME composition is active', () => {
    expect(
      shouldSubmitOnEnter({
        key: 'Enter',
        shiftKey: false,
        isComposing: true,
        nativeEventIsComposing: true,
        keyCode: 13,
      }),
    ).toBe(false);
  });

  it('returns false for keyCode 229 (IME processing)', () => {
    expect(
      shouldSubmitOnEnter({
        key: 'Enter',
        shiftKey: false,
        isComposing: false,
        nativeEventIsComposing: false,
        keyCode: 229,
      }),
    ).toBe(false);
  });
});
