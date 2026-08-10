#!/usr/bin/env bash
# Start or restart OpsRelay API with PM2 (run from project root)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_ROOT"

if [ ! -f .env ]; then
  echo "❌ .env not found. Create .env from docs/CONFIGURATION.md"
  exit 1
fi

echo "=== Starting API with PM2 ==="

pm2 delete opsrelay-api 2>/dev/null || true
pm2 start npm --name opsrelay-api -- run start:prod
pm2 save

echo "✅ API running"
pm2 status opsrelay-api
