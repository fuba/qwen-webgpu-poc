import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { splitAssistantContent } from './lib/assistant-think.js';
import { getChatStatus } from './lib/chat-status.js';
import { buildLocalFileEntries, summarizeLocalFiles } from './lib/local-files.js';
import { shouldSubmitOnEnter } from './lib/input-submit.js';
import {
  clearLocalFolderSummary,
  loadLocalFolderSummary,
  saveLocalFolderSummary,
} from './lib/local-folder-storage.js';

const EXAMPLES = [
  'Give me 3 quick tips to improve time management today.',
  'List the benefits of running local LLMs with WebGPU.',
  'Briefly explain the benefits of type safety in TypeScript.',
];

marked.setOptions({
  gfm: true,
  breaks: true,
});

function markdownToSafeHtml(text) {
  const rawHtml = marked.parse(String(text || ''));
  return DOMPurify.sanitize(rawHtml);
}

function ProgressBar({ item }) {
  const pct = item.total ? Math.min(100, Math.round((item.progress / item.total) * 100)) : 0;
  return (
    <div className="progress-item">
      <div className="progress-head">
        <span className="file-name">{item.file}</span>
        <span>{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Message({ role, content, images = [] }) {
  const previewImages = images.map((file) => ({
    name: file.name,
    url: URL.createObjectURL(file),
  }));

  if (role === 'assistant') {
    const { think, answer } = splitAssistantContent(content);
    const thinkHtml = think ? markdownToSafeHtml(think) : '';
    const answerHtml = markdownToSafeHtml(answer);

    return (
      <div className="message assistant">
        <div className="role">Qwen</div>
        {think && (
          <div className="think-block">
            <div className="think-label">Thought</div>
            <div
              className="markdown-content think-content"
              dangerouslySetInnerHTML={{ __html: thinkHtml }}
            />
          </div>
        )}
        <div
          className="content markdown-content"
          dangerouslySetInnerHTML={{ __html: answerHtml }}
        />
      </div>
    );
  }

  const userHtml = markdownToSafeHtml(content);
  return (
    <div className="message user">
      <div className="role">You</div>
      {previewImages.length > 0 && (
        <div className="image-strip">
          {previewImages.map((img) => (
            <img
              key={`${img.name}-${img.url}`}
              src={img.url}
              alt={img.name}
              className="chat-image"
              onLoad={() => URL.revokeObjectURL(img.url)}
            />
          ))}
        </div>
      )}
      <div
        className="content markdown-content"
        dangerouslySetInnerHTML={{ __html: userHtml }}
      />
    </div>
  );
}

export default function App() {
  const workerRef = useRef(null);
  const folderInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const resetPendingRef = useRef(false);

  const [webgpuCheckDone, setWebgpuCheckDone] = useState(false);
  const [webgpuAvailable, setWebgpuAvailable] = useState(false);
  const [webgpuReason, setWebgpuReason] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progressItems, setProgressItems] = useState([]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isAwaitingFirstToken, setIsAwaitingFirstToken] = useState(false);
  const [isResetPending, setIsResetPending] = useState(false);
  const [tps, setTps] = useState(null);
  const [numTokens, setNumTokens] = useState(null);

  const [localEntries, setLocalEntries] = useState([]);
  const [localSummary, setLocalSummary] = useState(null);
  const [savedLocalSummary, setSavedLocalSummary] = useState(null);

  useEffect(() => {
    setSavedLocalSummary(loadLocalFolderSummary());
  }, []);

  useEffect(() => {
    async function checkWebGPUOnUI() {
      try {
        if (!window.isSecureContext) {
          setWebgpuReason(
            `This page is not in a secure context (origin: ${window.location.origin}). Use https or localhost for WebGPU.`,
          );
          setWebgpuAvailable(false);
          return;
        }

        if (!('gpu' in navigator) || !navigator.gpu) {
          setWebgpuReason(
            'navigator.gpu was not found. Check your browser settings and use https/localhost.',
          );
          setWebgpuAvailable(false);
          return;
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          setWebgpuReason(
            'Failed to get a WebGPU adapter. Check GPU drivers and browser WebGPU settings.',
          );
          setWebgpuAvailable(false);
          return;
        }

        setWebgpuReason('');
        setWebgpuAvailable(true);
      } catch (err) {
        setWebgpuReason(String(err));
        setWebgpuAvailable(false);
      } finally {
        setWebgpuCheckDone(true);
      }
    }

    checkWebGPUOnUI();
  }, []);

  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module',
      });
      workerRef.current.postMessage({ type: 'check' });
    }

    const onMessage = (e) => {
      const data = e.data;
      switch (data.status) {
        case 'loading':
          setStatus('loading');
          setLoadingMessage(data.data || 'Loading...');
          break;
        case 'initiate':
          setProgressItems((prev) => [...prev, data]);
          break;
        case 'progress':
          setProgressItems((prev) =>
            prev.map((item) => (item.file === data.file ? { ...item, ...data } : item)),
          );
          break;
        case 'done':
          setProgressItems((prev) => prev.filter((item) => item.file !== data.file));
          break;
        case 'ready':
          setStatus('ready');
          setLoadingMessage('');
          break;
        case 'start':
          setIsRunning(true);
          setIsAwaitingFirstToken(true);
          setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
          break;
        case 'update': {
          setTps(data.tps || null);
          setNumTokens(data.numTokens || null);
          setIsAwaitingFirstToken(false);
          setMessages((prev) => {
            const cloned = [...prev];
            const last = cloned[cloned.length - 1];
            if (!last || last.role !== 'assistant') {
              return [...prev, { role: 'assistant', content: data.output || '' }];
            }
            cloned[cloned.length - 1] = {
              ...last,
              content: `${last.content}${data.output || ''}`,
            };
            return cloned;
          });
          break;
        }
        case 'complete':
          setIsRunning(false);
          setIsAwaitingFirstToken(false);
          if (resetPendingRef.current) {
            applyChatReset();
          }
          break;
        case 'error':
          setError(data.data || 'Unknown worker error');
          setIsRunning(false);
          setIsAwaitingFirstToken(false);
          if (resetPendingRef.current) {
            applyChatReset();
          }
          break;
        default:
          break;
      }
    };

    const onError = (e) => {
      setError(e.message || 'Worker crashed');
      setIsRunning(false);
      setIsAwaitingFirstToken(false);
      if (resetPendingRef.current) {
        setResetPending(false);
      }
    };

    workerRef.current.addEventListener('message', onMessage);
    workerRef.current.addEventListener('error', onError);
    return () => {
      workerRef.current?.removeEventListener('message', onMessage);
      workerRef.current?.removeEventListener('error', onError);
    };
  }, []);

  useEffect(() => {
    if (!messages.length) {
      return;
    }
    if (messages[messages.length - 1].role !== 'user') {
      return;
    }
    workerRef.current.postMessage({ type: 'generate', data: messages });
  }, [messages]);

  function submitMessage(text) {
    const trimmed = text.trim();
    if ((!trimmed && pendingImages.length === 0) || isRunning || status !== 'ready') {
      return;
    }

    setError(null);
    const content = trimmed || 'Describe this image.';
    const images = [...pendingImages];
    setInput('');
    setPendingImages([]);
    setTps(null);
    setNumTokens(null);
    setMessages((prev) => [...prev, { role: 'user', content, images }]);
  }

  function onSelectMessageImages(event) {
    const files = Array.from(event.target.files || []);
    const images = files.filter((file) => file.type.startsWith('image/'));
    setPendingImages(images);
    event.target.value = '';
  }

  function onLocalFolderSelected(event) {
    const files = Array.from(event.target.files || []);
    const entries = buildLocalFileEntries(files);
    if (!entries.length) {
      return;
    }

    const summary = summarizeLocalFiles(entries);
    setLocalEntries(entries);
    setLocalSummary(summary);
    saveLocalFolderSummary(summary);
    setSavedLocalSummary(loadLocalFolderSummary());
    loadLocalModel(entries);
    event.target.value = '';
  }

  function loadLocalModel(entriesInput = null) {
    const entriesToLoad = entriesInput ?? localEntries;
    if (!entriesToLoad.length) {
      return;
    }
    setError(null);
    setProgressItems([]);
    setStatus('loading');
    workerRef.current.postMessage({ type: 'setLocalFiles', data: entriesToLoad });
    workerRef.current.postMessage({ type: 'load' });
  }

  function interrupt() {
    workerRef.current.postMessage({ type: 'interrupt' });
  }

  function setResetPending(next) {
    resetPendingRef.current = next;
    setIsResetPending(next);
  }

  function applyChatReset() {
    workerRef.current.postMessage({ type: 'reset' });
    setMessages([]);
    setInput('');
    setPendingImages([]);
    setTps(null);
    setNumTokens(null);
    setIsAwaitingFirstToken(false);
    setIsRunning(false);
    setResetPending(false);
  }

  function resetChat() {
    if (isRunning || resetPendingRef.current) {
      if (!resetPendingRef.current) {
        setResetPending(true);
      }
      workerRef.current.postMessage({ type: 'interrupt' });
      return;
    }
    applyChatReset();
  }

  function resetSavedFolderState() {
    clearLocalFolderSummary();
    setSavedLocalSummary(null);
    setLocalSummary(null);
    setLocalEntries([]);
  }

  const displayedSummary = localSummary ?? savedLocalSummary;
  const showLoadLabelOnSetup = Boolean(savedLocalSummary) && localEntries.length === 0;
  const chatStatus = getChatStatus({
    error,
    isRunning,
    isAwaitingFirstToken,
    numTokens,
    tps,
  });

  if (!webgpuCheckDone) {
    return (
      <div className="shell">
        <h1>Checking WebGPU...</h1>
      </div>
    );
  }

  if (!webgpuAvailable) {
    return (
      <div className="shell">
        <h1>WebGPU is not available</h1>
        <p>{webgpuReason || 'Failed to initialize WebGPU.'}</p>
        <p>Recommended: open `http://localhost:5180` or an HTTPS URL.</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="hero">
        <h1>Qwen3.5-0.8B WebGPU PoC</h1>
        <p>
          <a href="https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX" target="_blank" rel="noreferrer">
            onnx-community/Qwen3.5-0.8B-ONNX
          </a>
          {' '}runs directly in your browser.
        </p>
      </header>

      {status !== 'ready' && (
        <section className="card">
          <h2>Model Setup</h2>
          <p>
            Selecting a local folder triggers auto-load.
            Choose a directory that contains <code>tokenizer.json</code> and <code>onnx/*.onnx</code>.
          </p>

          <div className="controls-row">
            <label className="button button-secondary">
              {showLoadLabelOnSetup ? 'Load local model' : 'Browse folder'}
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={onLocalFolderSelected}
              />
            </label>
            <button
              className="button"
              onClick={resetSavedFolderState}
              disabled={!displayedSummary || status === 'loading'}
            >
              Reset saved folder info
            </button>
          </div>

          {displayedSummary && (
            <p className="hint">
              files: {displayedSummary.count} / {displayedSummary.totalMB} MB / tokenizer:{' '}
              {displayedSummary.foundTokenizer ? 'yes' : 'no'} / onnx: {displayedSummary.foundOnnx ? 'yes' : 'no'}
              {displayedSummary.savedAt ? ` / saved: ${displayedSummary.savedAt}` : ''}
            </p>
          )}

          {status === 'loading' && (
            <div className="loading-block">
              <p>{loadingMessage || 'Loading model...'}</p>
              {progressItems.map((item, index) => (
                <ProgressBar key={`${item.file}-${index}`} item={item} />
              ))}
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <p className="hint">
            Local model example: <code>git lfs install && git clone https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX</code>
          </p>
        </section>
      )}

      {status === 'ready' && (
        <section className="chat-card">
          <div className="chat-toolbar">
            <div className="toolbar-left">
              <label className="button button-secondary button-compact">
                Browse folder
                <input
                  type="file"
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                  onChange={onLocalFolderSelected}
                />
              </label>
              <button className="button button-compact" onClick={resetSavedFolderState} disabled={!displayedSummary}>
                Reset saved folder info
              </button>
            </div>
            <div className="toolbar-right">
              <button className="button button-compact" onClick={resetChat} disabled={isResetPending}>
                {isResetPending ? 'Stopping...' : 'Reset chat'}
              </button>
            </div>
          </div>

          <div className="chat-log">
            {messages.length === 0 && (
              <div className="examples">
                {EXAMPLES.map((example) => (
                  <button key={example} className="example" onClick={() => submitMessage(example)}>
                    {example}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) => (
              <Message key={`${msg.role}-${i}`} role={msg.role} content={msg.content} images={msg.images || []} />
            ))}
          </div>

          <div className={`stats status-${chatStatus.type}`}>
            {chatStatus.text}
            {chatStatus.type === 'thinking' && (
              <span className="thinking-dots" aria-hidden="true">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            )}
          </div>

          <div className="composer">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message"
              onKeyDown={(e) => {
                if (shouldSubmitOnEnter({
                  key: e.key,
                  shiftKey: e.shiftKey,
                  isComposing: e.isComposing,
                  nativeEventIsComposing: e.nativeEvent?.isComposing ?? false,
                  keyCode: e.keyCode,
                })) {
                  e.preventDefault();
                  submitMessage(input);
                }
              }}
            />
            <div className="composer-actions">
              <label className="button button-secondary button-compact">
                Upload image
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onSelectMessageImages}
                />
              </label>
              {pendingImages.length > 0 && (
                <span className="pending-images">{pendingImages.length} image(s) selected</span>
              )}
              {isRunning ? (
                <button className="button danger" onClick={interrupt}>
                  Stop
                </button>
              ) : (
                <button className="button" onClick={() => submitMessage(input)}>
                  Send
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
