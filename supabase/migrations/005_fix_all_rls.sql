-- ─────────────────────────────────────────────────────────────────────────────
-- 005_fix_all_rls.sql
-- Fixes RLS recursion: policies that call (select role from profiles where id=auth.uid())
-- cause infinite loops because profiles itself has RLS.
-- Solution: SECURITY DEFINER function reads profiles bypassing RLS.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: returns current user's role, bypasses RLS ─────────────────────
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

grant execute on function public.get_my_role() to authenticated;

-- ── Drop ALL existing policies (clean slate) ───────────────────────────────
drop policy if exists "profiles_self"         on public.profiles;
drop policy if exists "profiles_hod"          on public.profiles;
drop policy if exists "profiles_own_write"    on public.profiles;
drop policy if exists "profiles_hod_write"    on public.profiles;
drop policy if exists "profiles_insert"       on public.profiles;
drop policy if exists "profiles_read_all"     on public.profiles;
drop policy if exists "profiles_update_own"   on public.profiles;
drop policy if exists "profiles_write_own"    on public.profiles;
drop policy if exists "leave_faculty"         on public.leave_requests;
drop policy if exists "leave_faculty_own"     on public.leave_requests;
drop policy if exists "leave_hod"             on public.leave_requests;
drop policy if exists "leave_hod_all"         on public.leave_requests;
drop policy if exists "leave_faculty_insert"  on public.leave_requests;
drop policy if exists "leave_insert_own"      on public.leave_requests;
drop policy if exists "leave_select_own"      on public.leave_requests;
drop policy if exists "leave_select_hod"      on public.leave_requests;
drop policy if exists "leave_update_hod"      on public.leave_requests;
drop policy if exists "scanlog_hod"           on public.qr_scan_logs;
drop policy if exists "scanlog_hod_all"       on public.qr_scan_logs;
drop policy if exists "scanlog_faculty_read"  on public.qr_scan_logs;

-- ── PROFILES ──────────────────────────────────────────────────────────────
create policy "profiles_read_all"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_write_own"
  on public.profiles for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── LEAVE REQUESTS ────────────────────────────────────────────────────────
create policy "leave_insert_own"
  on public.leave_requests for insert
  to authenticated
  with check (faculty_id = auth.uid());

create policy "leave_select_own"
  on public.leave_requests for select
  to authenticated
  using (faculty_id = auth.uid());

create policy "leave_select_hod"
  on public.leave_requests for select
  to authenticated
  using (public.get_my_role() = 'hod');

create policy "leave_update_hod"
  on public.leave_requests for update
  to authenticated
  using (public.get_my_role() = 'hod')
  with check (public.get_my_role() = 'hod');

-- ── QR SCAN LOGS ─────────────────────────────────────────────────────────
create policy "scanlog_hod_all"
  on public.qr_scan_logs for all
  to authenticated
  using (public.get_my_role() = 'hod');

create policy "scanlog_faculty_read"
  on public.qr_scan_logs for select
  to authenticated
  using (faculty_id = auth.uid());
