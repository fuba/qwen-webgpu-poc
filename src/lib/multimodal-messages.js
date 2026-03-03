export function buildConversationAndImages(messages) {
  const images = [];

  const conversation = messages.map((message) => {
    const role = message.role;
    const text = String(message.content || '').trim();

    if (role === 'user') {
      const content = [];
      const msgImages = Array.isArray(message.images) ? message.images : [];
      for (const image of msgImages) {
        content.push({ type: 'image' });
        images.push(image);
      }

      if (text) {
        content.push({ type: 'text', text });
      }

      if (content.length === 0) {
        content.push({ type: 'text', text: 'Describe this image.' });
      }

      return { role, content };
    }

    return {
      role,
      content: [{ type: 'text', text }],
    };
  });

  return { conversation, images };
}
