# Funderra — Setup Guide (Non-Technical)

This guide walks you through getting Funderra running on your computer from scratch.

---

## Step 0: Install Required Software

You need three things installed on your computer. If you already have any of them, skip that step.

### A) Node.js (runs the app)

1. Go to https://nodejs.org
2. Download the **LTS** version (the big green button)
3. Run the installer, click "Next" through everything
4. Verify it worked: open your terminal and type:
   ```
   node --version
   ```
   You should see something like `v20.x.x` or `v22.x.x`

### B) PostgreSQL (the database)

**Option 1: Easiest — Use a cloud database (recommended for beginners)**

1. Go to https://neon.tech (free tier available)
2. Sign up and create a new project
3. Name it "funderra"
4. Choose the closest region to you
5. Copy the connection string — it looks like:
   ```
   postgresql://username:password@ep-something.region.aws.neon.tech/neondb?sslmode=require
   ```
   **Save this somewhere** (notepad, sticky note, etc.) — you'll paste it into the `.env` file in Step 2 below.
6. **Important:** After creating the database, run this in the Neon SQL console:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

**Option 2: Local install (Mac)**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb funderra
psql funderra -c "CREATE EXTENSION IF NOT EXISTS vector;"
```
Your connection string will be: `postgresql://localhost:5432/funderra`

**Option 2: Local install (Windows)**

1. Go to https://www.postgresql.org/download/windows/
2. Download and run the installer
3. Remember the password you set during install
4. Open pgAdmin (installed with PostgreSQL), create a database called `funderra`
5. Run this SQL query in pgAdmin: `CREATE EXTENSION IF NOT EXISTS vector;`
6. Your connection string will be: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/funderra`

### C) Redis (for background jobs) — OPTIONAL for now

You can skip Redis for initial development. Background jobs (research queue) won't run, but everything else will work. When you're ready:

**Cloud (easiest):** https://upstash.com — free tier, copy the Redis URL.

**Mac:** `brew install redis && brew services start redis`

---

## Step 1: Set Up Your API Keys

You need accounts with these services. All have free tiers.

### OpenAI (powers matching + embeddings)

1. Go to https://platform.openai.com
2. Sign up / log in
3. Go to https://platform.openai.com/api-keys
4. Click "Create new secret key"
5. Name it "Funderra"
6. Copy the key (starts with `sk-`)
7. **Cost:** ~$5-20/month depending on usage

### Tavily (web search for finding donors)

1. Go to https://tavily.com
2. Sign up
3. Go to your dashboard → API Keys
4. Copy the key (starts with `tvly-`)
5. **Cost:** Free tier = 1,000 searches/month

### Perplexity (deep research with citations)

1. Go to https://docs.perplexity.ai
2. Sign up for API access
3. Go to Settings → API Keys
4. Generate a new key (starts with `pplx-`)
5. **Cost:** Pay-per-use, ~$0.001 per request for sonar, more for sonar-pro

### Firecrawl (web scraping)

1. Go to https://firecrawl.dev
2. Sign up
3. Go to your dashboard → API Keys
4. Copy the key (starts with `fc-`)
5. **Cost:** Free tier = 500 pages/month

---

## Step 2: Configure the App

1. Open your terminal
2. Navigate to the project folder:
   ```bash
   cd /path/to/donors
   ```
3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
4. Open `.env` in any text editor (VS Code, Notepad, TextEdit, etc.)
5. Fill in your values:

   ```
   # Paste your database connection string here
   DATABASE_URL="postgresql://username:password@host:5432/funderra?sslmode=require"

   # Leave as-is if you skipped Redis
   REDIS_URL="redis://localhost:6379"

   # Generate a random secret (or just type a long random string)
   NEXTAUTH_SECRET="paste-any-long-random-string-here-at-least-32-characters"
   NEXTAUTH_URL="http://localhost:3000"

   # Paste your API keys
   OPENAI_API_KEY="sk-..."
   TAVILY_API_KEY="tvly-..."
   PERPLEXITY_API_KEY="pplx-..."
   FIRECRAWL_API_KEY="fc-..."

   # Leave empty for now (set up Paddle later)
   PADDLE_API_KEY=""
   PADDLE_WEBHOOK_SECRET=""
   PADDLE_ENVIRONMENT="sandbox"
   ```
6. Save the file

---

## Step 3: Install Dependencies & Set Up Database

Run these commands in your terminal, one at a time:

```bash
# Install all packages (takes 30-60 seconds)
npm install

# Create all database tables
npm run db:push
```

If `db:push` succeeds, you'll see a message like:
```
Your database is now in sync with your Prisma schema.
```

---

## Step 4: Start the App

```bash
npm run dev
```

You should see:
```
▲ Next.js 14.x.x
- Local: http://localhost:3000
```

Open **http://localhost:3000** in your browser. You should see the Funderra landing page.

---

## Step 5: Seed the Database (Get Your First Donors)

With the app running, open a new terminal tab and run:

```bash
# Import US foundations from IRS 990 data (takes a few minutes)
curl -X POST http://localhost:3000/api/irs990/import -H "Content-Type: application/json" -d '{"maxPages": 2}'
```

This searches ProPublica for foundations relevant to Israeli NGOs and imports them.

To discover more donors via web research:
```bash
curl -X POST http://localhost:3000/api/research/discover -H "Content-Type: application/json" -d '{"cause": "education", "region": "Israel"}'
```

---

## Troubleshooting

### "Cannot connect to database"
- Double-check your `DATABASE_URL` in `.env`
- Make sure the database exists and the `vector` extension is installed
- If using Neon, make sure you're using the connection string with `?sslmode=require`

### "OPENAI_API_KEY is not set"
- Make sure you saved the `.env` file
- Restart the dev server (`Ctrl+C` then `npm run dev`)

### "npm install" fails
- Make sure Node.js is installed: `node --version`
- Try deleting `node_modules` and running `npm install` again

### "prisma generate" fails
- Run `npx prisma generate` manually
- Make sure you're in the project folder

---

## What's Next?

Once the app is running and you have some donors in the database, we'll build:
- **Phase 2:** Login/signup, org onboarding, matching engine, swipe UI
- **Phase 3:** Paddle billing, usage limits, feedback loop
- **Phase 4:** CRM features (email, reminders, pipeline)
