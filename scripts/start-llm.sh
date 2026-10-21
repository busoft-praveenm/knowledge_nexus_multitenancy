#!/usr/bin/env bash
# Starts a FREE local LLM with an OpenAI-compatible API on :8080 using llama.cpp.
#   LLAMA_SERVER_BIN  path to llama.cpp's llama-server binary
#   LLM_MODEL_PATH    path to a GGUF model (default: Qwen2.5-3B-Instruct Q4_K_M)
# Download the model once (≈2 GB, Apache-2.0):
#   curl -L -o ~/models/qwen2.5-3b-instruct-q4_k_m.gguf \
#     https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$ROOT/.env" ]] && { set -a; source "$ROOT/.env"; set +a; }

BIN="${LLAMA_SERVER_BIN:-$(command -v llama-server || echo "$HOME/mcp_demo/ai/llama.cpp/build/bin/llama-server")}"
MODEL="${LLM_MODEL_PATH:-$HOME/models/qwen2.5-3b-instruct-q4_k_m.gguf}"
PORT="${LLM_PORT:-8080}"

[[ -x "$BIN" ]]   || { echo "llama-server not found at $BIN (set LLAMA_SERVER_BIN)"; exit 1; }
[[ -f "$MODEL" ]] || { echo "Model not found at $MODEL (set LLM_MODEL_PATH)"; exit 1; }

echo "Starting llama-server on http://127.0.0.1:$PORT/v1 with $(basename "$MODEL")"
exec "$BIN" -m "$MODEL" --jinja -c 8192 --host 127.0.0.1 --port "$PORT" -a qwen2.5-3b -t "$(nproc)"
