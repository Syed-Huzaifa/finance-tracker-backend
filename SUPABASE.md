# Moving the database to Supabase (free)

The backend is plain Postgres (`pg`), so switching to Supabase's free Postgres is a
**connection-string swap** — no code changes. Follow these steps.

## 1. Create a free Supabase project
1. Sign up at https://supabase.com (no card required).
2. **New project** → pick a name, a strong **database password** (save it), and a region
   near you. Wait ~2 minutes for it to provision.

## 2. Get the connection string
1. Project → **Settings** → **Database** → **Connection string**.
2. Choose the **Session pooler** tab (labelled "Session mode", port `5432`).
   - Use this one: it's IPv4 and works for both the migration and a long-running
     server. (Avoid "Transaction pooler" for the migration — it can't run the
     `BEGIN/COMMIT` migration transaction.)
3. Copy the URI. It looks like:
   ```
   postgresql://postgres.abcdxyz:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
   ```
   Replace `[YOUR-PASSWORD]` with the password from step 1.

## 3. Point the backend at Supabase
In `finance-tracker-backend/.env`, set `DATABASE_URL` to that URI and make sure
**`PGSSL` is NOT `disable`** (Supabase requires SSL — just remove the line):

```env
DATABASE_URL=postgresql://postgres.abcdxyz:YOUR-PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
# remove or comment out: PGSSL=disable
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-secret
```

## 4. Create the tables
```bash
cd finance-tracker-backend
npm run migrate      # creates all tables (users, expenses, ai_analyses, ...) on Supabase
```
Optional demo data: `npm run seed`.

## 5. Point production (Render) at Supabase
In the Render dashboard for the backend service → **Environment**:
- Set `DATABASE_URL` to the same Supabase Session-pooler URI.
- Ensure there is **no** `PGSSL=disable` var.
- Redeploy. (You can now delete the old Render Postgres instance to stop its cost.)

The frontend needs no changes — it talks to the API, not the database.

## Notes
- The migration is non-destructive on a fresh DB (`CREATE TABLE IF NOT EXISTS`).
- SSL is handled automatically: the pool uses SSL unless `PGSSL=disable` is set
  (which is only for a bare local Postgres).
- Free tier: 500 MB database, plenty for this app.
