import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import categoriesRouter from './routes/categories.js';
import expensesRouter from './routes/expenses.js';
import fixedExpensesRouter from './routes/fixedExpenses.js';
import creditCardsRouter from './routes/creditCards.js';
import debtsRouter from './routes/debts.js';
import goalsRouter from './routes/goals.js';
import { verifyToken } from './middleware/jwtAuth.js';

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

// Auth routes (no authentication required)
app.use('/api/auth', authRouter);

// Apply JWT verification middleware to all protected API routes
app.use('/api', verifyToken);

// Protected routes
app.use('/api/settings', settingsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/fixed-expenses', fixedExpensesRouter);
app.use('/api/credit-cards', creditCardsRouter);
app.use('/api/debts', debtsRouter);
app.use('/api/goals', goalsRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Finance Tracker API server is running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

