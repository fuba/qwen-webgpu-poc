import { describe, expect, it } from 'vitest';
import {
  buildLocalFileEntries,
  normalizePath,
  summarizeLocalFiles,
} from './local-files.js';

describe('normalizePath', () => {
  it('removes leading slash and normalizes separators', () => {
    expect(normalizePath('/onnx\\decoder_model.onnx')).toBe(
      'onnx/decoder_model.onnx',
    );
  });
});

describe('buildLocalFileEntries', () => {
  it('maps files to path/name objects', () => {
    const fakeFile = { name: 'tokenizer.json', size: 10, type: 'application/json' };
    const entries = buildLocalFileEntries([
      { ...fakeFile, webkitRelativePath: 'model/tokenizer.json' },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe('model/tokenizer.json');
    expect(entries[0].name).toBe('tokenizer.json');
  });
});

describe('summarizeLocalFiles', () => {
  it('detects tokenizer and onnx files', () => {
    const entries = [
      { path: 'model/tokenizer.json', name: 'tokenizer.json', size: 12, type: 'application/json' },
      { path: 'model/onnx/decoder_model_merged_q4f16.onnx', name: 'decoder_model_merged_q4f16.onnx', size: 100, type: 'application/octet-stream' },
    ];

    const summary = summarizeLocalFiles(entries);
    expect(summary.count).toBe(2);
    expect(summary.foundTokenizer).toBe(true);
    expect(summary.foundOnnx).toBe(true);
  });
});
