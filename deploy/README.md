# OpsRelay EC2 Deploy Files

All scripts run **on your Ubuntu EC2 instance** from the project root.

## Quick start (EC2)

```bash
cd ~/OPSRELAYDashboard
nano .env                    # create from docs/CONFIGURATION.md
bash deploy/ec2-setup.sh     # installs everything
```

Open: `http://<EC2_PUBLIC_IP>/`

---

## Files

| File | Purpose |
|------|---------|
| `ec2-setup.sh` | **One-time full setup** (deps, seed, build, PM2, nginx) |
| `deploy.sh` | **Redeploy** after `git pull` |
| `install-deps.sh` | Node 20, nginx, git, PM2 |
| `setup-nginx.sh` | Install nginx config (auto-detects project path) |
| `start-api.sh` | Start/restart API with PM2 |
| `health-check.sh` | Verify API + frontend + nginx |
| `nginx-opsrelay.conf` | Nginx template (`__APP_ROOT__` replaced by script) |
| `pm2.ecosystem.cjs` | PM2 process config |
| `iam-bedrock-policy.json` | IAM policy for EC2 Bedrock role |

Environment variables: [docs/CONFIGURATION.md](../docs/CONFIGURATION.md)

---

## Windows → EC2 (SSH)

```powershell
ssh -i "C:\Users\rudra\Downloads\opsrelay.pem" ubuntu@YOUR_EC2_IP
```

Fix key permissions if needed:
```powershell
icacls "C:\Users\rudra\Downloads\opsrelay.pem" /inheritance:r
icacls "C:\Users\rudra\Downloads\opsrelay.pem" /grant:r "$($env:USERNAME):(R)"
```

---

## IAM role (Bedrock)

1. IAM → Roles → Create role → EC2
2. Create policy from `iam-bedrock-policy.json`
3. Attach to EC2 instance as **OpsRelayEC2Role**
4. Leave `AWS_ACCESS_KEY_ID` empty in `.env`

---

## CockroachDB allowlist

On EC2:
```bash
curl -s ifconfig.me
```
Add that IP in CockroachDB Cloud → Networking → IP Allowlist.

---

## Troubleshooting

```bash
bash deploy/health-check.sh
pm2 logs opsrelay-api --lines 50
sudo nginx -t
ls -la dist/
```

| Error | Fix |
|-------|-----|
| `cp: cannot stat deploy/nginx...` | Run `git pull` to get deploy folder, or `bash deploy/setup-nginx.sh` |
| nginx test failed | `sudo rm -f /etc/nginx/sites-enabled/opsrelay && bash deploy/setup-nginx.sh` |
| API 502 | `pm2 restart opsrelay-api` |
| DB error | Add EC2 IP to CockroachDB allowlist |

Full guide: [docs/EC2_DEPLOY.md](../docs/EC2_DEPLOY.md)
