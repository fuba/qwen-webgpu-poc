import { describe, expect, it } from 'vitest';
import { getChatStatus } from './chat-status.js';

describe('getChatStatus', () => {
  it('prioritizes error state', () => {
    const out = getChatStatus({
      error: 'something failed',
      isRunning: true,
      isAwaitingFirstToken: true,
      numTokens: 10,
      tps: 5,
    });

    expect(out).toEqual({
      type: 'error',
      text: 'Error: something failed',
    });
  });

  it('shows thinking before first token', () => {
    const out = getChatStatus({
      error: null,
      isRunning: true,
      isAwaitingFirstToken: true,
      numTokens: null,
      tps: null,
    });

    expect(out).toEqual({
      type: 'thinking',
      text: 'Thinking',
    });
  });

  it('shows token speed while generating', () => {
    const out = getChatStatus({
      error: null,
      isRunning: true,
      isAwaitingFirstToken: false,
      numTokens: 32,
      tps: 11.234,
    });

    expect(out).toEqual({
      type: 'speed',
      text: '32 tokens, 11.23 tok/s',
    });
  });

  it('falls back to ready state', () => {
    const out = getChatStatus({
      error: null,
      isRunning: false,
      isAwaitingFirstToken: false,
      numTokens: null,
      tps: null,
    });

    expect(out).toEqual({
      type: 'idle',
      text: 'Ready',
    });
  });
});
