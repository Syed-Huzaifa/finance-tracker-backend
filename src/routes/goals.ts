import express from 'express';
import pool from '../db/connection.js';

const router = express.Router();

// Get all goals
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM public.goals ORDER BY priority'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create goal
router.post('/', async (req, res) => {
  try {
    const {
      name,
      target_amount,
      current_amount,
      goal_type,
      priority,
      target_date,
      notes
    } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO public.goals 
       (name, target_amount, current_amount, goal_type, priority, target_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name,
        target_amount,
        current_amount || 0,
        goal_type,
        priority || 1,
        target_date || null,
        notes || null
      ]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update goal
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
      `UPDATE public.goals 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete goal
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await pool.query(
      'DELETE FROM public.goals WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get savings contributions
router.get('/:id/contributions', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await pool.query(
      `SELECT * FROM public.savings_contributions 
       WHERE goal_id = $1 
       ORDER BY contribution_date DESC`,
      [id]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching savings contributions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create savings contribution
router.post('/:id/contributions', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, contribution_date, notes } = req.body;
    
    // Add contribution
    const { rows: contributionRows } = await pool.query(
      `INSERT INTO public.savings_contributions (goal_id, amount, contribution_date, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, amount, contribution_date || new Date().toISOString().split('T')[0], notes || null]
    );
    
    // Update current amount on goal
    const { rows: goalRows } = await pool.query(
      'SELECT current_amount, target_amount FROM public.goals WHERE id = $1',
      [id]
    );
    
    if (goalRows.length > 0) {
      const newAmount = parseFloat(goalRows[0].current_amount) + amount;
      const targetAmount = parseFloat(goalRows[0].target_amount);
      
      await pool.query(
        `UPDATE public.goals 
         SET current_amount = $1, is_completed = $2
         WHERE id = $3`,
        [newAmount, newAmount >= targetAmount, id]
      );
    }
    
    res.status(201).json(contributionRows[0]);
  } catch (error) {
    console.error('Error creating savings contribution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all savings contributions
router.get('/contributions/all', async (req, res) => {
  try {
    const { goalId } = req.query;
    
    let query = 'SELECT * FROM public.savings_contributions WHERE 1=1';
    const params: any[] = [];
    
    if (goalId) {
      query += ' AND goal_id = $1';
      params.push(goalId);
    }
    
    query += ' ORDER BY contribution_date DESC';
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching savings contributions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

