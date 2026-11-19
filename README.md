# AERARA System Advisory Studio

Private advisor workspace: **Intake → Client Profile → AI Assessment → Advisor Review → Blueprint → Recommendations → Roadmap → Progress**, all on one client record.

Next.js 15 (App Router) · Supabase (Postgres, Auth, row-level security) · Tailwind 4.

## What works today

| Area | Status |
|---|---|
| Sign-in, advisor-only access (RLS on every table), owner/advisor roles | Working |
| **Today** dashboard: clients and their stage, my to-dos, waiting on clients, new intakes, assessments to review, emails to confirm, upcoming meetings, recent activity | Working |
| Tally intake: signed webhook, match by email or create a client, dedupe by submission ID, consent captured | Working (needs webhook set up) |
| Tally backfill: "Sync from Tally" (API key) or paste JSON | Working |
| AI assessment (7 sections + audit, tools, recommendations, roadmap), drafts only, version history, approve | Working (needs an AI key) |
| Client workspace: Overview, Intake, Assessment, Soul & System Blueprint, Business Foundations, Systems & Tools, Recommendations, Roadmap (30/60/90), Documents, Activity & Notes | Working; every field is editable inline |
| Birth chart: Sun, Moon, Ascendant, Mercury, Venus, Mars, Saturn, Midheaven from the time-zone database (historical DST) | Working; verified against Swiss Ephemeris to 0.01° |
| Documents: 10 types, internal and client versions, editor, approval, branded print to PDF with page numbers | Working |
| Email queue: draft → approve → open in Gmail → mark sent. **Never sends automatically.** | Working |
| Google Calendar: upcoming events matched to clients | Working (read-only iCal feed) |
| Audit history (who changed what), JSON export, owner-only delete | Working |
| Client portal | Not built (Phase 4) |
| Houses, aspects, Human Design | Not calculated; shown as Unverified |

## Setup (about 30 minutes)

### 1. Supabase (free tier)
1. Create a project at supabase.com.
2. In the SQL Editor, run `supabase/migrations/0001_schema.sql`.
3. **Authentication → Providers → Email**: turn off "Allow new users to sign up".
4. **Authentication → Users → Add user**: your email and a password. Copy the user's UUID.
5. SQL Editor:
   ```sql
   insert into advisors (user_id, display_name, role) values ('<your-user-uuid>', 'Tzip', 'owner');
   ```

### 2. Deploy
Push to GitHub, import into Vercel, and add the variables from `.env.example`. Set the webhook and Calendar steps below to your Vercel domain.

### 3. Tally webhook
Form **vXDAE8** → Integrations → Webhooks → URL `https://<your-domain>/api/tally/webhook`. Add a signing secret and put the same value in `TALLY_SIGNING_SECRET`. Submit a test response; it should appear on **Today** under new intakes.

### 4. Google Calendar
Google Calendar → Settings → your calendar → **Integrate calendar → Secret address in iCal format**. Put it in `GOOGLE_CALENDAR_ICS_URL`. Events match a client when the client's email is an attendee or their name is in the title. (A Workspace admin may need to allow this address.) Whatever booking tool you choose later works as long as it writes to this calendar.

### 5. AI
Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (pay per use, typically a few cents per assessment). Without a key, intakes still save, and the Generate button stays hidden.

### 6. Logo
Add the official mountain logo as `public/aerara-logo.svg`, then replace the text wordmark in `src/components/ui.tsx` (`Wordmark`) and on the print cover (`src/app/print/[docId]/page.tsx`).

## Running costs
Budget ceiling for added tools: $125/month.

- Supabase free tier: $0. Free projects pause after a week of inactivity; open the app weekly or upgrade.
- Hosting: Vercel.
- AI: usage-based only.
- Tally webhooks, Google Calendar feed, PDF export (browser print): $0.

## Privacy notes
- Birth details live in `client_private`. They are never sent to the AI and never rendered into documents. Only verified placements (sign and degree) are shared, and only with opt-in.
- Client-facing documents leave out advisor notes, internal blueprint observations, unapproved recommendations and first-meeting questions.
- AI output is always a draft until an advisor approves it. Editing an approved item returns it to review.

## Local development
```bash
cp .env.example .env.local   # fill in
npm install
npm run dev
```
