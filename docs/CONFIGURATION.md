# Configuration

Create a `.env` file in the project root (never commit it). Set only the variables you need for your environment.

## Required for CockroachDB mode

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string for the main app database |
| `MIGRATION_DATABASE_URL` | DDL-capable connection for `npm run db:migrate` |
| `CRDB_DATABASE` | Main database name (default `Rudra`) |
| `CRDB_SECURE_DATABASE` | Auth database name (default `SecureData`) |
| `JWT_SECRET` | Secret for signing session tokens |
| `VITE_USE_CRDB` | Set `true` for production API mode |
| `VITE_API_URL` | API base path (usually `/api`) |

## Auth & security

| Variable | Description |
|----------|-------------|
| `AUTH_ENABLED` | Enable login (`true` recommended) |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `8h`) |
| `PASSWORD_PEPPER` | Optional password hashing pepper |
| `AUDIT_IP_SALT` | Salt for audit log IP hashing |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `SEED_DEFAULT_PASSWORD` | Only for local seed scripts |

## Server

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `3001`) |
| `NODE_ENV` | `development` or `production` |

## AWS Bedrock (optional)

| Variable | Description |
|----------|-------------|
| `BEDROCK_ENABLED` | Enable Bedrock LLM and embeddings |
| `AWS_REGION` | AWS region |
| `AWS_ACCESS_KEY_ID` | Leave empty on EC2 if using IAM role |
| `AWS_SECRET_ACCESS_KEY` | Leave empty on EC2 if using IAM role |
| `BEDROCK_LLM_MODEL` | Extraction model ID |
| `BEDROCK_AGENT_MODEL` | Ask AI model ID |
| `BEDROCK_EMBED_MODEL` | Embedding model ID |
| `BEDROCK_EMBED_DIMENSIONS` | Embedding dimensions (default `1024`) |

## MCP investigator (optional)

| Variable | Description |
|----------|-------------|
| `MCP_MODE` | `disabled`, `local_sql_demo`, or `managed_mcp` |
| `MCP_ENABLED` | Enable investigator feature |
| `MCP_SERVER_URL` | CockroachDB Cloud MCP endpoint |
| `MCP_CLUSTER_ID` | Cluster ID for managed MCP |
| `MCP_ACCESS_TOKEN` | OAuth token for managed MCP |
| `MCP_EVIDENCE_DATABASE` | Database containing `incident_evidence` |
| `MCP_QUERY_TIMEOUT_MS` | Query timeout |
| `MCP_MAX_RESULTS` | Max rows per investigation |
| `MCP_ALLOW_SQL_BRIDGE` | Local SQL fallback (demo only) |

## Evidence projection (optional)

| Variable | Description |
|----------|-------------|
| `EVIDENCE_DATABASE_URL` | Writer credential for evidence projection |
| `EVIDENCE_DATABASE_NAME` | Evidence database name |

See [COCKROACHDB_SETUP.md](COCKROACHDB_SETUP.md), [BEDROCK_VECTOR_SETUP.md](BEDROCK_VECTOR_SETUP.md), and [EC2_DEPLOY.md](EC2_DEPLOY.md) for setup steps.
