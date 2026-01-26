# Finance Tracker Backend

A Node.js/Express backend server for the Finance Tracker application, using PostgreSQL as the database.

## Features

- RESTful API for managing personal finances
- PostgreSQL database with proper schema
- PIN-based authentication
- Support for:
  - Expenses and categories
  - Fixed expenses and subscriptions
  - Credit cards and payments
  - Debts and debt payments
  - Savings goals and contributions
  - Settings and income tracking

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. Clone or navigate to the project directory:
```bash
cd finance-tracker-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=finance_tracker
DB_USER=YOUR_DB_USER
DB_PASSWORD=YOUR_DB_PASSWORD

# JWT Security
JWT_SECRET=your-secret-key-here-change-in-production
JWT_EXPIRES_IN=7d
```

4. Create the PostgreSQL database:
```bash
createdb finance_tracker
```

Or using psql:
```sql
CREATE DATABASE finance_tracker;
```

5. Run database migrations:
```bash
npm run migrate
```

6. Seed the database with initial data:
```bash
npm run seed
```

## Running the Server

### Development Mode
```bash
npm run dev
```

The server will start on `http://localhost:3001` (or the port specified in your `.env` file).

### Production Mode
```bash
npm run build
npm start
```

## API Endpoints

All endpoints require JWT authentication (except `/health` and `/api/auth/*`).

### Health Check
- `GET /health` - Check if the server is running

### Authentication
- `POST /api/auth/signup` - Create a new user account
  - Body: `{ "email": "user@example.com", "password": "password123" }`
  - Returns: `{ "token": "jwt-token", "user": { "id": "uuid", "email": "user@example.com" } }`
- `POST /api/auth/signin` - Sign in with existing account
  - Body: `{ "email": "user@example.com", "password": "password123" }`
  - Returns: `{ "token": "jwt-token", "user": { "id": "uuid", "email": "user@example.com" } }`

### Settings
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create a category
- `PUT /api/categories/:id` - Update a category
- `DELETE /api/categories/:id` - Delete a category

### Expenses
- `GET /api/expenses?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - Get expenses (optional date filtering)
- `POST /api/expenses` - Create an expense
- `PUT /api/expenses/:id` - Update an expense
- `DELETE /api/expenses/:id` - Delete an expense

### Fixed Expenses
- `GET /api/fixed-expenses?type=fixed|subscription` - Get fixed expenses (optional type filter)
- `POST /api/fixed-expenses` - Create a fixed expense
- `PUT /api/fixed-expenses/:id` - Update a fixed expense
- `DELETE /api/fixed-expenses/:id` - Delete a fixed expense

### Credit Cards
- `GET /api/credit-cards` - Get all credit cards
- `POST /api/credit-cards` - Create a credit card
- `PUT /api/credit-cards/:id` - Update a credit card
- `DELETE /api/credit-cards/:id` - Delete a credit card
- `GET /api/credit-cards/:id/payments` - Get payments for a credit card
- `POST /api/credit-cards/:id/payments` - Create a payment for a credit card
- `GET /api/credit-cards/payments/all?cardId=uuid` - Get all payments (optional card filter)

### Debts
- `GET /api/debts` - Get all debts
- `POST /api/debts` - Create a debt
- `PUT /api/debts/:id` - Update a debt
- `DELETE /api/debts/:id` - Delete a debt
- `GET /api/debts/:id/payments` - Get payments for a debt
- `POST /api/debts/:id/payments` - Create a payment for a debt
- `GET /api/debts/payments/all?debtId=uuid` - Get all payments (optional debt filter)

### Goals
- `GET /api/goals` - Get all goals
- `POST /api/goals` - Create a goal
- `PUT /api/goals/:id` - Update a goal
- `DELETE /api/goals/:id` - Delete a goal
- `GET /api/goals/:id/contributions` - Get contributions for a goal
- `POST /api/goals/:id/contributions` - Create a contribution for a goal
- `GET /api/goals/contributions/all?goalId=uuid` - Get all contributions (optional goal filter)

## Authentication

The API uses JWT (JSON Web Token) authentication. After signing up or signing in, include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Example Usage

1. **Sign up** (create a new account):
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

2. **Sign in** (existing account):
```bash
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

3. **Use protected endpoints**:
```bash
curl http://localhost:3001/api/settings \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Security Notes:**
- Passwords are hashed using bcrypt before storage
- JWT tokens expire after 7 days (configurable via `JWT_EXPIRES_IN` environment variable)
- Store tokens securely on the client side (e.g., in localStorage or httpOnly cookies)
- In production, use a strong `JWT_SECRET` environment variable

## Database Schema

The database includes the following tables:
- `users` - User accounts (email and password hash)
- `settings` - Application settings (linked to users)
- `categories` - Expense categories (linked to users)
- `expenses` - Individual expenses
- `fixed_expenses` - Fixed expenses and subscriptions
- `credit_cards` - Credit card information
- `credit_card_payments` - Credit card payment history
- `debts` - Debt information
- `debt_payments` - Debt payment history
- `goals` - Savings goals
- `savings_contributions` - Savings contributions

## Development

### Project Structure
```
finance-tracker-backend/
├── src/
│   ├── db/
│   │   ├── connection.ts      # PostgreSQL connection pool
│   │   ├── migrate.ts          # Database migration script
│   │   └── seed.ts             # Database seeding script
│   ├── middleware/
│   │   └── jwtAuth.ts          # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.ts             # Authentication routes (signup/signin)
│   │   ├── settings.ts
│   │   ├── categories.ts
│   │   ├── expenses.ts
│   │   ├── fixedExpenses.ts
│   │   ├── creditCards.ts
│   │   ├── debts.ts
│   │   └── goals.ts
│   └── index.ts                # Main server file
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify database credentials in `.env`
- Check that the database exists: `psql -l`

### Migration Issues
- Drop and recreate the database if needed
- Ensure you have proper PostgreSQL permissions

## License

ISC

