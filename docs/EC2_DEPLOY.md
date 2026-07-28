# OpsRelay Dashboard — EC2 Deployment Guide

Deploy the full stack (React UI + Express API + Bedrock + CockroachDB) on a single **Amazon EC2** instance.

## Architecture on EC2

```text
Internet
   │
   ▼
┌─────────────────────────────────────┐
│  EC2 (Ubuntu 22.04)                 │
│                                     │
│  Nginx :80 / :443                   │
│    ├── /        → React (dist/)     │
│    └── /api/*   → Express :3001     │
│                                     │
│  PM2 → tsx server/index.ts          │
└──────────┬───────────────┬──────────┘
           │               │
           ▼               ▼
   CockroachDB Cloud   AWS Bedrock
   (Rudra + SecureData) (via IAM role)
```

---

## 1. AWS prerequisites

Before launching EC2, confirm:

| Service | What you need |
|---------|----------------|
| **CockroachDB Cloud** | Cluster running, `DATABASE_URL`, IP allowlist updated |
| **Bedrock** | Model access enabled (Haiku 4.5, Nova 2 Lite, Titan Embed v2) |
| **IAM** | Role with `bedrock:InvokeModel` for the EC2 instance |
| **GitHub** | Repo pushed (or upload code via SCP) |

---

## 2. Launch EC2 instance

### Instance settings

| Setting | Recommended |
|---------|-------------|
| AMI | **Ubuntu Server 22.04 LTS** |
| Instance type | **t3.small** (demo) or **t3.medium** (Bedrock + vectors) |
| Storage | 20 GB gp3 |
| Key pair | Create/download `.pem` for SSH |

### Security group (inbound rules)

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | **Your IP only** | Admin access |
| HTTP | 80 | 0.0.0.0/0 | Website |
| HTTPS | 443 | 0.0.0.0/0 | Website (after SSL) |

> Do **not** open port 3001 publicly — Nginx proxies to it internally.

### IAM role (attach to instance)

Create role `OpsRelayEC2Role` with this policy (Bedrock only — no keys in `.env`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}
```

Attach the role at launch: **Advanced details → IAM instance profile**.

---

## 3. Connect to EC2

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## 4. Install dependencies on EC2

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# PM2 (process manager)
sudo npm install -g pm2

node -v   # v20.x
npm -v
```

---

## 5. Clone and configure the app

```bash
cd /home/ubuntu
git clone https://github.com/YOUR_USER/OPSRELAYDashboard.git
cd OPSRELAYDashboard

npm install
```

Create production `.env`:

```bash
nano .env
```

Paste (replace secrets and URLs):

```env
# ── Auth (SecureData DB) ──
JWT_SECRET=REPLACE_WITH_64_CHAR_RANDOM_STRING
JWT_EXPIRES_IN=8h
AUTH_ENABLED=true
CRDB_SECURE_DATABASE=SecureData
PASSWORD_PEPPER=REPLACE_WITH_RANDOM_PEPPER
AUDIT_IP_SALT=REPLACE_WITH_RANDOM_SALT
SEED_DEFAULT_PASSWORD=ChangeMeAfterFirstLogin!

# ── CockroachDB Cloud ──
CRDB_DATABASE=Rudra
DATABASE_URL=postgresql://USER:PASSWORD@CLUSTER.cockroachlabs.cloud:26257/Rudra?sslmode=verify-full

# ── API ──
PORT=3001
NODE_ENV=production

# ── Frontend build vars ──
VITE_USE_CRDB=true
VITE_API_URL=/api

# ── Bedrock (use IAM role on EC2 — leave keys empty) ──
BEDROCK_ENABLED=true
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

BEDROCK_LLM_MODEL=us.anthropic.claude-haiku-4-5-20251001-v1:0
BEDROCK_AGENT_MODEL=us.amazon.nova-2-lite-v1:0
BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0
BEDROCK_EMBED_DIMENSIONS=1024
```

Generate secrets:

```bash
openssl rand -hex 32   # use for JWT_SECRET, PASSWORD_PEPPER, AUDIT_IP_SALT
```

---

## 6. Allow EC2 in CockroachDB Cloud

1. Open [CockroachDB Cloud Console](https://cockroachlabs.cloud/)
2. Your cluster → **Networking** → **IP Allowlist**
3. Add your EC2 **public IP** (`curl -s ifconfig.me` from EC2)

---

## 7. Seed databases (first time only)

```bash
npm run db:seed-all
```

This creates:
- **SecureData** — user credentials (`rudra`, `yash`)
- **Rudra** — incidents, vectors, sample logs

---

## 8. Build frontend

```bash
npm run build
```

Output goes to `dist/` — Nginx will serve this folder.

---

## 9. Start API with PM2

```bash
bash deploy/start-api.sh
pm2 startup   # follow the printed command so API restarts on reboot
pm2 save
```

Or use the all-in-one script:

```bash
bash deploy/ec2-setup.sh
```

Verify API locally on EC2:

```bash
bash deploy/health-check.sh
curl http://localhost:3001/api/health
```

---

## 10. Configure Nginx

```bash
bash deploy/setup-nginx.sh
```

This auto-detects your project path and installs `deploy/nginx-opsrelay.conf`.

Open in browser:

```text
http://<EC2_PUBLIC_IP>/
```

You should see the **Create your account** / login page.

---

## 11. HTTPS with Let's Encrypt (recommended)

Point a domain (e.g. `opsrelay.yourdomain.com`) to the EC2 public IP, then:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d opsrelay.yourdomain.com
```

Certbot auto-renews. Update any bookmarks to `https://`.

---

## 12. Deploy updates (after code changes)

```bash
cd /home/ubuntu/OPSRELAYDashboard
git pull
bash deploy/deploy.sh
```

---

## Deploy folder reference

All EC2 scripts live in `deploy/`:

| Script | Purpose |
|--------|---------|
| `ec2-setup.sh` | One-time full install |
| `deploy.sh` | Redeploy after git pull |
| `setup-nginx.sh` | Fix/install nginx |
| `start-api.sh` | Restart PM2 API |
| `health-check.sh` | Verify everything works |
| `env.production.example` | EC2 `.env` template |
| `iam-bedrock-policy.json` | IAM policy JSON |

See [deploy/README.md](../deploy/README.md) for details.

---

## 13. Useful commands

```bash
pm2 status                  # API running?
pm2 logs opsrelay-api       # API logs
sudo tail -f /var/log/nginx/access.log
curl http://localhost:3001/api/health
npm run test:e2e            # run from EC2 (API must be up)
```

---

## 14. Security checklist

- [ ] SSH restricted to your IP only
- [ ] Port 3001 **not** open in security group
- [ ] Strong `JWT_SECRET`, `PASSWORD_PEPPER`, `AUDIT_IP_SALT`
- [ ] IAM role for Bedrock (no access keys on disk)
- [ ] CockroachDB IP allowlist includes only EC2 IP
- [ ] HTTPS enabled before sharing publicly
- [ ] Change default seed passwords after demo

---

## 15. Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page | Check `dist/` exists: `npm run build` |
| API 502 | `pm2 logs opsrelay-api` — is Express running? |
| DB connection error | Add EC2 IP to CockroachDB allowlist |
| Bedrock error | Confirm IAM role attached + model access in Bedrock console |
| Login fails | Run `npm run db:seed-secure` |
| CORS errors | Set `VITE_API_URL=/api` and use Nginx proxy (same origin) |

---

## 16. Cost estimate (rough)

| Resource | ~Monthly |
|----------|----------|
| t3.small EC2 | ~$15 |
| 20 GB EBS | ~$2 |
| Bedrock usage | Pay per token (varies) |
| CockroachDB Cloud | Free tier / plan dependent |

---

## Quick reference

```bash
# One-time setup
npm install && npm run db:seed-all && npm run build
pm2 start "npx tsx server/index.ts" --name opsrelay-api && pm2 save

# URL
http://<EC2_PUBLIC_IP>/

# Demo login (after seed)
# User ID: yash  |  Email: yash@opsrelay.io  |  Password: OpsRelay2026!
```
