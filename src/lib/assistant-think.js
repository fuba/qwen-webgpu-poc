export function splitAssistantContent(content) {
  const text = String(content || '');

  const thinkSegments = Array.from(text.matchAll(/<think>([\s\S]*?)<\/think>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean);

  const think = thinkSegments.join('\n\n').trim();
  const answer = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();

  return { think, answer };
}
