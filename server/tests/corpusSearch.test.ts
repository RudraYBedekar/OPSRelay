import { describe, expect, it } from 'vitest';
import { searchIncidentsInCorpus, type IncidentRecord } from '../services/vectorService.js';

const sampleIncidents: IncidentRecord[] = [
  {
    id: 'INC-EX-2CE895-02',
    title: 'Webhook delivery failures — checkout-api',
    service: 'checkout-api',
    severity: 'SEV-2',
    summary: 'Example incident. Webhook delivery failures — checkout-api.',
    rawNotes: '[example-seed] Random incident',
  },
  {
    id: 'INC-IND-001',
    title: 'PostgreSQL connection pool exhaustion under peak traffic',
    service: 'postgres-replica',
    severity: 'SEV-1',
    summary: 'Checkout traffic spike exhausted the app-side pool.',
  },
];

describe('searchIncidentsInCorpus', () => {
  it('finds webhook incidents from natural language queries', () => {
    const hits = searchIncidentsInCorpus('check any issue with the webhook?', sampleIncidents, 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].incidentId).toBe('INC-EX-2CE895-02');
  });

  it('matches incident IDs directly', () => {
    const hits = searchIncidentsInCorpus('tell me about INC-IND-001', sampleIncidents, 5);
    expect(hits[0]?.incidentId).toBe('INC-IND-001');
    expect(hits[0]?.similarityScore).toBe(100);
  });
});
