import 'dotenv/config';
import { backfillWelcomeIncidentsForAllUsers } from '../services/welcomeIncidentService.js';

async function main() {
  const result = await backfillWelcomeIncidentsForAllUsers();
  console.log(`Checked ${result.usersChecked} account(s)`);
  console.log(`Seeded ${result.usersSeeded} account(s) with ${result.incidentsCreated} welcome incident(s)`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
