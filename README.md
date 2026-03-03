# Qwen3.5-0.8B WebGPU Chat PoC

`onnx-community/Qwen3.5-0.8B-ONNX` を `@huggingface/transformers` で WebGPU 実行する最小PoCです。

## Setup

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開き、以下どちらかでモデルを読み込みます。

- `Download only`
- `Download + warm up`
- `Browse folder` + `Load local model`

## Local folder option

```bash
git lfs install
git clone https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX
```

WebUI の `Browse folder` で上記フォルダを選択してください。

## Test

```bash
npm test
npm run build
```

## Docker Compose (dev)

```bash
docker compose up --build
```

- Open: `http://localhost:5180`
- Hot reload: enabled via bind mount
- Dev log file: `logs/dev.log`
- WebGPUはセキュア文脈が必要です。`http://localhost:5180` で開いてください（`http://<LAN-IP>:5180` だと無効になる場合があります）。

Stop:

```bash
docker compose down
```
