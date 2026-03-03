# Qwen3.5-0.8B WebGPU Chat PoC

Browser-only chat PoC for `onnx-community/Qwen3.5-0.8B-ONNX`
using `@huggingface/transformers` on WebGPU.

## Project status

- Status: complete PoC
- Runtime: local browser (no backend service)
- Deployment: GitHub Pages + Docker Compose dev environment

## Implemented scope

- Local-folder model loading (`Browse folder`) with automatic load
- Saved local-folder summary in `localStorage`
- Reset saved folder summary (`Reset saved folder info`)
- Chat reset without model reload (`Reset chat`)
- Interrupt generation (`Stop`)
- IME-safe Enter submit behavior
- `<think>...</think>` extraction and separate rendering
- Markdown rendering for messages
- Multimodal prompt support (text + images)
- Image safety preprocessing before inference
  (max edge `640px`, max area `640x640`) to reduce WebGPU OOM failures

## Requirements

- A WebGPU-capable browser (Chrome/Edge stable recommended)
- Secure context (`https://` or `http://localhost`)
- Local model files for:
  `onnx-community/Qwen3.5-0.8B-ONNX`

## Local model folder setup

```bash
git lfs install
git clone https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX
```

Then use `Browse folder` in the app.

## Run locally (npm)

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Run locally (Docker Compose)

```bash
docker compose up --build
```

- Open: `http://localhost:5180`
- Hot reload: enabled via bind mount
- Dev logs: `logs/dev.log`

Stop:

```bash
docker compose down
```

## Test and build

```bash
npm test
npm run build
```

## Usage flow

1. Load a local model folder.
2. Wait for `ready` status.
3. Enter text and optionally upload images.
4. Click `Send`.
5. Use `Reset chat` to clear conversation only.
6. Use `Reset saved folder info` to clear persisted folder summary.

## Troubleshooting

- `WebGPU is not available`:
  check secure context, browser version, GPU driver, and browser WebGPU flags.
- `Unsupported model type: qwen3_5`:
  upgrade to a `@huggingface/transformers` version with Qwen3.5 support
  (this PoC is pinned to `4.0.0-next.5`).
- `RuntimeError: memory access out of bounds` during image prompts:
  retry with fewer/smaller images; the app already auto-resizes images before inference.

## GitHub Pages

GitHub Actions deploys `dist/` to Pages on pushes to `master`.

- URL: `https://fuba.github.io/qwen-webgpu-poc/`

## License

- Project source code: **CC0-1.0** ([LICENSE](./LICENSE))
- Third-party software and model notices:
  [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
