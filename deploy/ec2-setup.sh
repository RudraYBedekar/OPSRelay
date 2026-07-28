#!/usr/bin/env bash
# Full EC2 bootstrap — run once after cloning repo on Ubuntu 22.04
# Usage (on EC2):
#   cd ~/OPSRELAYDashboard
#   cp deploy/env.production.example .env && nano .env
#   bash deploy/ec2-setup.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_ROOT"

echo "=== OpsRelay EC2 full setup ==="
echo "Project: $APP_ROOT"

bash "$SCRIPT_DIR/install-deps.sh"

if [ ! -f .env ]; then
  if [ -f "$SCRIPT_DIR/env.production.example" ]; then
    cp "$SCRIPT_DIR/env.production.example" .env
  elif [ -f .env.example ]; then
    cp .env.example .env
  fi
  echo ""
  echo "⚠️  Created .env — EDIT IT NOW with your secrets:"
  echo "   nano .env"
  echo ""
  echo "Generate secrets:"
  echo "   openssl rand -hex 32"
  echo ""
  echo "Then re-run:  bash deploy/ec2-setup.sh"
  exit 0
fi

echo "=== Installing npm packages ==="
npm install

echo "=== Seeding databases (SecureData + Rudra) ==="
npm run db:seed-all || {
  echo "⚠️  Seed failed — check DATABASE_URL and CockroachDB IP allowlist"
  echo "    Get EC2 IP: curl -s ifconfig.me"
  exit 1
}

echo "=== Building frontend ==="
npm run build

echo "=== Starting API ==="
bash "$SCRIPT_DIR/start-api.sh"

echo "=== Configuring nginx ==="
bash "$SCRIPT_DIR/setup-nginx.sh"

pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null || true
pm2 save

PUBLIC_IP="$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_EC2_PUBLIC_IP')"

echo ""
echo "============================================"
echo "✅ OpsRelay EC2 setup complete!"
echo "============================================"
echo ""
echo "  Website:  http://${PUBLIC_IP}/"
echo "  Health:   http://${PUBLIC_IP}/api/health"
echo ""
echo "  Demo login (after seed):"
echo "    User ID: yash  |  Email: yash@opsrelay.io"
echo "    Password: OpsRelay2026!  (or your SEED_DEFAULT_PASSWORD)"
echo ""
echo "  Useful commands:"
echo "    bash deploy/health-check.sh"
echo "    bash deploy/deploy.sh          # redeploy after git pull"
echo "    pm2 logs opsrelay-api"
echo ""
