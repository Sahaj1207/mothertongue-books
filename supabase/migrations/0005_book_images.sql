-- Picture URL per page number, e.g. {"1": "https://.../page-1.webp"}. Shared by every language version.
alter table public.books add column images jsonb not null default '{}';
