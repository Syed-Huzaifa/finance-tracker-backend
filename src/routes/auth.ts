import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';
import { z } from 'zod';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Signup endpoint
router.post('/signup', async (req, res) => {
  try {
    // Validate input
    const validationResult = signupSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validationResult.error.errors,
      });
    }

    const { email, password } = validationResult.data;

    // Check if user already exists
    const { rows: existingUsers } = await pool.query(
      'SELECT id FROM public.users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: newUser } = await client.query(
        'INSERT INTO public.users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
        [email.toLowerCase(), passwordHash]
      );

      // Create default settings for the user
      await client.query(
        'INSERT INTO public.settings (user_id, monthly_income, salary_day) VALUES ($1, $2, $3)',
        [newUser[0].id, 0, 1]
      );

      await client.query('COMMIT');

      // Generate JWT token
      const token = jwt.sign(
        { userId: newUser[0].id, email: newUser[0].email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(201).json({
        message: 'User created successfully',
        token,
        user: {
          id: newUser[0].id,
          email: newUser[0].email,
        },
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Transaction error in signup:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error detail:', error.detail);
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Signup error:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more detailed error information
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    
    if (error.code === '23503') { // Foreign key violation
      return res.status(500).json({ error: 'Database constraint violation', details: error.message });
    }
    
    if (error.code === '42P01') { // Table doesn't exist
      return res.status(500).json({ 
        error: 'Database table not found. Please run migrations.',
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Signin endpoint
router.post('/signin', async (req, res) => {
  try {
    // Validate input
    const validationResult = signinSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validationResult.error.errors,
      });
    }

    const { email, password } = validationResult.data;

    // Find user
    const { rows: users } = await pool.query(
      'SELECT id, email, password_hash FROM public.users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Sign in successful',
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('Signin error:', error);
    
    // Provide more detailed error information
    if (error.code === '42P01') { // Table doesn't exist
      return res.status(500).json({ 
        error: 'Database table not found. Please run migrations.',
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;

