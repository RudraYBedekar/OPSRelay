import 'dotenv/config';
import { migrateTeamChatSchema } from '../services/teamChatMigration.js';
import { migrateAlertFatigueSchema } from '../services/alertFatigueMigration.js';
import { migrateEmbeddingProvenanceSchema } from '../services/embeddingProvenanceMigration.js';

async function main() {
  try {
    await migrateEmbeddingProvenanceSchema();
    console.log('Embedding provenance schema OK');
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
