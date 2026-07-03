import { auth } from 'express-oauth2-jwt-bearer';
import { Response, NextFunction } from 'express';
import pool from '../db/connection.js';
import { AuthenticatedRequest } from './jwtAuth.js';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

/**
 * Validates the incoming Auth0 access token. The token is RS256-signed by the
 * Auth0 tenant and verified against its public JWKS (fetched + cached by the
 * library). On success, req.auth.payload holds the token claims.
 */
export const checkJwt = auth({
  audience: AUTH0_AUDIENCE,
  issuerBaseURL: AUTH0_DOMAIN ? `https://${AUTH0_DOMAIN}/` : undefined,
});

/**
 * Resolves the Auth0 identity (the token's `sub`) to a local `users` row,
 * creating it on first login (just-in-time provisioning). Sets req.userId to
 * the local UUID so every existing route continues to work unchanged.
 *
 * Email is populated from the token when available — either a standard `email`
 * claim or a namespaced custom claim added via an Auth0 Action. It is optional.
 */
export const resolveUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = (req as any).auth?.payload as Record<string, unknown> | undefined;
    const sub = typeof payload?.sub === 'string' ? payload.sub : undefined;
    if (!sub) {
      return res.status(401).json({ error: 'Invalid token: missing subject' });
    }

    const email =
      (typeof payload?.email === 'string' && payload.email) ||
      (typeof payload?.['https://finance-tracker/email'] === 'string' &&
        (payload['https://finance-tracker/email'] as string)) ||
      null;

    const { rows } = await pool.query(
      `INSERT INTO public.users (auth0_sub, email)
       VALUES ($1, $2)
       ON CONFLICT (auth0_sub) DO UPDATE
         SET email = COALESCE(EXCLUDED.email, public.users.email)
       RETURNING id, email`,
      [sub, email]
    );

    req.userId = rows[0].id;
    req.userEmail = rows[0].email || undefined;
    next();
  } catch (error) {
    console.error('Error resolving Auth0 user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
