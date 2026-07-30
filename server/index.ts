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
import { isBedrockConfigured, bedrockConfig } from './config/bedrock.js';
import { isAuthEnabled } from './config/auth.js';
import { migrateSecureAuthSchema } from './services/authMigration.js';
import { migrateAccessSchema } from './services/incidentAccessService.js';
import { getEmbeddingCount } from './services/vectorService.js';
import { testBedrockConnection } from './services/llmService.js';
import { securityHeaders } from './middleware/security.js';
import { requireAuth } from './middleware/auth.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(corsOrigins?.length ? { origin: corsOrigins } : undefined));
app.use(securityHeaders);
app.use(express.json({ limit: '2mb' }));

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
    const embeddingCount = await getEmbeddingCount().catch(() => 0);

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

    res.json({
      status: 'ok',
      database: CRDB_DATABASE,
      secureDatabase: { name: CRDB_SECURE_DATABASE, connected: secureDbOk },
      auth: { enabled: isAuthEnabled() },
      bedrock,
      vectors: { embeddingCount, dimensions: bedrockConfig.embedDimensions },
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
protectedApi.use('/incidents', incidentsRouter);
protectedApi.use('/tasks', tasksRouter);
protectedApi.use('/metrics', metricsRouter);
protectedApi.use('/handoff', handoffRouter);
protectedApi.use('/memory', memoryRouter);
protectedApi.use('/extract', extractRouter);
protectedApi.use('/agent', agentRouter);
protectedApi.use('/sample-logs', sampleLogsRouter);

app.use('/api', protectedApi);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, async () => {
  console.log(`OpsRelay API listening on http://localhost:${PORT}`);
  console.log(`Auth: ${isAuthEnabled() ? 'ENABLED (JWT)' : 'disabled'}`);
  console.log(`Bedrock: ${isBedrockConfigured() ? 'ENABLED' : 'disabled (fallback mode)'}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);

  if (isAuthEnabled()) {
    try {
      await migrateSecureAuthSchema();
      await migrateAccessSchema();
      console.log('SecureData auth schema: member_id + access sharing ready');
    } catch (err) {
      console.warn('SecureData auth migration skipped:', err instanceof Error ? err.message : err);
    }
  }
});
