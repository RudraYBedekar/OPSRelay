#!/usr/bin/env bash
# Install Node 20, nginx, git, PM2 on Ubuntu 22.04
set -euo pipefail

echo "=== Installing system dependencies ==="

if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

sudo apt update
sudo apt install -y git nginx curl

if ! command -v pm2 &>/dev/null; then
  sudo npm install -g pm2
fi

echo "Node: $(node -v)"
echo "NPM:  $(npm -v)"
echo "PM2:  $(pm2 -v)"
echo "✅ Dependencies installed"
