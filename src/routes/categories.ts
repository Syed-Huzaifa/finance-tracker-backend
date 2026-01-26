import express from 'express';
import pool from '../db/connection.js';
import { AuthenticatedRequest } from '../middleware/jwtAuth.js';

const router = express.Router();

// Get all categories
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM public.categories WHERE user_id = $1 ORDER BY sort_order',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create category
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, icon, color, parent_category, sort_order } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO public.categories (user_id, name, icon, color, parent_category, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, name, icon || null, color || null, parent_category || null, sort_order || 0]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update category
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { name, icon, color, parent_category, sort_order } = req.body;
    
    const { rows } = await pool.query(
      `UPDATE public.categories 
       SET name = COALESCE($1, name),
           icon = COALESCE($2, icon),
           color = COALESCE($3, color),
           parent_category = COALESCE($4, parent_category),
           sort_order = COALESCE($5, sort_order)
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [name, icon, color, parent_category, sort_order, id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete category
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    
    const { rows } = await pool.query(
      'DELETE FROM public.categories WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

