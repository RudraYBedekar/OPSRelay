import 'dotenv/config';
import { embedAllIncidentsFromDb, getEmbeddingCount } from '../services/vectorService.js';
import { getEmbedMode } from '../services/embedService.js';

async function main() {
  const mode = getEmbedMode();
  console.log(`Building vector index using ${mode} embeddings...`);

  const chunks = await embedAllIncidentsFromDb();
  const total = await getEmbeddingCount();

  console.log(`Done. Indexed ${chunks} chunks (${total} rows in incident_embeddings).`);
  console.log(`Mode: ${mode}${mode === 'local' ? ' — switch to Bedrock Titan after AWS setup' : ''}`);
}

main().catch((err) => {
  console.error('Embed failed:', err.message);
  process.exit(1);
});
