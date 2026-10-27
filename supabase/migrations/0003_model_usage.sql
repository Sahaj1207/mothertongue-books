-- Token usage and cost of every model call, for the daily budget cap and per-book cost reporting.
create table public.model_usage (
  id bigint generated always as identity primary key,
  job_id uuid references public.jobs (id) on delete set null,
  provider text not null,
  model text not null,
  agent text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  cost_usd numeric(10, 6) not null,
  created_at timestamptz not null default now()
);

create index model_usage_created_idx on public.model_usage (created_at);
create index model_usage_job_idx on public.model_usage (job_id);

alter table public.model_usage enable row level security;
comment on table public.model_usage is 'Backend-only: no client policies by design.';

alter table public.jobs add column cost_usd numeric(10, 6) not null default 0;
