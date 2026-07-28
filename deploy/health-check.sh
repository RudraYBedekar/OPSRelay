#!/usr/bin/env bash
# Verify API, frontend, and database connectivity
set -euo pipefail

echo "=== OpsRelay health check ==="

echo -n "PM2 API:     "
pm2 jlist 2>/dev/null | grep -q '"name":"opsrelay-api"' && echo "running" || echo "NOT RUNNING"

echo -n "API /health: "
curl -sf http://localhost:3001/api/health > /tmp/opsrelay-health.json && echo "OK" || echo "FAILED"
[ -f /tmp/opsrelay-health.json ] && cat /tmp/opsrelay-health.json | head -c 300 && echo ""

echo -n "Frontend:    "
curl -sf -o /dev/null -w "HTTP %{http_code}\n" http://localhost/ || echo "FAILED"

echo -n "Nginx:       "
sudo nginx -t 2>&1 | tail -1

echo -n "Public IP:   "
curl -s ifconfig.me 2>/dev/null || echo "unknown"
