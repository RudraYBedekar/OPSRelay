#!/usr/bin/env bash
# Configure nginx for OpsRelay (run from project root)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NGINX_SRC="$SCRIPT_DIR/nginx-opsrelay.conf"
NGINX_DEST="/etc/nginx/sites-available/opsrelay"

if [ ! -f "$NGINX_SRC" ]; then
  echo "❌ Missing $NGINX_SRC — are you in the repo with deploy/ folder?"
  exit 1
fi

if [ ! -d "$APP_ROOT/dist" ]; then
  echo "❌ dist/ not found. Run: npm run build"
  exit 1
fi

echo "=== Configuring nginx ==="
echo "App root: $APP_ROOT"

sudo rm -f /etc/nginx/sites-enabled/opsrelay
sudo rm -f /etc/nginx/sites-available/opsrelay

sed "s|__APP_ROOT__|$APP_ROOT|g" "$NGINX_SRC" | sudo tee "$NGINX_DEST" > /dev/null
sudo ln -sf "$NGINX_DEST" /etc/nginx/sites-enabled/opsrelay
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "✅ Nginx configured and reloaded"
echo "   Site root: $APP_ROOT/dist"
echo "   API proxy: /api/ → http://127.0.0.1:3001"
