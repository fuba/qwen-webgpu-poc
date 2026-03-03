# Third-Party Notices

This project's own source code is released under **CC0-1.0**.

This project depends on third-party software and model artifacts that are
licensed separately. You must comply with those licenses when using,
redistributing, or deploying this project.

Checked on: **March 3, 2026**

## Runtime dependencies

| Component | Version | License | Source |
|---|---:|---|---|
| `@huggingface/transformers` | `4.0.0-next.5` | Apache-2.0 | https://github.com/huggingface/transformers.js |
| `franc-min` | `6.2.0` | MIT | https://github.com/wooorm/franc |
| `react` | `18.3.1` | MIT | https://github.com/facebook/react |
| `react-dom` | `18.3.1` | MIT | https://github.com/facebook/react |
| `onnxruntime-web` (transitive) | resolved via lockfile | MIT | https://github.com/microsoft/onnxruntime |

## Development dependencies

| Component | Version | License | Source |
|---|---:|---|---|
| `vite` | `6.2.0` | MIT | https://github.com/vitejs/vite |
| `@vitejs/plugin-react` | `5.0.2` | MIT | https://github.com/vitejs/vite-plugin-react |
| `vitest` | `2.1.9` | MIT | https://github.com/vitest-dev/vitest |

## Model artifacts

This repository does **not** include model weights.
Model files are loaded from a local folder selected by the user.

Primary target model in this project:

- `onnx-community/Qwen3.5-0.8B-ONNX`
  - Model page: https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX
  - Base model reference: `Qwen/Qwen3.5-0.8B`

License note:

- As of March 3, 2026, the base model `Qwen/Qwen3.5-0.8B` indicates
  `license: apache-2.0` in the model metadata.
- Always verify the latest model license and terms directly on the
  Hugging Face model page before production use.

## Verification commands

The following commands were used to confirm license metadata:

```bash
npm view @huggingface/transformers@4.0.0-next.5 license repository.url
npm view react@18.3.1 license repository.url
npm view react-dom@18.3.1 license repository.url
npm view vite@6.2.0 license repository.url
npm view @vitejs/plugin-react@5.0.2 license repository.url
npm view vitest@2.1.9 license repository.url
npm view onnxruntime-web license repository.url
curl -s https://huggingface.co/api/models/Qwen/Qwen3.5-0.8B | jq '{id,license:(.cardData.license // null),tags}'
```
