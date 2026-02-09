# DonorMatch — Comprehensive Project Plan

## Vision
A donor discovery platform for Israeli NGOs. Users describe their organization, get matched with relevant donors (foundations, individuals, corporates, government), swipe to keep or skip, enrich promising leads with deep research, and manage the relationship over time. The system learns from every interaction to improve future matches.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Onboard  │  │  Swipe   │  │ Pipeline │  │  CRM   │  │
│  │  Flow    │  │  Cards   │  │  Board   │  │ Tools  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ API
┌───────────────────────┴─────────────────────────────────┐
│                   Backend (Next.js API)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  Auth    │  │ Matching │  │ Enrichmt │  │ Billing│  │
│  │ Service  │  │  Engine  │  │  Agents  │  │ Service│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────┐
│                     Data Layer                          │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │   PostgreSQL     │  │   Background Jobs            │ │
│  │  + pgvector      │  │  - Donor research crawlers   │ │
│  │  (donors, orgs,  │  │  - Enrichment agents         │ │
│  │   matches, CRM)  │  │  - Feedback scoring updater  │ │
│  └──────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **Next.js 14** (App Router) | Full-stack: UI + API in one project |
| Language | **TypeScript** | Type safety, better tooling |
| Database | **PostgreSQL** + **pgvector** | Relational data + vector similarity for semantic matching on missions/causes |
| ORM | **Prisma** | Simple DB access, migrations, type-safe queries |
| Styling | **Tailwind CSS** + **shadcn/ui** | Fast, clean UI components |
| Auth | **NextAuth.js** | Email/password + OAuth |
| Background Jobs | **BullMQ** + **Redis** | Reliable job queues for crawling, enrichment, scoring |
| Web Research | **Puppeteer** / **Cheerio** + **Search APIs** | Real web scraping, no hallucination |
| AI/Matching | **OpenAI API** (for NLP tasks) | Embedding missions/causes for semantic similarity |
| Payments | **Stripe** | Freemium + per-enrichment billing |

---

## Data Model (Core Entities)

### Donors
```
Donor {
  id
  name
  type                    // foundation | individual | corporate | government
  description             // who they are, what they do
  website
  location                // country, city
  political_affiliation   // left | center | right | nonpartisan | unknown
  causes[]                // education, health, environment, etc.
  target_populations[]    // children, elderly, immigrants, etc.
  geographic_focus[]      // Israel, US, global, etc.
  past_donations[]        // → DonorGrant (who they gave to, how much, when)
  publications[]          // articles, social media posts, podcasts
  contact_info            // email, phone, social links
  mission_embedding       // vector for semantic matching
  data_sources[]          // where we found this info (for trust/verification)
  last_researched_at
  data_quality_score      // how complete/reliable is our data
}
```

### Organizations (Users' NGOs)
```
Organization {
  id
  name
  mission
  causes[]
  target_populations[]
  geographic_focus[]
  location
  size                    // staff count range
  annual_budget_range
  political_affiliation
  existing_donors[]       // donors they already work with (critical for matching)
  similar_orgs[]          // orgs they consider peers
  mission_embedding       // vector for semantic matching
}
```

### Users
```
User {
  id
  email
  name
  role                    // admin | member
  organization_id         // → Organization
}
```

### Matching & Swipes
```
Match {
  id
  organization_id
  donor_id
  score                   // internal only, never shown to user
  score_breakdown         // { similar_orgs: 0.4, causes: 0.2, ... }
  reasoning               // human-readable "why we think they match"
  status                  // pending | swiped_right | swiped_left
  swiped_at
}
```

### Pipeline (after swipe right)
```
PipelineEntry {
  id
  organization_id
  donor_id
  stage                   // discovered | researching | outreach | applied | in_conversation | funded | rejected
  enrichment_status       // none | in_progress | completed
  enriched_data           // deep research results (JSON)
  notes[]                 // user notes
  activities[]            // activity log
  reminders[]             // follow-up reminders
  grant_deadlines[]
  created_at
  updated_at
}
```

### Feedback (for learning)
```
SwipeFeedback {
  id
  organization_id
  donor_id
  action                  // right | left
  org_profile_snapshot    // org state at time of swipe (for training)
  donor_snapshot          // donor state at time of swipe
  outcome                 // null | contacted | applied | funded (updated later)
  created_at
}
```

---

## Matching Algorithm

**Priority order (per your guidance):**

1. **Similar organizations' donors** (highest weight)
   - If orgs with similar missions/causes received from Donor X → strong signal
   - Uses: collaborative filtering + mission_embedding similarity

2. **User's existing donors → find similar donors**
   - If user already works with Donor A, find donors similar to A
   - Uses: donor-to-donor similarity via embeddings + cause overlap

3. **Political affiliation alignment**

4. **Target population overlap**
   - Donor cares about same populations as the org

5. **Cause/focus area overlap**

6. **Geographic relevance**
   - Donor gives in regions where the org operates

**Score is NEVER shown to users.** Instead, we generate a human-readable "reasoning" field:
> "This donor has supported 3 organizations similar to yours, focuses on education in Israel, and recently published about immigrant integration."

---

## Donor Database: Research & Collection Strategy

### Phase 1A: Seed Database (MVP)

**Israeli Sources:**
- **Guidestar Israel (מדריך העמותות)** — registry of Israeli nonprofits and their financial data
- **Israel Gives / Israeli Philanthropy** — donor databases
- **Israeli foundation websites** — direct crawling

**US Sources:**
- **IRS 990 data** (via ProPublica Nonprofit Explorer API) — every US foundation's grants, recipients, amounts
- **Foundation Directory** — major grant-makers
- **Charity Navigator / GuideStar US** — nonprofit/donor data

**Global Sources:**
- **Web crawling** — foundation websites, grant announcements
- **News/publications** — articles about philanthropic giving

### Phase 1B: Continuous Research Pipeline

When a new organization signs up:
1. **Immediate:** Match against existing donor DB (show results in <30 seconds)
2. **Background (minutes):** Research donors specific to their cause/population
3. **Deep (hours/days):** Expand the DB with newly discovered donors relevant to this org's profile

This ensures:
- Fast first experience (swipe cards appear immediately from pre-built DB)
- Personalized results improve as background research completes
- Every new org enriches the platform for future orgs

### Research Agent Stack (for building DB & enrichment)

```
┌─────────────────────────────────────────┐
│          Research Orchestrator           │
│  Decides what to research, prioritizes  │
└──────┬──────────┬──────────┬────────────┘
       │          │          │
  ┌────┴───┐ ┌───┴────┐ ┌───┴──────────┐
  │ Web    │ │ Public │ │ Publication  │
  │ Search │ │ Data   │ │ Scanner     │
  │ Agent  │ │ Agent  │ │ Agent       │
  └────┬───┘ └───┬────┘ └───┬──────────┘
       │         │          │
  Google/Bing  IRS 990    Social media
  Crawling     GuideStar  News articles
  Foundation   Gov DBs    Podcasts
  websites                Blog posts
       │         │          │
       └─────────┴──────────┘
                 │
          ┌──────┴──────┐
          │  Validator  │  ← Cross-references facts
          │  Agent      │  ← No hallucination
          └──────┬──────┘
                 │
          ┌──────┴──────┐
          │  Database   │
          │  Writer     │
          └─────────────┘
```

**Key principle: Every fact must have a source URL.** No made-up data. The validator agent cross-checks claims before writing to the DB.

---

## Enrichment (Paid Feature)

When a user clicks "Enrich" on a saved donor:

1. **Deep web research** — comprehensive search for this specific donor
2. **Contact info discovery** — find emails, phone numbers, LinkedIn profiles
3. **Recent activity** — latest grants, publications, social posts
4. **Connection mapping** — find mutual connections or intermediaries
5. **Grant opportunity details** — deadlines, application processes, requirements
6. **Giving patterns** — trends in their donations over time

Output: A rich donor profile stored in the pipeline entry.
Cost: Part of subscription tier (e.g., 5 enrichments/month) + $3 per additional enrichment.

---

## Monetization Model

| Tier | Price | What You Get |
|------|-------|-------------|
| **Free** | $0 | 5 donor matches total + 3 new matches/day. No enrichment. |
| **Starter** | ~$29/mo | Unlimited matches + 5 enrichments/month |
| **Pro** | ~$79/mo | Unlimited matches + 20 enrichments/month + CRM features |
| **Extra enrichment** | $3 each | Available on any paid plan |

---

## Build Phases

### PHASE 1: Data Foundation ← START HERE
> Goal: Build the donor database and research infrastructure

1. **Project scaffolding** — Next.js + TypeScript + Prisma + PostgreSQL + Redis
2. **Database schema** — All core tables with migrations
3. **IRS 990 data importer** — Bulk import US foundation grant data
4. **Web research agents** — Search, crawl, extract, validate donor info
5. **Enrichment pipeline** — Deep research agent for individual donors
6. **Seed database** — Populate with initial donor data (target: 1,000+ donors)
7. **Search engine** — Full-text + vector similarity search across donors

### PHASE 2: Core App
> Goal: Working swipe-to-match experience

1. **Auth & onboarding** — Sign up, describe your org
2. **Matching engine** — Score & rank donors for each org
3. **Swipe UI** — Tinder-style cards with animations
4. **Pipeline board** — Kanban-style donor management after swipe
5. **Basic enrichment trigger** — "Enrich" button on pipeline cards

### PHASE 3: Monetization & Feedback
> Goal: Revenue + improving matches

1. **Stripe integration** — Freemium gating, subscription, per-enrichment billing
2. **Usage tracking** — Count matches, enrichments, enforce limits
3. **Feedback loop** — Collect swipe data, retrain scoring model
4. **Match quality improvements** — A/B test scoring weights

### PHASE 4: CRM & Growth
> Goal: Full donor relationship management

1. **Email integration** — Send/track emails to donors
2. **Reminders & deadlines** — Follow-up prompts, grant deadline alerts
3. **Activity log** — Full history of interactions
4. **Team collaboration** — Multiple users per org
5. **Reporting** — Donor pipeline reports, success metrics

---

## Phase 1 Detailed Breakdown (What We Build First)

### Step 1: Project Setup
- Initialize Next.js with TypeScript
- Configure Prisma + PostgreSQL
- Set up Redis + BullMQ for job queues
- Project structure, linting, basic config

### Step 2: Database Schema
- Create all Prisma models (Donor, Organization, User, Match, Pipeline, etc.)
- Set up pgvector for embedding storage
- Run migrations

### Step 3: IRS 990 Data Pipeline
- Download IRS 990 bulk data (ProPublica API)
- Parse and extract: foundation name, EIN, grants made, recipients, amounts, years
- Map to our Donor schema
- Bulk insert with deduplication

### Step 4: Web Research Agents
- **Search Agent:** Uses web search APIs to find donor information
- **Crawl Agent:** Visits foundation websites, extracts structured data
- **Publication Agent:** Finds articles, social posts, podcasts
- **Validator Agent:** Cross-references facts, requires source URLs
- **Orchestrator:** Coordinates agents, manages research queue

### Step 5: Enrichment Pipeline
- Deep research flow for individual donors
- Contact info extraction
- Recent activity scanning
- Connection mapping
- Output: structured JSON stored in DB

### Step 6: Seed the Database
- Run IRS 990 import (US foundations)
- Research Israeli foundations via web agents
- Target: 1,000+ verified donors with quality data
- Focus on donors relevant to Israeli NGOs

### Step 7: Search Engine
- Full-text search (PostgreSQL tsvector)
- Vector similarity search (pgvector) for mission/cause matching
- Filtered search (by type, geography, cause, population)
- API endpoints for the matching engine to use

---

## Open Questions / Decisions Needed

1. **Domain name / app name?** "DonorMatch" is a working title — do you have a name in mind?
2. **Hosting preference?** Vercel (easy) vs. self-hosted (cheaper at scale)?
3. **OpenAI API key?** We'll need one for generating embeddings and powering research agents. Do you have one, or should we plan for that?
4. **Stripe account?** For billing (can be set up later, but good to know).
5. **Any existing donor data?** CSVs, spreadsheets — anything we can import?
