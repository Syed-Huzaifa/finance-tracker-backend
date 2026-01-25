import express from 'express';
import pool from '../db/connection.js';

const router = express.Router();

// Get all credit cards
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM public.credit_cards ORDER BY created_at'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching credit cards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create credit card
router.post('/', async (req, res) => {
  try {
    const { name, bank_name, credit_limit, current_balance, statement_day, due_day } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO public.credit_cards (name, bank_name, credit_limit, current_balance, statement_day, due_day)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name,
        bank_name,
        credit_limit,
        current_balance || 0,
        statement_day || 1,
        due_day || 15
      ]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating credit card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update credit card
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
      `UPDATE public.credit_cards 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Credit card not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating credit card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete credit card
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await pool.query(
      'DELETE FROM public.credit_cards WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Credit card not found' });
    }
    
    res.json({ message: 'Credit card deleted successfully' });
  } catch (error) {
    console.error('Error deleting credit card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get credit card payments
router.get('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await pool.query(
      `SELECT * FROM public.credit_card_payments 
       WHERE credit_card_id = $1 
       ORDER BY payment_date DESC`,
      [id]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching credit card payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create credit card payment
router.post('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_date, notes } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO public.credit_card_payments (credit_card_id, amount, payment_date, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, amount, payment_date || new Date().toISOString().split('T')[0], notes || null]
    );
    
    // Update credit card balance
    await pool.query(
      `UPDATE public.credit_cards 
       SET current_balance = GREATEST(0, current_balance - $1)
       WHERE id = $2`,
      [amount, id]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating credit card payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all credit card payments
router.get('/payments/all', async (req, res) => {
  try {
    const { cardId } = req.query;
    
    let query = 'SELECT * FROM public.credit_card_payments WHERE 1=1';
    const params: any[] = [];
    
    if (cardId) {
      query += ' AND credit_card_id = $1';
      params.push(cardId);
    }
    
    query += ' ORDER BY payment_date DESC';
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching credit card payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

