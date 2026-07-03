import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import settingsRouter from './routes/settings.js';
import categoriesRouter from './routes/categories.js';
import expensesRouter from './routes/expenses.js';
import fixedExpensesRouter from './routes/fixedExpenses.js';
import creditCardsRouter from './routes/creditCards.js';
import debtsRouter from './routes/debts.js';
import goalsRouter from './routes/goals.js';
import aiAnalysisRouter from './routes/aiAnalysis.js';
import { checkJwt, resolveUser } from './middleware/auth0.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (no authentication required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Finance Tracker API is running' });
});

// Authentication is handled by Auth0. Every /api route requires a valid Auth0
// access token (checkJwt) and is mapped to a local user row (resolveUser).
app.use('/api', checkJwt, resolveUser);

// Protected routes
app.use('/api/settings', settingsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/fixed-expenses', fixedExpensesRouter);
app.use('/api/credit-cards', creditCardsRouter);
app.use('/api/debts', debtsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/ai-analysis', aiAnalysisRouter);

// Error handling middleware. Auth failures from express-oauth2-jwt-bearer carry
// a numeric `status` (401) — honor it instead of masking everything as 500.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  const status = typeof err?.status === 'number' ? err.status : 500;
  res.status(status).json({
    error: status === 401 ? 'Unauthorized' : 'Internal server error',
    message: err?.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start a standalone server for local dev / non-serverless hosts.
// On Vercel the app is imported by api/index.ts as a serverless handler, so we
// must NOT call listen there (Vercel sets the VERCEL env var in that runtime).
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Finance Tracker API server is running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });
}

// Exported so serverless platforms (Vercel) can use the app as a request handler.
export default app;
