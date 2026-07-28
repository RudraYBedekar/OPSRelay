import { Router } from 'express';
import { isBedrockConfigured } from '../config/bedrock.js';
import { extractIncidentFromNotes as bedrockExtract } from '../services/llmService.js';
import { fallbackExtract } from '../services/fallbackExtract.js';

export const extractRouter = Router();

extractRouter.post('/', async (req, res, next) => {
  try {
    const rawNotes = String(req.body.rawNotes ?? '');
    if (!rawNotes.trim()) {
      res.status(400).json({ error: 'Notes cannot be empty' });
      return;
    }

    if (isBedrockConfigured()) {
      try {
        const result = await bedrockExtract(rawNotes);
        res.json({ ...result as object, source: 'bedrock' });
        return;
      } catch (err) {
        console.warn('Bedrock extraction failed, using fallback:', err);
      }
    }

    res.json({ ...fallbackExtract(rawNotes), source: 'fallback' });
  } catch (err) {
    next(err);
  }
});
