#!/usr/bin/env bash
# Free RegisterKaro dev ports (3000 web, 3001 api)
for port in 3000 3001; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "Stopping process on port $port (pid: $pids)"
    kill -9 $pids 2>/dev/null || true
  fi
done
