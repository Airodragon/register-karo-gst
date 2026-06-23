#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/free-ports.sh"
echo "Stopped dev servers on ports 3000 and 3001."
