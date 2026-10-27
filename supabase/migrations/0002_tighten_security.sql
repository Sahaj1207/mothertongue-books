-- The auto-RLS helper runs as an event trigger and must not be callable through the public API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- One read policy per role on books, instead of two overlapping ones for signed-in users.
drop policy "Anyone can read published books" on public.books;
drop policy "Owners can read their own books" on public.books;

create policy "Visitors can read published books"
  on public.books for select
  to anon
  using (status = 'published');

create policy "Signed-in users can read published books and their own"
  on public.books for select
  to authenticated
  using (status = 'published' or owner_id = (select auth.uid()));

-- corrections intentionally has no policies: only the backend (service role) reads and writes it.
comment on table public.corrections is 'Native-speaker fixes. Backend-only: no client policies by design.';
