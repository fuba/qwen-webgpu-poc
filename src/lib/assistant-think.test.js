import { describe, expect, it } from 'vitest';
import { splitAssistantContent } from './assistant-think.js';

describe('splitAssistantContent', () => {
  it('extracts think section and visible answer', () => {
    const input = '<think>internal notes</think>Visible answer';
    const out = splitAssistantContent(input);
    expect(out.think).toBe('internal notes');
    expect(out.answer).toBe('Visible answer');
  });

  it('keeps full answer when no think tags are present', () => {
    const out = splitAssistantContent('Plain response text');
    expect(out.think).toBe('');
    expect(out.answer).toBe('Plain response text');
  });

  it('merges multiple think segments', () => {
    const input = '<think>a</think>ans<think>b</think>wer';
    const out = splitAssistantContent(input);
    expect(out.think).toBe('a\n\nb');
    expect(out.answer).toBe('answer');
  });

  it('removes unmatched think tag tokens from answer', () => {
    const input = '<think>pending reasoning';
    const out = splitAssistantContent(input);
    expect(out.think).toBe('');
    expect(out.answer).toBe('pending reasoning');
  });
});
