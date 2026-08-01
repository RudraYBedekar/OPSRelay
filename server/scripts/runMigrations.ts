import 'dotenv/config';
import { migrateCommanderSchema } from '../services/commanderMigration.js';
import { migrateTeamChatSchema } from '../services/teamChatMigration.js';

async function main() {
  try {
    await migrateCommanderSchema();
    console.log('Commander schema OK');
    await migrateTeamChatSchema();
    console.log('Team chat schema OK');
  } catch (err) {
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

void main();
