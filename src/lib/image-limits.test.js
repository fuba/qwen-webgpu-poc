import { describe, expect, it } from 'vitest';
import { constrainImageSize } from './image-limits.js';

describe('constrainImageSize', () => {
  it('keeps already safe sizes unchanged', () => {
    const out = constrainImageSize(640, 480);
    expect(out).toEqual({ width: 640, height: 480, changed: false });
  });

  it('downscales very large images', () => {
    const out = constrainImageSize(4032, 3024);
    expect(out.changed).toBe(true);
    expect(Math.max(out.width, out.height)).toBeLessThanOrEqual(640);
    expect(out.width * out.height).toBeLessThanOrEqual(640 * 640);
  });

  it('upscales tiny images to minimum edge', () => {
    const out = constrainImageSize(20, 10);
    expect(out.changed).toBe(true);
    expect(out.width).toBeGreaterThanOrEqual(28);
    expect(out.height).toBeGreaterThanOrEqual(28);
  });

  it('throws on invalid dimensions', () => {
    expect(() => constrainImageSize(0, 100)).toThrow('Invalid image size');
  });
});
