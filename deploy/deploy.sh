#!/usr/bin/env bash
# Build app + restart API + reload nginx (run from project root)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_ROOT"

echo "=== OpsRelay deploy ==="

npm install
npm run build

bash "$SCRIPT_DIR/start-api.sh"
bash "$SCRIPT_DIR/setup-nginx.sh"

echo ""
echo "=== Health checks ==="
sleep 2
curl -sf http://localhost:3001/api/health | head -c 200 && echo "" || echo "⚠️  API health check failed"
curl -sf -o /dev/null -w "Frontend HTTP %{http_code}\n" http://localhost/ || echo "⚠️  Frontend check failed"

PUBLIC_IP="$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_EC2_IP')"
echo ""
echo "✅ Deploy complete"
echo "   http://${PUBLIC_IP}/"
echo "   http://${PUBLIC_IP}/api/health"
