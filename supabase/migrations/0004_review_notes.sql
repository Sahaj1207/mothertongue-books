-- Reading-level notes left after the writer's retries, shown to the adult who reviews the book.
alter table public.books add column review_notes jsonb not null default '[]';
