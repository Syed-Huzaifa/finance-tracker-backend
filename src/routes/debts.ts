import express from 'express';
import pool from '../db/connection.js';

const router = express.Router();

// Get all debts
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM public.debts ORDER BY priority'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching debts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create debt
router.post('/', async (req, res) => {
  try {
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
       (name, total_amount, remaining_amount, priority, is_urgent, has_interest, interest_rate, deadline, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
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
router.put('/:id', async (req, res) => {
  try {
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

    values.push(id);

    const { rows } = await pool.query(
      `UPDATE public.debts 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramIndex}
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
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await pool.query(
      'DELETE FROM public.debts WHERE id = $1 RETURNING *',
      [id]
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
router.get('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    
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
router.post('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_date, notes } = req.body;
    
    // Add payment
    const { rows: paymentRows } = await pool.query(
      `INSERT INTO public.debt_payments (debt_id, amount, payment_date, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, amount, payment_date || new Date().toISOString().split('T')[0], notes || null]
    );
    
    // Update remaining amount on debt
    const { rows: debtRows } = await pool.query(
      'SELECT remaining_amount FROM public.debts WHERE id = $1',
      [id]
    );
    
    if (debtRows.length > 0) {
      const newRemainingAmount = Math.max(0, parseFloat(debtRows[0].remaining_amount) - amount);
      await pool.query(
        'UPDATE public.debts SET remaining_amount = $1 WHERE id = $2',
        [newRemainingAmount, id]
      );
    }
    
    res.status(201).json(paymentRows[0]);
  } catch (error) {
    console.error('Error creating debt payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all debt payments
router.get('/payments/all', async (req, res) => {
  try {
    const { debtId } = req.query;
    
    let query = 'SELECT * FROM public.debt_payments WHERE 1=1';
    const params: any[] = [];
    
    if (debtId) {
      query += ' AND debt_id = $1';
      params.push(debtId);
    }
    
    query += ' ORDER BY payment_date DESC';
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching debt payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

