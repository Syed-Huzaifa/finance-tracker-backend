import express from 'express';
import pool from '../db/connection.js';
import { AuthenticatedRequest } from '../middleware/jwtAuth.js';

const router = express.Router();

// Get all debts
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM public.debts WHERE user_id = $1 ORDER BY priority',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching debts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create debt
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name,
      total_amount,
      remaining_amount,
      priority,
      is_urgent,
      has_interest,
      interest_rate,
      deadline,
      notes
    } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO public.debts 
       (user_id, name, total_amount, remaining_amount, priority, is_urgent, has_interest, interest_rate, deadline, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        name,
        total_amount,
        remaining_amount,
        priority || 1,
        is_urgent || false,
        has_interest || false,
        interest_rate || 0,
        deadline || null,
        notes || null
      ]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating debt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update debt
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const updates = req.body;
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== 'id') {
        updateFields.push(`${key} = $${paramIndex++}`);
        values.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, userId);

    const { rows } = await pool.query(
      `UPDATE public.debts 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Debt not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating debt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete debt
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    
    const { rows } = await pool.query(
      'DELETE FROM public.debts WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Debt not found' });
    }
    
    res.json({ message: 'Debt deleted successfully' });
  } catch (error) {
    console.error('Error deleting debt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get debt payments
router.get('/:id/payments', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    
    // Verify the debt belongs to the user
    const { rows: debtCheck } = await pool.query(
      'SELECT id FROM public.debts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (debtCheck.length === 0) {
      return res.status(404).json({ error: 'Debt not found' });
    }
    
    const { rows } = await pool.query(
      `SELECT * FROM public.debt_payments 
       WHERE debt_id = $1 
       ORDER BY payment_date DESC`,
      [id]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching debt payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create debt payment
router.post('/:id/payments', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { amount, payment_date, notes } = req.body;
    
    // Verify the debt belongs to the user
    const { rows: debtCheck } = await pool.query(
      'SELECT id FROM public.debts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (debtCheck.length === 0) {
      return res.status(404).json({ error: 'Debt not found' });
    }
    
    // Add payment
    const { rows: paymentRows } = await pool.query(
      `INSERT INTO public.debt_payments (debt_id, amount, payment_date, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, amount, payment_date || new Date().toISOString().split('T')[0], notes || null]
    );
    
    // Update remaining amount on debt
    const { rows: debtRows } = await pool.query(
      'SELECT remaining_amount FROM public.debts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (debtRows.length > 0) {
      const newRemainingAmount = Math.max(0, parseFloat(debtRows[0].remaining_amount) - amount);
      await pool.query(
        'UPDATE public.debts SET remaining_amount = $1 WHERE id = $2 AND user_id = $3',
        [newRemainingAmount, id, userId]
      );
    }
    
    res.status(201).json(paymentRows[0]);
  } catch (error) {
    console.error('Error creating debt payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all debt payments
router.get('/payments/all', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { debtId } = req.query;
    
    let query = `
      SELECT dp.* FROM public.debt_payments dp
      INNER JOIN public.debts d ON dp.debt_id = d.id
      WHERE d.user_id = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 2;
    
    if (debtId) {
      query += ` AND dp.debt_id = $${paramIndex++}`;
      params.push(debtId);
    }
    
    query += ' ORDER BY dp.payment_date DESC';
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching debt payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

