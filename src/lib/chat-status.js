export function getChatStatus({
  error,
  isRunning,
  isAwaitingFirstToken,
  numTokens,
  tps,
}) {
  if (error) {
    return {
      type: 'error',
      text: `Error: ${error}`,
    };
  }

  if (isRunning && isAwaitingFirstToken) {
    return {
      type: 'thinking',
      text: 'Thinking',
    };
  }

  if (Number.isFinite(tps) && tps > 0 && Number.isFinite(numTokens) && numTokens > 0) {
    return {
      type: 'speed',
      text: `${numTokens} tokens, ${tps.toFixed(2)} tok/s`,
    };
  }

  return {
    type: 'idle',
    text: 'Ready',
  };
}
