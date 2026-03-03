# Qwen3.5-0.8B WebGPU Chat PoC

A minimal browser chat PoC that runs
`onnx-community/Qwen3.5-0.8B-ONNX` via `@huggingface/transformers` on WebGPU.

## Features

- Local-folder model loading (`Browse folder`) with automatic load
- Chat reset without reloading the model (`Reset chat`)
- Saved local-folder summary in `localStorage`
- Saved-folder state reset (`Reset saved folder info`)

## Local development

```bash
npm install
npm run dev
```

Open: `http://localhost:5173`

WebGPU requires a secure context. Use `localhost` or `https`.

## Local model folder

```bash
git lfs install
git clone https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX
```

Then select that folder in the UI.

## Tests and build

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

Stop:

```bash
docker compose down
```

## GitHub Pages

This repository includes a GitHub Actions workflow that builds and deploys
`dist/` to GitHub Pages on pushes to `master`.

Expected Pages URL:

- `https://fuba.github.io/qwen-webgpu-poc/`

## License

- Project source code: **CC0-1.0** ([LICENSE](./LICENSE))
- Third-party software and model notices:
  [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
