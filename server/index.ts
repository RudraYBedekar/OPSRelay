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
import { runVersionedMigrations } from './migrations/runVersionedMigrations.js';
import { startJobWorker } from './services/jobWorker.js';
import { teamChatRouter } from './routes/teamChat.js';
import { migrateTeamChatSchema } from './services/teamChatMigration.js';
import { migrateTeamChatImageSchema } from './services/teamChatImageMigration.js';
import { migrateAlertFatigueSchema } from './services/alertFatigueMigration.js';
import { migrateEmbeddingProvenanceSchema } from './services/embeddingProvenanceMigration.js';
import { isBedrockConfigured, bedrockConfig } from './config/bedrock.js';
import { isAuthEnabled } from './config/auth.js';
import { migrateSecureAuthSchema } from './services/authMigration.js';
import { migrateAccessSchema } from './services/incidentAccessService.js';
import { getEmbeddingCount } from './services/vectorService.js';
import { testBedrockConnection } from './services/llmService.js';
import { securityHeaders } from './middleware/security.js';
import { requireAuth } from './middleware/auth.js';
import { sanitizeErrorForClient, logServerError } from './utils/sanitizeError.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(corsOrigins?.length ? { origin: corsOrigins } : undefined));
app.use(securityHeaders);
app.use(express.json({ limit: '5mb' }));

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

app.listen(PORT, async () => {
  console.log(`OpsRelay API listening on http://localhost:${PORT}`);
  console.log(`Auth: ${isAuthEnabled() ? 'ENABLED (JWT)' : 'disabled'}`);
  console.log(`Bedrock: ${isBedrockConfigured() ? 'ENABLED' : 'disabled (fallback mode)'}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);

  try {
    const applied = await runVersionedMigrations();
    if (applied.length) console.log('Versioned migrations applied:', applied.join(', '));
  } catch (err) {
    console.warn('Versioned migrations skipped:', err instanceof Error ? err.message : err);
  }

  startJobWorker();
  console.log('Background job worker started (15s interval)');

  try {
    await migrateEmbeddingProvenanceSchema();
    console.log('Embedding provenance columns ready');
  } catch (err) {
    console.warn('Embedding provenance migration skipped:', err instanceof Error ? err.message : err);
  }

  try {
    await migrateTeamChatImageSchema();
    console.log('Team chat image columns ready');
  } catch (err) {
    console.warn('Team chat image migration skipped:', err instanceof Error ? err.message : err);
  }

  try {
    await migrateTeamChatSchema();
    console.log('Team chat schema ready (messages, timed guests)');
  } catch (err) {
    console.warn('Team chat schema migration skipped:', err instanceof Error ? err.message : err);
  }

  try {
    await migrateAlertFatigueSchema();
    console.log('Alert fatigue schema ready (alert_embeddings + vector index)');
  } catch (err) {
    console.warn('Alert fatigue schema migration skipped:', err instanceof Error ? err.message : err);
  }

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
