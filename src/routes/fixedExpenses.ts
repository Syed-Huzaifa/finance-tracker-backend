import express from 'express';
import pool from '../db/connection.js';
import { AuthenticatedRequest } from '../middleware/jwtAuth.js';

const router = express.Router();

// Get all fixed expenses (optionally filtered by type)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type } = req.query;
    
    let query = 'SELECT * FROM public.fixed_expenses WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;
    
    if (type) {
      query += ` AND expense_type = $${paramIndex++}`;
      params.push(type);
    }
    
    query += ' ORDER BY reminder_day';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching fixed expenses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create fixed expense
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name,
      amount,
      reminder_day,
      is_active,
      last_paid_date,
      expense_type,
      auto_deduct,
      billing_cycle,
      next_billing_date,
      description
    } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO public.fixed_expenses 
       (user_id, name, amount, reminder_day, is_active, last_paid_date, expense_type, auto_deduct, billing_cycle, next_billing_date, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        userId,
        name,
        amount,
        reminder_day || 1,
        is_active !== undefined ? is_active : true,
        last_paid_date || null,
        expense_type || 'fixed',
        auto_deduct || false,
        billing_cycle || 'monthly',
        next_billing_date || null,
        description || null
      ]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating fixed expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update fixed expense
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
      `UPDATE public.fixed_expenses 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fixed expense not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating fixed expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete fixed expense
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    
    const { rows } = await pool.query(
      'DELETE FROM public.fixed_expenses WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fixed expense not found' });
    }
    
    res.json({ message: 'Fixed expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting fixed expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

