import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import { securePool } from './secureDb.js';
import { CRDB_DATABASE, CRDB_SECURE_DATABASE } from './dbConfig.js';
import { incidentsRouter } from './routes/incidents.js';
import { tasksRouter } from './routes/tasks.js';
import { metricsRouter } from './routes/metrics.js';
import { handoffRouter } from './routes/handoff.js';
import { memoryRouter } from './routes/memory.js';
import { extractRouter } from './routes/extract.js';
import { agentRouter } from './routes/agent.js';
import { sampleLogsRouter } from './routes/sampleLogs.js';
import { authRouter } from './routes/auth.js';
import { accessRouter } from './routes/access.js';
import { alertsRouter } from './routes/alerts.js';
import { analysisRouter } from './routes/analysis.js';
import { investigatorRouter } from './routes/investigator.js';
import { startJobWorker } from './services/jobWorker.js';
import { backfillWelcomeIncidentsForAllUsers } from './services/welcomeIncidentService.js';
import { teamChatRouter } from './routes/teamChat.js';
import { isBedrockConfigured, bedrockConfig } from './config/bedrock.js';
import { isAuthEnabled } from './config/auth.js';
import { getMcpHealth } from './config/mcp.js';
import { checkSchemaReadiness } from './config/schemaReadiness.js';
import { getEmbeddingCount } from './services/vectorService.js';
import { testBedrockConnection } from './services/llmService.js';
import { securityHeaders } from './middleware/security.js';
import { requireAuth } from './middleware/auth.js';
import { sanitizeErrorForClient, logServerError } from './utils/sanitizeError.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const isProduction = process.env.NODE_ENV === 'production';

const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
if (isProduction && !corsOrigins?.length) {
  console.error('CORS_ORIGIN must be set in production (exact origin list).');
  process.exit(1);
}
app.use(cors(corsOrigins?.length ? { origin: corsOrigins } : undefined));
app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health/live', (_req, res) => {
  res.json({ status: 'live', timestamp: new Date().toISOString() });
});

app.get('/api/health/ready', async (_req, res) => {
  const schema = await checkSchemaReadiness();
  if (!schema.ready) {
    res.status(503).json({
      status: 'not_ready',
      code: schema.code ?? 'SCHEMA_UPGRADE_REQUIRED',
    });
    return;
  }
  res.json({
    status: 'ready',
    schemaVersion: schema.currentVersion,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    let secureDbOk = false;
    try {
      await securePool.query('SELECT 1');
      secureDbOk = true;
    } catch {
      secureDbOk = false;
    }
    const schema = await checkSchemaReadiness();
    const embeddingCount = await getEmbeddingCount().catch(() => 0);
    const mcp = getMcpHealth();

    let bedrock: {
      enabled: boolean;
      extractModel?: string;
      agentModel?: string;
      embedModel?: string;
    } = {
      enabled: isBedrockConfigured(),
    };

    if (isBedrockConfigured()) {
      bedrock = {
        enabled: true,
        extractModel: bedrockConfig.llmModel,
        agentModel: bedrockConfig.agentModel,
        embedModel: bedrockConfig.embedModel,
      };
    }

    res.status(schema.ready ? 200 : 503).json({
      status: schema.ready ? 'ok' : 'degraded',
      database: CRDB_DATABASE,
      secureDatabase: { name: CRDB_SECURE_DATABASE, connected: secureDbOk },
      auth: { enabled: isAuthEnabled() },
      bedrock,
      mcp: {
        status: mcp.status,
        mode: mcp.mode,
        provider: mcp.provider,
        readOnly: true,
      },
      vectors: { embeddingCount, dimensions: bedrockConfig.embedDimensions },
      schema: { ready: schema.ready, version: schema.currentVersion },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Database unreachable',
    });
  }
});

app.use('/api/auth', authRouter);

const protectedApi = express.Router();
protectedApi.use(requireAuth);

protectedApi.get('/bedrock/test', async (_req, res) => {
  if (!isBedrockConfigured()) {
    res.status(400).json({ error: 'BEDROCK_ENABLED is not true' });
    return;
  }
  const result = await testBedrockConnection();
  res.json(result);
});

protectedApi.use('/access', accessRouter);
protectedApi.use('/incidents', analysisRouter);
protectedApi.use('/incidents', incidentsRouter);
protectedApi.use('/investigator', investigatorRouter);
protectedApi.use('/tasks', tasksRouter);
protectedApi.use('/metrics', metricsRouter);
protectedApi.use('/handoff', handoffRouter);
protectedApi.use('/memory', memoryRouter);
protectedApi.use('/extract', extractRouter);
protectedApi.use('/agent', agentRouter);
protectedApi.use('/sample-logs', sampleLogsRouter);
protectedApi.use('/team-chat', teamChatRouter);
protectedApi.use('/alerts', alertsRouter);

app.use('/api', protectedApi);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logServerError(err);
  const { status, message, code } = sanitizeErrorForClient(err);
  res.status(status).json({ error: message, ...(code ? { code } : {}) });
});

async function boot(): Promise<void> {
  console.log(`OpsRelay API listening on http://localhost:${PORT}`);
  console.log(`Auth: ${isAuthEnabled() ? 'ENABLED (JWT)' : 'disabled'}`);
  console.log(`Bedrock: ${isBedrockConfigured() ? 'ENABLED' : 'disabled (fallback mode)'}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log('Schema DDL is not run at startup — use npm run db:migrate');

  const schema = await checkSchemaReadiness();
  if (!schema.ready) {
    console.warn(`Schema not ready (${schema.code}). Worker deferred until migrations are applied.`);
    return;
  }

  startJobWorker();
  console.log('Background job worker started (15s interval)');

  void backfillWelcomeIncidentsForAllUsers()
    .then((result) => {
      if (result.incidentsCreated > 0) {
        console.log(
          `Welcome incidents backfill: ${result.incidentsCreated} incident(s) for ${result.usersSeeded}/${result.usersChecked} account(s)`,
        );
      }
    })
    .catch((err) => {
      console.warn('Welcome incidents backfill skipped:', err instanceof Error ? err.message : err);
    });
}

app.listen(PORT, () => {
  void boot();
});
