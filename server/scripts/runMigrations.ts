import 'dotenv/config';
import { runVersionedMigrations } from '../migrations/runVersionedMigrations.js';

async function main() {
  try {
    if (!process.env.MIGRATION_DATABASE_URL?.trim()) {
      console.error(
        'MIGRATION_DATABASE_URL is required.\n' +
          'Use a migration-owner credential separate from the runtime DATABASE_URL.',
      );
      process.exit(1);
    }
    const applied = await runVersionedMigrations();
    if (applied.length) {
      console.log('Applied migrations:', applied.join(', '));
    } else {
      console.log('No pending migrations');
    }
  } catch (err) {
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

void main();
