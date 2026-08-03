import 'dotenv/config';
import { migrateTeamChatSchema } from '../services/teamChatMigration.js';
import { migrateTeamChatImageSchema } from '../services/teamChatImageMigration.js';
import { migrateAlertFatigueSchema } from '../services/alertFatigueMigration.js';
import { migrateEmbeddingProvenanceSchema } from '../services/embeddingProvenanceMigration.js';
import { runVersionedMigrations } from '../migrations/runVersionedMigrations.js';

async function main() {
  try {
    const applied = await runVersionedMigrations();
    if (applied.length) console.log('Versioned migrations:', applied.join(', '));
    await migrateEmbeddingProvenanceSchema();
    console.log('Embedding provenance schema OK');
    await migrateTeamChatImageSchema();
    console.log('Team chat image schema OK');
    await migrateTeamChatSchema();
    console.log('Team chat schema OK');
    await migrateAlertFatigueSchema();
    console.log('Alert fatigue schema OK');
  } catch (err) {
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

void main();
