import { useEffect, useRef, useState } from 'react';
import { buildLocalFileEntries, summarizeLocalFiles } from './lib/local-files.js';

const EXAMPLES = [
  '3行で今日のタスク管理のコツを教えて。',
  'WebGPUでローカルLLMを使うメリットを箇条書きで。',
  'TypeScriptの型安全の利点を短く説明して。',
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
  const [webgpuCheckDone, setWebgpuCheckDone] = useState(false);
  const [webgpuAvailable, setWebgpuAvailable] = useState(false);
  const [webgpuReason, setWebgpuReason] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progressItems, setProgressItems] = useState([]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [tps, setTps] = useState(null);
  const [numTokens, setNumTokens] = useState(null);

  const [localEntries, setLocalEntries] = useState([]);
  const [localSummary, setLocalSummary] = useState(null);

  useEffect(() => {
    async function checkWebGPUOnUI() {
      try {
        if (!window.isSecureContext) {
          setWebgpuReason(
            `このページはセキュア文脈ではありません (origin: ${window.location.origin})。WebGPU は https または localhost で開いてください。`,
          );
          setWebgpuAvailable(false);
          return;
        }

        if (!('gpu' in navigator) || !navigator.gpu) {
          setWebgpuReason(
            'navigator.gpu が見つかりません。ブラウザ設定かURL(https/localhost)を確認してください。',
          );
          setWebgpuAvailable(false);
          return;
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          setWebgpuReason(
            'WebGPUアダプタを取得できませんでした。GPUドライバ/ブラウザ設定を確認してください。',
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
          setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
          break;
        case 'update': {
          setTps(data.tps || null);
          setNumTokens(data.numTokens || null);
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
          break;
        case 'error':
          setError(data.data || 'Unknown worker error');
          setIsRunning(false);
          break;
        default:
          break;
      }
    };

    const onError = (e) => {
      setError(e.message || 'Worker crashed');
      setIsRunning(false);
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
    if (!trimmed || isRunning || status !== 'ready') {
      return;
    }
    setInput('');
    setTps(null);
    setNumTokens(null);
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
  }

  function onLocalFolderSelected(event) {
    const files = Array.from(event.target.files || []);
    const entries = buildLocalFileEntries(files);
    setLocalEntries(entries);
    setLocalSummary(entries.length ? summarizeLocalFiles(entries) : null);
  }

  function loadRemoteAndWarmup() {
    setError(null);
    setProgressItems([]);
    setStatus('loading');
    workerRef.current.postMessage({ type: 'load' });
  }

  function downloadRemoteOnly() {
    setError(null);
    setProgressItems([]);
    setStatus('loading');
    workerRef.current.postMessage({ type: 'download' });
  }

  function loadLocalModel() {
    if (!localEntries.length) {
      return;
    }
    setError(null);
    setProgressItems([]);
    setStatus('loading');
    workerRef.current.postMessage({ type: 'setLocalFiles', data: localEntries });
    workerRef.current.postMessage({ type: 'load' });
  }

  function interrupt() {
    workerRef.current.postMessage({ type: 'interrupt' });
  }

  if (!webgpuCheckDone) {
    return (
      <div className="shell">
        <h1>WebGPU確認中...</h1>
      </div>
    );
  }

  if (!webgpuAvailable) {
    return (
      <div className="shell">
        <h1>WebGPUが利用できません</h1>
        <p>{webgpuReason || 'WebGPUを初期化できませんでした。'}</p>
        <p>推奨: `http://localhost:5180` または HTTPS URL で開いてください。</p>
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
          {' '}をブラウザ内で実行します。
        </p>
      </header>

      {status !== 'ready' && (
        <section className="card">
          <h2>Model Setup</h2>
          <p>
            先にモデルをダウンロードします。ローカルフォルダ利用時は
            <code>tokenizer.json</code> と <code>onnx/*.onnx</code> を含むディレクトリを選んでください。
          </p>

          <div className="controls-row">
            <label className="button button-secondary">
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
            <button className="button" disabled={!localEntries.length || status === 'loading'} onClick={loadLocalModel}>
              Load local model
            </button>
            <button className="button" disabled={status === 'loading'} onClick={downloadRemoteOnly}>
              Download only
            </button>
            <button className="button" disabled={status === 'loading'} onClick={loadRemoteAndWarmup}>
              Download + warm up
            </button>
          </div>

          {localSummary && (
            <p className="hint">
              files: {localSummary.count} / {localSummary.totalMB} MB / tokenizer:{' '}
              {localSummary.foundTokenizer ? 'yes' : 'no'} / onnx: {localSummary.foundOnnx ? 'yes' : 'no'}
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
            ローカルモデル取得例: <code>git lfs install && git clone https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX</code>
          </p>
        </section>
      )}

      {status === 'ready' && (
        <section className="chat-card">
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
              <Message key={`${msg.role}-${i}`} role={msg.role} content={msg.content} />
            ))}
          </div>

          <div className="stats">
            {tps && numTokens ? `${numTokens} tokens, ${tps.toFixed(2)} tok/s` : 'Ready'}
          </div>

          <div className="composer">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="メッセージを入力"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitMessage(input);
                }
              }}
            />
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
        </section>
      )}
    </div>
  );
}
