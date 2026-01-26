import express from 'express';
import pool from '../db/connection.js';
import { AuthenticatedRequest } from '../middleware/jwtAuth.js';

const router = express.Router();

// Get settings
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM public.settings WHERE user_id = $1',
      [userId]
    );
    
    if (rows.length === 0) {
      // Create default settings if none exist
      const { rows: newSettings } = await pool.query(
        'INSERT INTO public.settings (user_id, monthly_income, salary_day) VALUES ($1, $2, $3) RETURNING *',
        [userId, 0, 1]
      );
      return res.json(newSettings[0]);
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update settings
router.put('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updates = req.body;
    
    // Get existing settings
    const { rows: existing } = await pool.query(
      'SELECT id FROM public.settings WHERE user_id = $1',
      [userId]
    );
    
    if (existing.length === 0) {
      // Create new settings if none exist
      const { rows } = await pool.query(
        `INSERT INTO public.settings (user_id, monthly_income, adjusted_income, adjusted_income_month, salary_day)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          userId,
          updates.monthly_income || 0,
          updates.adjusted_income || null,
          updates.adjusted_income_month || null,
          updates.salary_day || 1
        ]
      );
      return res.json(rows[0]);
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.monthly_income !== undefined) {
      updateFields.push(`monthly_income = $${paramIndex++}`);
      values.push(updates.monthly_income);
    }
    if (updates.adjusted_income !== undefined) {
      updateFields.push(`adjusted_income = $${paramIndex++}`);
      values.push(updates.adjusted_income);
    }
    if (updates.adjusted_income_month !== undefined) {
      updateFields.push(`adjusted_income_month = $${paramIndex++}`);
      values.push(updates.adjusted_income_month);
    }
    if (updates.salary_day !== undefined) {
      updateFields.push(`salary_day = $${paramIndex++}`);
      values.push(updates.salary_day);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(existing[0].id);

    const { rows } = await pool.query(
      `UPDATE public.settings 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      [...values, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

