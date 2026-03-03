export const DEFAULT_IMAGE_LIMITS = Object.freeze({
  minEdge: 28,
  maxEdge: 640,
  maxPixels: 640 * 640,
});

export function constrainImageSize(width, height, limits = DEFAULT_IMAGE_LIMITS) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid image size: ${width}x${height}`);
  }

  const minEdge = Math.max(1, Math.floor(limits.minEdge));
  const maxEdge = Math.max(minEdge, Math.floor(limits.maxEdge));
  const maxPixels = Math.max(minEdge * minEdge, Math.floor(limits.maxPixels));

  let nextWidth = Number(width);
  let nextHeight = Number(height);

  const minScale = Math.max(minEdge / nextWidth, minEdge / nextHeight, 1);
  if (minScale > 1) {
    nextWidth *= minScale;
    nextHeight *= minScale;
  }

  const edgeScale = Math.min(1, maxEdge / Math.max(nextWidth, nextHeight));
  if (edgeScale < 1) {
    nextWidth *= edgeScale;
    nextHeight *= edgeScale;
  }

  const pixelScale = Math.min(1, Math.sqrt(maxPixels / (nextWidth * nextHeight)));
  if (pixelScale < 1) {
    nextWidth *= pixelScale;
    nextHeight *= pixelScale;
  }

  const targetWidth = Math.max(minEdge, Math.floor(nextWidth));
  const targetHeight = Math.max(minEdge, Math.floor(nextHeight));

  return {
    width: targetWidth,
    height: targetHeight,
    changed: targetWidth !== width || targetHeight !== height,
  };
}
