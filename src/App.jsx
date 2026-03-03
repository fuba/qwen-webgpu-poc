import { useEffect, useRef, useState } from 'react';
import { shouldSubmitOnEnter } from './lib/input-submit.js';
import { buildLocalFileEntries, summarizeLocalFiles } from './lib/local-files.js';
import {
  clearLocalFolderSummary,
  loadLocalFolderSummary,
  saveLocalFolderSummary,
} from './lib/local-folder-storage.js';
import {
  DEFAULT_TRANSLATE_API_BASE,
  detectInputLanguage,
  translateText,
} from './lib/translation.js';

const TRANSLATE_API_BASE = import.meta.env.VITE_TRANSLATE_API_BASE || DEFAULT_TRANSLATE_API_BASE;

const EXAMPLES = [
  'Give me 3 quick tips to improve time management today.',
  'List the benefits of running local LLMs with WebGPU.',
  'Briefly explain the benefits of type safety in TypeScript.',
];

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

function Message({ role, content }) {
  return (
    <div className={`message ${role === 'user' ? 'user' : 'assistant'}`}>
      <div className="role">{role === 'user' ? 'You' : 'Qwen'}</div>
      <div className="content">{content}</div>
    </div>
  );
}

export default function App() {
  const workerRef = useRef(null);
  const resetPendingRef = useRef(false);
  const responseTargetLanguageRef = useRef('zh');
  const streamingAssistantRef = useRef('');

  const [webgpuCheckDone, setWebgpuCheckDone] = useState(false);
  const [webgpuAvailable, setWebgpuAvailable] = useState(false);
  const [webgpuReason, setWebgpuReason] = useState('');

  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progressItems, setProgressItems] = useState([]);

  const [uiMessages, setUiMessages] = useState([]);
  const [modelMessages, setModelMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isResetPending, setIsResetPending] = useState(false);
  const [isPreparingInput, setIsPreparingInput] = useState(false);
  const [isTranslatingResponse, setIsTranslatingResponse] = useState(false);
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

  function setResetPending(next) {
    resetPendingRef.current = next;
    setIsResetPending(next);
  }

  function replaceLastAssistantContent(content) {
    setUiMessages((prev) => {
      const cloned = [...prev];
      for (let i = cloned.length - 1; i >= 0; i -= 1) {
        if (cloned[i].role === 'assistant') {
          cloned[i] = { ...cloned[i], content };
          break;
        }
      }
      return cloned;
    });
  }

  async function finalizeAssistantResponse() {
    const rawAssistant = streamingAssistantRef.current;
    const targetLanguage = responseTargetLanguageRef.current;

    setModelMessages((prev) => [...prev, { role: 'assistant', content: rawAssistant }]);

    if (targetLanguage === 'zh') {
      return;
    }

    setIsTranslatingResponse(true);
    replaceLastAssistantContent('Translating response...');
    try {
      const translated = await translateText({
        text: rawAssistant,
        source: 'zh',
        target: targetLanguage,
        apiBase: TRANSLATE_API_BASE,
      });
      replaceLastAssistantContent(translated);
    } catch (err) {
      replaceLastAssistantContent(rawAssistant);
      setError(`Failed to translate assistant output. Showing original text. (${String(err)})`);
    } finally {
      setIsTranslatingResponse(false);
    }
  }

  function applyChatReset() {
    workerRef.current.postMessage({ type: 'reset' });
    setUiMessages([]);
    setModelMessages([]);
    setInput('');
    setTps(null);
    setNumTokens(null);
    setIsRunning(false);
    setIsPreparingInput(false);
    setIsTranslatingResponse(false);
    streamingAssistantRef.current = '';
    responseTargetLanguageRef.current = 'zh';
    setResetPending(false);
  }

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
        case 'start': {
          setIsRunning(true);
          streamingAssistantRef.current = '';
          const initial = responseTargetLanguageRef.current === 'zh' ? '' : 'Generating response...';
          setUiMessages((prev) => [...prev, { role: 'assistant', content: initial }]);
          break;
        }
        case 'update': {
          const chunk = data.output || '';
          streamingAssistantRef.current += chunk;
          setTps(data.tps || null);
          setNumTokens(data.numTokens || null);

          if (responseTargetLanguageRef.current === 'zh') {
            setUiMessages((prev) => {
              const cloned = [...prev];
              const last = cloned[cloned.length - 1];
              if (!last || last.role !== 'assistant') {
                return [...prev, { role: 'assistant', content: chunk }];
              }
              cloned[cloned.length - 1] = {
                ...last,
                content: `${last.content}${chunk}`,
              };
              return cloned;
            });
          }
          break;
        }
        case 'complete':
          setIsRunning(false);
          if (resetPendingRef.current) {
            applyChatReset();
          } else {
            void finalizeAssistantResponse();
          }
          break;
        case 'error':
          setError(data.data || 'Unknown worker error');
          setIsRunning(false);
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
    if (!modelMessages.length) {
      return;
    }
    if (modelMessages[modelMessages.length - 1].role !== 'user') {
      return;
    }
    workerRef.current.postMessage({ type: 'generate', data: modelMessages });
  }, [modelMessages]);

  async function submitMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || isRunning || status !== 'ready' || isPreparingInput || isTranslatingResponse) {
      return;
    }

    setError(null);
    setInput('');
    setTps(null);
    setNumTokens(null);

    const detectedLanguage = detectInputLanguage(trimmed);
    responseTargetLanguageRef.current = detectedLanguage;

    let modelText = trimmed;
    if (detectedLanguage !== 'zh') {
      setIsPreparingInput(true);
      try {
        modelText = await translateText({
          text: trimmed,
          source: detectedLanguage,
          target: 'zh',
          apiBase: TRANSLATE_API_BASE,
        });
      } catch (err) {
        setError(`Failed to translate input. Sending original text. (${String(err)})`);
        responseTargetLanguageRef.current = 'zh';
        modelText = trimmed;
      } finally {
        setIsPreparingInput(false);
      }
    }

    setUiMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setModelMessages((prev) => [...prev, { role: 'user', content: modelText }]);
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
            {uiMessages.length === 0 && (
              <div className="examples">
                {EXAMPLES.map((example) => (
                  <button key={example} className="example" onClick={() => submitMessage(example)}>
                    {example}
                  </button>
                ))}
              </div>
            )}
            {uiMessages.map((msg, i) => (
              <Message key={`${msg.role}-${i}`} role={msg.role} content={msg.content} />
            ))}
          </div>

          <div className="stats">
            {isPreparingInput && 'Translating input to Chinese...'}
            {!isPreparingInput && isTranslatingResponse && 'Translating response back...'}
            {!isPreparingInput && !isTranslatingResponse && tps && numTokens ? `${numTokens} tokens, ${tps.toFixed(2)} tok/s` : null}
            {!isPreparingInput && !isTranslatingResponse && !tps && !numTokens ? 'Ready' : null}
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
                  void submitMessage(input);
                }
              }}
            />
            {isRunning ? (
              <button className="button danger" onClick={interrupt}>
                Stop
              </button>
            ) : (
              <button className="button" onClick={() => void submitMessage(input)} disabled={isPreparingInput || isTranslatingResponse}>
                Send
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
