#!/usr/bin/env sh
set -eu

mkdir -p /app/logs

if [ ! -d /app/node_modules ] || [ -z "$(ls -A /app/node_modules 2>/dev/null || true)" ]; then
  npm install
fi

npm run dev -- --host 0.0.0.0 --port 5173 2>&1 | tee -a /app/logs/dev.log
