-- AERARA System Advisory Studio — schema, security, audit history
-- Run in Supabase SQL editor (or `supabase db push`). Free tier compatible.

create extension if not exists "pgcrypto";

-- ───────────── Advisors (who may sign in) ─────────────
create table public.advisors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Advisor',
  role text not null default 'advisor' check (role in ('owner','advisor')),
  created_at timestamptz not null default now()
);

create or replace function public.is_advisor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.advisors where user_id = auth.uid());
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.advisors where user_id = auth.uid() and role = 'owner');
$$;

-- ───────────── Clients ─────────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  client_number serial unique,
  name text not null,
  business_name text,
  email text,
  phone text,
  website text,
  location text,
  business_description text,
  business_stage text,
  vision text,
  goals text,
  challenges text,
  engagement_status text not null default 'new'
    check (engagement_status in ('new','onboarding','active','paused','completed','archived')),
  engagement_name text,
  next_meeting timestamptz,
  next_action text,
  blueprint jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_email_uidx on public.clients (lower(email)) where email is not null;

-- Sensitive: birth details + spiritual consent. Never rendered into documents.
create table public.client_private (
  client_id uuid primary key references public.clients(id) on delete cascade,
  consent_spiritual boolean not null default false,
  consent_source text,
  consent_at timestamptz,
  birth_date date,
  birth_time time,
  birth_place text,
  latitude double precision,
  longitude double precision,
  time_zone text,
  chart jsonb,
  chart_verified_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ───────────── Intake ─────────────
create table public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  tally_submission_id text not null unique,     -- duplicate prevention
  tally_form_id text,
  source text not null default 'tally' check (source in ('tally_webhook','tally_api','manual_import','tally')),
  submitted_at timestamptz,
  responses jsonb not null,                      -- [{questionId,label,answer}] original, never edited
  reviewed boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.intake_notes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.intake_submissions(id) on delete cascade,
  question_id text not null,
  note text,
  clarified_answer text,                         -- advisor edit; original stays in responses
  needs_followup boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

-- ───────────── Assessments ─────────────
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  submission_id uuid references public.intake_submissions(id) on delete set null,
  status text not null default 'generating'
    check (status in ('generating','awaiting_review','approved','failed')),
  ai_content jsonb,                              -- untouched model output
  content jsonb,                                 -- advisor-edited working copy
  model text,
  error text,
  generated_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assessment_versions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  content jsonb not null,
  saved_by uuid,
  created_at timestamptz not null default now()
);

-- ───────────── Business Foundations audit ─────────────
create table public.audit_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  category text not null,
  sort_order int not null default 0,
  assessed boolean not null default false,
  current_state text, evidence text, client_perspective text,
  advisor_observations text, gaps text,
  maturity int check (maturity between 1 and 5),
  recommendations text,
  priority text check (priority in ('high','medium','low')),
  updated_at timestamptz not null default now(),
  unique (client_id, category)
);

-- ───────────── Systems & tools ─────────────
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  description text,
  pricing_notes text,
  pricing_last_verified date,
  use_cases text,
  advantages text,
  limitations text,
  integrations text,
  affiliate_url text,
  website text,
  advisor_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_tools (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete set null,
  category text,
  name text not null,
  purpose text,
  cost numeric,
  billing_frequency text check (billing_frequency in ('monthly','annual','one-time','usage','free','unknown')),
  dependencies text,
  pain_points text,
  effectiveness int check (effectiveness between 1 and 5),
  recommendation text check (recommendation in ('keep','improve','consolidate','replace','remove','evaluate')),
  notes text,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

-- ───────────── Recommendations, tasks ─────────────
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete set null,
  title text not null,
  category text, issue text, evidence text, solution text, benefit text,
  priority text check (priority in ('high','medium','low')),
  effort text check (effort in ('low','medium','high')),
  estimated_cost text, dependencies text, advisor_notes text,
  status text not null default 'proposed' check (status in ('proposed','approved','declined','done')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  recommendation_id uuid references public.recommendations(id) on delete set null,
  title text not null,
  description text,
  phase text not null default '30' check (phase in ('30','60','90','later')),
  is_milestone boolean not null default false,
  owner_type text not null default 'advisor' check (owner_type in ('advisor','client','other')),
  owner_name text,
  due_date date,
  priority text check (priority in ('high','medium','low')),
  effort text, estimated_cost text, depends_on text, success_criteria text,
  status text not null default 'not_started' check (status in ('not_started','in_progress','waiting','completed')),
  sort_order int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── Documents, emails, activity ─────────────
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  doc_type text not null,
  title text not null,
  audience text not null default 'internal' check (audience in ('internal','client')),
  content text not null default '',
  status text not null default 'draft' check (status in ('draft','approved')),
  approved_at timestamptz,
  last_exported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Outgoing email queue. Nothing is sent automatically; the advisor approves, then sends from Gmail.
create table public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  to_email text, subject text not null default '', body text not null default '',
  status text not null default 'needs_review' check (status in ('needs_review','approved','sent','discarded')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  activity_type text not null default 'note'
    check (activity_type in ('meeting','note','communication','decision','milestone','change','intake','system')),
  occurred_at timestamptz not null default now(),
  title text not null,
  notes text,
  follow_up text,
  follow_up_due date,
  follow_up_done boolean not null default false,
  is_private boolean not null default true,
  created_at timestamptz not null default now()
);

-- ───────────── Audit history (who changed what) ─────────────
create table public.audit_log (
  id bigserial primary key,
  table_name text not null,
  row_id text,
  action text not null,
  actor uuid,
  changes jsonb,
  at timestamptz not null default now()
);

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, row_id, action, actor, changes)
  values (tg_table_name,
          coalesce((case when tg_op='DELETE' then old.id else new.id end)::text, null),
          tg_op, auth.uid(),
          case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['clients','client_private','assessments','audit_items','client_tools',
    'recommendations','tasks','documents','email_drafts','resources','intake_notes'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
  foreach t in array array['clients','assessments','recommendations','tasks','documents','email_drafts','activities','intake_submissions'] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.log_change()', t, t);
  end loop;
end $$;

-- ───────────── Row-level security ─────────────
-- Only signed-in advisors can read/write anything. The Tally webhook uses the service role server-side.
do $$
declare t text;
begin
  foreach t in array array['clients','client_private','intake_submissions','intake_notes','assessments',
    'assessment_versions','audit_items','resources','client_tools','recommendations','tasks',
    'documents','email_drafts','activities'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy advisor_all on public.%I for all to authenticated using (public.is_advisor()) with check (public.is_advisor())', t);
  end loop;
end $$;

alter table public.advisors enable row level security;
create policy advisors_read on public.advisors for select to authenticated using (public.is_advisor());
create policy advisors_owner on public.advisors for all to authenticated using (public.is_owner()) with check (public.is_owner());

alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select to authenticated using (public.is_advisor());

-- Only owners may delete clients (deletes cascade to every linked record).
drop policy advisor_all on public.clients;
create policy clients_rw on public.clients for select to authenticated using (public.is_advisor());
create policy clients_ins on public.clients for insert to authenticated with check (public.is_advisor());
create policy clients_upd on public.clients for update to authenticated using (public.is_advisor()) with check (public.is_advisor());
create policy clients_del on public.clients for delete to authenticated using (public.is_owner());
