import express from 'express';
import pool from '../db/connection.js';
import { AuthenticatedRequest } from '../middleware/jwtAuth.js';
import { buildFinancialSnapshot } from '../services/financialSnapshot.js';
import { generateAnalysis, AiAnalysisError, AI_ANALYSIS_MODEL } from '../services/aiAnalysis.js';

const router = express.Router();

// Generate a fresh AI analysis and persist it.
router.post('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const snapshot = await buildFinancialSnapshot(userId);

    // Guard: no income and no data means there's nothing meaningful to analyze.
    const hasData =
      snapshot.income.monthly > 0 ||
      snapshot.spendingByCategory.length > 0 ||
      snapshot.debts.length > 0 ||
      snapshot.goals.length > 0 ||
      snapshot.creditCards.length > 0;
    if (!hasData) {
      return res.status(400).json({
        error: 'Not enough financial data to analyze yet. Add your income, expenses, debts, or goals first.',
      });
    }

    // Optional free-text preferences from the account owner. Cap to bound tokens.
    const rawInstructions = typeof req.body?.instructions === 'string' ? req.body.instructions.trim() : '';
    const instructions = rawInstructions ? rawInstructions.slice(0, 1500) : null;

    const result = await generateAnalysis(snapshot, instructions ?? undefined);

    const { rows } = await pool.query(
      `INSERT INTO public.ai_analyses (user_id, result, model, instructions)
       VALUES ($1, $2, $3, $4)
       RETURNING id, result, model, instructions, created_at`,
      [userId, JSON.stringify(result), AI_ANALYSIS_MODEL, instructions]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error instanceof AiAnalysisError) {
      console.error('AI analysis error:', error.message, error.cause);
      return res.status(502).json({ error: error.message });
    }
    console.error('Error generating AI analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List past analyses (most recent first), metadata + result.
router.get('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, result, model, instructions, created_at
         FROM public.ai_analyses
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 20`,
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching AI analyses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch a single past analysis by id.
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, result, model, instructions, created_at
         FROM public.ai_analyses
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching AI analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
