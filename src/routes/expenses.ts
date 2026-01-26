import express from 'express';
import pool from '../db/connection.js';
import { AuthenticatedRequest } from '../middleware/jwtAuth.js';

const router = express.Router();

// Get all expenses with optional date filtering
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM public.expenses e
      LEFT JOIN public.categories c ON e.category_id = c.id
      WHERE e.user_id = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND e.expense_date >= $${paramIndex++}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND e.expense_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += ' ORDER BY e.expense_date DESC';

    const { rows } = await pool.query(query, params);
    
    // Transform to match frontend format
    const expenses = rows.map(row => ({
      id: row.id,
      amount: parseFloat(row.amount),
      category_id: row.category_id,
      description: row.description,
      expense_date: row.expense_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      category: row.category_name ? {
        id: row.category_id,
        name: row.category_name,
        icon: row.category_icon,
        color: row.category_color
      } : null
    }));

    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create expense
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount, category_id, description, expense_date } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO public.expenses (user_id, amount, category_id, description, expense_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, amount, category_id || null, description || null, expense_date || new Date().toISOString().split('T')[0]]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update expense
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { amount, category_id, description, expense_date } = req.body;
    
    const { rows } = await pool.query(
      `UPDATE public.expenses 
       SET amount = COALESCE($1, amount),
           category_id = COALESCE($2, category_id),
           description = COALESCE($3, description),
           expense_date = COALESCE($4, expense_date)
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [amount, category_id, description, expense_date, id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete expense
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    
    const { rows } = await pool.query(
      'DELETE FROM public.expenses WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

