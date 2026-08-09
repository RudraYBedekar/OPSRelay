/**
 * Demo login preflight — reads credentials from env, never prints secrets.
 *
 * DEMO_PREFLIGHT_USER + DEMO_PREFLIGHT_PASSWORD (or OPSRELAY_DEMO_*)
 */
import 'dotenv/config';

const API = process.env.DEMO_PREFLIGHT_API_URL ?? process.env.VITE_API_URL ?? 'http://127.0.0.1:3001/api';
const user = process.env.DEMO_PREFLIGHT_USER ?? process.env.OPSRELAY_DEMO_USER;
const password = process.env.DEMO_PREFLIGHT_PASSWORD ?? process.env.OPSRELAY_DEMO_PASSWORD;

async function main(): Promise<void> {
  if (!user || !password) {
    console.error('FAIL: Set DEMO_PREFLIGHT_USER and DEMO_PREFLIGHT_PASSWORD (or OPSRELAY_DEMO_*).');
    process.exit(1);
  }

  const base = API.replace(/\/$/, '');

  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: user, password }),
  });
  if (!loginRes.ok) {
    console.error(`FAIL: login HTTP ${loginRes.status}`);
    process.exit(1);
  }

  const loginBody = (await loginRes.json()) as { token?: string };
  if (!loginBody.token) {
    console.error('FAIL: login response missing token');
    process.exit(1);
  }
  console.log('PASS: login returned token');

  const headers = { Authorization: `Bearer ${loginBody.token}` };

  const healthRes = await fetch(`${base}/health`, { headers });
  console.log(healthRes.ok ? 'PASS: /api/health' : `FAIL: /api/health HTTP ${healthRes.status}`);

  const incRes = await fetch(`${base}/incidents`, { headers });
  console.log(incRes.ok ? 'PASS: /api/incidents' : `FAIL: /api/incidents HTTP ${incRes.status}`);

  process.exit(loginRes.ok && healthRes.ok && incRes.ok ? 0 : 1);
}

void main();
