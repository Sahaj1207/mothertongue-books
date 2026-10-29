-- Languages are listed in the app (backend/app/languages.py), which validates them; the database only
-- checks the shape of a language code, so adding a language needs no migration.
alter table public.books drop constraint books_language_check;
alter table public.books drop constraint books_pair_language_check;
alter table public.corrections drop constraint corrections_language_check;

alter table public.books add constraint books_language_check check (language ~ '^[a-z]{2,3}$');
alter table public.books add constraint books_pair_language_check check (pair_language ~ '^[a-z]{2,3}$');
alter table public.corrections add constraint corrections_language_check check (language ~ '^[a-z]{2,3}$');
