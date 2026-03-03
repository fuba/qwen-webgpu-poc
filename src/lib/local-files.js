export function normalizePath(path) {
  return path.replace(/^\/+/, '').replace(/\\/g, '/');
}

export function buildLocalFileEntries(files) {
  return Array.from(files).map((file) => ({
    path: file.webkitRelativePath || file.name,
    name: file.name,
    size: file.size,
    type: file.type,
    file,
  }));
}

export function summarizeLocalFiles(entries) {
  const totalBytes = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
  const foundTokenizer = entries.some((entry) =>
    normalizePath(entry.path).endsWith('tokenizer.json'),
  );
  const foundOnnx = entries.some((entry) => /onnx\/.+\.onnx$/i.test(normalizePath(entry.path)));

  return {
    count: entries.length,
    totalMB,
    foundTokenizer,
    foundOnnx,
  };
}
