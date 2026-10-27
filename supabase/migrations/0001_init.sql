-- MotherTongue Books: initial schema.
-- The backend writes with the service-role key; the public can only read published books.

create table public.books (
  id uuid primary key default gen_random_uuid(),
  language text not null check (language in ('te', 'kn', 'mr')),
  pair_language text check (pair_language in ('te', 'kn', 'mr', 'en')),
  level smallint not null check (level between 1 and 3),
  kind text not null check (kind in ('original', 'two-language', 'folk-tale')),
  folk_tale_source text,
  topic text not null,
  plan jsonb not null,
  drafts jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index books_published_idx on public.books (status, language, level, published_at desc);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running', 'done', 'blocked', 'failed')),
  request jsonb not null,
  steps jsonb not null default '[]',
  book_id uuid references public.books (id) on delete set null,
  message text,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Native-speaker fixes, reused by the writer for every later book in that language.
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  language text not null check (language in ('te', 'kn', 'mr', 'en')),
  wrong text not null,
  right_text text not null,
  note text,
  book_id uuid references public.books (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (language, wrong)
);

alter table public.books enable row level security;
alter table public.jobs enable row level security;
alter table public.corrections enable row level security;

create policy "Anyone can read published books"
  on public.books for select
  using (status = 'published');

create policy "Owners can read their own books"
  on public.books for select
  to authenticated
  using (owner_id = auth.uid());

create policy "Owners can read their own jobs"
  on public.jobs for select
  to authenticated
  using (owner_id = auth.uid());

-- Storage: illustrations and PDFs, publicly readable, written only by the backend.
insert into storage.buckets (id, name, public)
values ('book-assets', 'book-assets', true)
on conflict (id) do nothing;
