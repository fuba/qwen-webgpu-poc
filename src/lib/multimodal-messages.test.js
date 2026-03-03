import { describe, expect, it } from 'vitest';
import { buildConversationAndImages } from './multimodal-messages.js';

describe('buildConversationAndImages', () => {
  it('builds text-only conversation', () => {
    const input = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ];

    const out = buildConversationAndImages(input);
    expect(out.images).toHaveLength(0);
    expect(out.conversation).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Hi' }] },
    ]);
  });

  it('adds image placeholders and preserves order', () => {
    const img1 = { name: 'a.png' };
    const img2 = { name: 'b.png' };
    const input = [{ role: 'user', content: 'Describe', images: [img1, img2] }];

    const out = buildConversationAndImages(input);
    expect(out.images).toEqual([img1, img2]);
    expect(out.conversation[0].content).toEqual([
      { type: 'image' },
      { type: 'image' },
      { type: 'text', text: 'Describe' },
    ]);
  });

  it('creates default prompt for empty user message', () => {
    const out = buildConversationAndImages([{ role: 'user', content: '' }]);
    expect(out.conversation[0].content).toEqual([{ type: 'text', text: 'Describe this image.' }]);
  });
});
