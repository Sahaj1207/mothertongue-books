-- Retold folk tales: the tradition a tale comes from and the outline the adult approved.
alter table public.books add column source text;
alter table public.books add column outline text;
