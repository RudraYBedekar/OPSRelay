import { Router } from 'express';
import { isBedrockConfigured } from '../config/bedrock.js';
import { extractIncidentFromNotes as bedrockExtract } from '../services/llmService.js';
import { fallbackExtract } from '../services/fallbackExtract.js';
import { assertNotesSafeForProcessing, scanAndRedactSecrets } from '../utils/redactSecrets.js';

export const extractRouter = Router();

const MAX_NOTES_LENGTH = 50_000;

extractRouter.post('/', async (req, res, next) => {
  try {
    const rawNotes = String(req.body.rawNotes ?? '');
    if (!rawNotes.trim()) {
      res.status(400).json({ error: 'Notes cannot be empty' });
      return;
    }

    if (rawNotes.length > MAX_NOTES_LENGTH) {
      res.status(400).json({ error: 'Notes exceed maximum allowed length (50,000 characters).' });
      return;
    }

    assertNotesSafeForProcessing(rawNotes);
    const { redactedText, findings } = scanAndRedactSecrets(rawNotes);

    if (isBedrockConfigured()) {
      try {
        const result = await bedrockExtract(redactedText);
        res.json({
          ...result,
          source: 'bedrock',
          redactionApplied: findings.length > 0,
        });
        return;
      } catch (err) {
        console.warn('Bedrock extraction failed:', err instanceof Error ? err.message : err);
        res.status(422).json({
          error: 'analysis_failed',
          message: 'AI extraction could not produce a valid structured result. Please retry or edit manually.',
        });
        return;
      }
    }

    res.json({ ...fallbackExtract(redactedText), source: 'fallback', redactionApplied: findings.length > 0 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('credentials')) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});
