-- "Ask for your language": which languages people want books in, and whether they can help check them.
-- No personal details are asked for. Written only by the backend (service key); nobody can read it publicly.
create table public.language_requests (
  id uuid primary key default gen_random_uuid(),
  language text not null check (char_length(language) between 2 and 60),
  can_help boolean not null default false,
  note text check (char_length(note) <= 300),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.language_requests enable row level security;
