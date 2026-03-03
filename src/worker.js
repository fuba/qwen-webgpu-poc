import {
  AutoModelForImageTextToText,
  AutoProcessor,
  InterruptableStoppingCriteria,
  RawImage,
  TextStreamer,
  env,
} from '@huggingface/transformers';
import { constrainImageSize } from './lib/image-limits.js';
import { buildConversationAndImages } from './lib/multimodal-messages.js';

const MODEL_ID = 'onnx-community/Qwen3.5-0.8B-ONNX';

class ModelSingleton {
  static async getInstance(progress_callback = null) {
    this.processor ??= AutoProcessor.from_pretrained(MODEL_ID, {
      progress_callback,
    });

    this.model ??= AutoModelForImageTextToText.from_pretrained(MODEL_ID, {
      device: 'webgpu',
      dtype: 'q4f16',
      progress_callback,
    });

    return Promise.all([this.processor, this.model]);
  }

  static reset() {
    this.processor = undefined;
    this.model = undefined;
  }
}

const stoppingCriteria = new InterruptableStoppingCriteria();
let localFileMap = null;

function normalizePath(path) {
  return path.replace(/^\/+/, '').replace(/\\/g, '/');
}

function configureLocalFiles(files) {
  localFileMap = new Map();

  for (const entry of files) {
    const rel = normalizePath(entry.path || entry.name);
    localFileMap.set(rel, entry.file);
    localFileMap.set(normalizePath(entry.name), entry.file);
  }

  env.useCustomCache = true;
  env.customCache = {
    async match(request) {
      if (!localFileMap) {
        return undefined;
      }

      try {
        const key = request?.url || String(request);
        let rel = key;

        const resolveIdx = rel.indexOf('/resolve/');
        if (resolveIdx !== -1) {
          const afterResolve = rel.slice(resolveIdx + '/resolve/'.length);
          const firstSlash = afterResolve.indexOf('/');
          rel = firstSlash === -1 ? afterResolve : afterResolve.slice(firstSlash + 1);
        }

        rel = normalizePath(rel);

        let blob = localFileMap.get(rel);
        if (!blob && !rel.startsWith('onnx/')) {
          blob = localFileMap.get(`onnx/${rel}`);
        }
        if (!blob) {
          const basename = rel.split('/').at(-1);
          blob = localFileMap.get(basename);
        }
        if (!blob) {
          return undefined;
        }

        const headers = new Headers();
        headers.set('content-length', `${blob.size || 0}`);
        headers.set('content-type', blob.type || 'application/octet-stream');
        return new Response(blob, { headers });
      } catch {
        return undefined;
      }
    },
    async put() {},
  };

  env.allowLocalModels = true;
  env.allowRemoteModels = true;
}

async function loadWithWarmup() {
  self.postMessage({
    status: 'loading',
    data: 'Loading model...',
  });

  const [processor, model] = await ModelSingleton.getInstance((progress) => {
    self.postMessage(progress);
  });

  self.postMessage({
    status: 'loading',
    data: 'Compiling shaders...',
  });

  const warmupPrompt = processor.apply_chat_template(
    [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    { add_generation_prompt: true },
  );

  const warmupInputs = await processor(warmupPrompt);
  await model.generate({
    ...warmupInputs,
    max_new_tokens: 1,
  });

  self.postMessage({ status: 'ready' });
}

async function downloadOnly() {
  self.postMessage({
    status: 'loading',
    data: 'Downloading model files...',
  });

  await ModelSingleton.getInstance((progress) => {
    self.postMessage(progress);
  });

  self.postMessage({ status: 'ready' });
}

async function generate(messages) {
  const [processor, model] = await ModelSingleton.getInstance();
  const tokenizer = processor.tokenizer;

  const { conversation, images } = buildConversationAndImages(messages);
  const prompt = processor.apply_chat_template(conversation, {
    add_generation_prompt: true,
  });

  const rawImages = images.length > 0
    ? await Promise.all(
      images.map(async (image) => {
        const decoded = await RawImage.read(image);
        const size = constrainImageSize(decoded.width, decoded.height);
        if (!size.changed) {
          return decoded;
        }
        return decoded.resize(size.width, size.height);
      }),
    )
    : null;

  const imageInputs = rawImages
    ? (rawImages.length === 1 ? rawImages[0] : rawImages)
    : null;
  const inputs = imageInputs ? await processor(prompt, imageInputs) : await processor(prompt);

  let startTime = null;
  let numTokens = 0;
  let tps = 0;

  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (output) => {
      self.postMessage({
        status: 'update',
        output,
        tps,
        numTokens,
      });
    },
    token_callback_function: () => {
      startTime ??= performance.now();
      numTokens += 1;
      const elapsed = performance.now() - startTime;
      if (elapsed > 0) {
        tps = (numTokens / elapsed) * 1000;
      }
    },
  });

  self.postMessage({ status: 'start' });

  try {
    await model.generate({
      ...inputs,
      do_sample: true,
      temperature: 0.6,
      top_p: 0.95,
      top_k: 20,
      max_new_tokens: rawImages ? 256 : 512,
      streamer,
      stopping_criteria: stoppingCriteria,
      return_dict_in_generate: true,
    });
  } catch (error) {
    if (String(error).includes('memory access out of bounds') && rawImages) {
      throw new Error(
        'Image inference ran out of memory. Try a smaller image (the app now auto-resizes to 640px max edge).',
      );
    }
    throw error;
  }
  self.postMessage({ status: 'complete' });
}

async function checkWebGPU() {
  try {
    if (!self.isSecureContext) {
      throw new Error('WebGPU requires a secure context (https or localhost).');
    }
    if (!navigator.gpu) {
      throw new Error('navigator.gpu is not available in this context.');
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No WebGPU adapter found');
    }
  } catch (error) {
    self.postMessage({ status: 'error', data: String(error) });
  }
}

self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'check':
        await checkWebGPU();
        break;
      case 'setLocalFiles':
        ModelSingleton.reset();
        configureLocalFiles(data || []);
        break;
      case 'download':
        await downloadOnly();
        break;
      case 'load':
        await loadWithWarmup();
        break;
      case 'generate':
        stoppingCriteria.reset();
        await generate(data || []);
        break;
      case 'interrupt':
        stoppingCriteria.interrupt();
        break;
      case 'reset':
        stoppingCriteria.reset();
        break;
      default:
        break;
    }
  } catch (error) {
    self.postMessage({ status: 'error', data: String(error) });
    self.postMessage({ status: 'complete' });
  }
});
