import { Request, Response, NextFunction } from 'express';
import pool from '../db/connection.js';

// Simple PIN verification middleware
// In a real app, you'd want to hash the PIN properly
export const verifyPin = async (req: Request, res: Response, next: NextFunction) => {
  const pin = req.headers['x-pin'] as string;

  // Allow GET /api/settings without PIN for initial PIN check
  // This allows the frontend to check if a PIN is set before requiring authentication
  const isSettingsGet = req.method === 'GET' && (
    req.path === '/settings' || 
    req.originalUrl === '/api/settings' || 
    req.originalUrl?.startsWith('/api/settings')
  );

  // Allow PUT /api/settings without PIN only if no PIN is set yet (first-time setup)
  const isSettingsPut = req.method === 'PUT' && (
    req.path === '/settings' || 
    req.originalUrl === '/api/settings' || 
    req.originalUrl?.startsWith('/api/settings')
  );

  if (!pin && isSettingsGet) {
    return next();
  }

  // For PUT /api/settings, check if PIN is already set
  if (!pin && isSettingsPut) {
    try {
      const { rows } = await pool.query('SELECT pin_hash FROM public.settings LIMIT 1');
      
      // If no settings exist or PIN is not set, allow the request (first-time setup)
      if (rows.length === 0 || !rows[0].pin_hash || rows[0].pin_hash.trim().length === 0) {
        return next();
      }
      
      // PIN is already set, so require authentication
      return res.status(401).json({ error: 'PIN is required' });
    } catch (error) {
      console.error('Error checking PIN status:', error);
      // On error, allow the request to proceed (safer for first-time setup)
      return next();
    }
  }

  if (!pin) {
    return res.status(401).json({ error: 'PIN is required' });
  }

  try {
    const { rows } = await pool.query('SELECT pin_hash FROM public.settings LIMIT 1');
    
    if (rows.length === 0) {
      // No settings found, allow access (first time setup)
      return next();
    }

    const storedPinHash = rows[0].pin_hash;

    // If PIN hash is empty, allow access (first time setup)
    if (!storedPinHash || storedPinHash.length === 0) {
      return next();
    }

    // Simple comparison (in production, use proper hashing)
    // For now, we'll do a simple string comparison since the frontend stores plain PIN
    // In production, you should use bcrypt to hash and compare
    // Trim both values to avoid whitespace issues
    if (storedPinHash.trim() === pin.trim()) {
      return next();
    }

    return res.status(401).json({ error: 'Invalid PIN' });
  } catch (error) {
    console.error('PIN verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

