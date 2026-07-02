# Quick Setup Guide

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Create Database
```bash
# Using psql
psql -U postgres
CREATE DATABASE finance_tracker;
\q

# Or using createdb command
createdb finance_tracker
```

## Step 3: Configure Environment
Create a `.env` file in the root directory:
```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=finance_tracker
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key-here-change-in-production
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=sk-ant-...   # required for the AI Analysis feature
```

## Step 4: Run Migrations
```bash
npm run migrate
```

## Step 5: Seed Database (Optional)
```bash
npm run seed
```

## Step 6: Start Server
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Testing the API

### Health Check (No authentication required)
```bash
curl http://localhost:3001/health
```

### Sign Up (Create account)
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

### Sign In
```bash
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

### Get Settings (JWT required)
```bash
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:3001/api/settings
```

### Get Expenses (JWT required)
```bash
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:3001/api/expenses
```

## Frontend Integration

Update your frontend `.env` file to point to the new backend:
```env
VITE_API_URL=http://localhost:3001
```

Then update your API client to use the new backend URL instead of Supabase.

## Troubleshooting

### PostgreSQL Password Authentication Failed

If you get an error like `password authentication failed for user "huzaifa"`, try one of these solutions:

#### Solution 1: Use the postgres superuser (Recommended)
Try connecting as the `postgres` superuser instead:
```bash
# This might work without a password on macOS
psql -U postgres

# Or if that doesn't work, try:
psql -U postgres -d postgres
```

Once connected, you can create the database:
```sql
CREATE DATABASE finance_tracker;
\q
```

#### Solution 2: Reset password for your user
If you need to use your system username, reset the password:
```bash
# Connect as postgres user first
psql -U postgres

# Then reset the password for your user
ALTER USER huzaifa WITH PASSWORD 'newpassword';
\q
```

Update your `.env` file:
```env
DB_USER=huzaifa
DB_PASSWORD=newpassword
```

#### Solution 3: Create a new PostgreSQL user
Create a dedicated user for the application:
```bash
# Connect as postgres user
psql -U postgres

# Create new user with password
CREATE USER finance_user WITH PASSWORD 'your-secure-password';
CREATE DATABASE finance_tracker OWNER finance_user;
GRANT ALL PRIVILEGES ON DATABASE finance_tracker TO finance_user;
\q
```

Update your `.env` file:
```env
DB_USER=finance_user
DB_PASSWORD=your-secure-password
```

#### Solution 4: Reset PostgreSQL authentication (macOS)
If you're on macOS and installed PostgreSQL via Homebrew, you might need to reset the postgres user password:
```bash
# Stop PostgreSQL
brew services stop postgresql

# Start PostgreSQL in single-user mode
postgres --single -D /usr/local/var/postgres postgres

# In the prompt, type:
ALTER USER postgres WITH PASSWORD 'postgres';
# Then press Ctrl+D to exit

# Restart PostgreSQL
brew services start postgresql
```

### Database Connection Issues
- Ensure PostgreSQL is running: `brew services list` (macOS) or `sudo systemctl status postgresql` (Linux)
- Verify database exists: `psql -U postgres -l`
- Check your `.env` file has the correct credentials

