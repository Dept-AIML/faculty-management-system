-- ─────────────────────────────────────────────────────────────────────────────
-- 006_add_hr_role.sql
-- Adds 'hr' as a new role alongside 'faculty' and 'hod'.
--
-- HR rules:
--   • Can view and approve/reject leave requests for ALL faculty (and other HR)
--     EXCEPT their own — those go to HOD only.
--   • Can scan QR codes for faculty re-entry, but NOT their own.
--   • Cannot access Faculty Management or Report Generator (enforced in UI + API).
--   • HOD can create HR accounts via the new Staff Management tab.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Update role check constraint to include 'hr' ───────────────────────
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('faculty', 'hod', 'hr'));

-- ── 2. Update get_my_role helper (already exists, just ensure it covers hr) ─
-- No change needed — it already returns any role value from profiles.

-- ── 3. Drop existing leave_requests policies (clean slate for new logic) ──
drop policy if exists "leave_insert_own"    on public.leave_requests;
drop policy if exists "leave_select_own"    on public.leave_requests;
drop policy if exists "leave_select_hod"    on public.leave_requests;
drop policy if exists "leave_update_hod"    on public.leave_requests;

-- ── 4. Recreate leave_requests policies with HR support ───────────────────

-- Faculty (and HR) can insert their own requests
create policy "leave_insert_own"
  on public.leave_requests for insert
  to authenticated
  with check (faculty_id = auth.uid());

-- Faculty can read their own leaves
create policy "leave_select_own"
  on public.leave_requests for select
  to authenticated
  using (faculty_id = auth.uid());

-- HOD can read ALL leave requests (including HR's)
create policy "leave_select_hod"
  on public.leave_requests for select
  to authenticated
  using (public.get_my_role() = 'hod');

-- HR can read all leaves EXCEPT their own (own leaves handled by leave_select_own)
-- Uses OR so both faculty_id != auth.uid() and role=hr passes
create policy "leave_select_hr"
  on public.leave_requests for select
  to authenticated
  using (
    public.get_my_role() = 'hr'
    and faculty_id != auth.uid()
  );

-- HOD can update any leave request
create policy "leave_update_hod"
  on public.leave_requests for update
  to authenticated
  using (public.get_my_role() = 'hod')
  with check (public.get_my_role() = 'hod');

-- HR can update any leave request EXCEPT their own
-- (Server-side API also enforces this as a second layer)
create policy "leave_update_hr"
  on public.leave_requests for update
  to authenticated
  using (
    public.get_my_role() = 'hr'
    and faculty_id != auth.uid()
  )
  with check (
    public.get_my_role() = 'hr'
    and faculty_id != auth.uid()
  );

-- ── 5. QR scan logs: allow HR to insert/read (except own faculty_id) ──────
drop policy if exists "scanlog_hod_all"     on public.qr_scan_logs;
drop policy if exists "scanlog_faculty_read" on public.qr_scan_logs;

-- HOD full access
create policy "scanlog_hod_all"
  on public.qr_scan_logs for all
  to authenticated
  using (public.get_my_role() = 'hod');

-- HR can insert scan logs for others only (not own QR)
create policy "scanlog_hr_insert"
  on public.qr_scan_logs for insert
  to authenticated
  with check (
    public.get_my_role() = 'hr'
    and faculty_id != auth.uid()
  );

-- HR can read all scan logs (for the scan log view)
create policy "scanlog_hr_read"
  on public.qr_scan_logs for select
  to authenticated
  using (public.get_my_role() = 'hr');

-- Faculty can read their own scan logs
create policy "scanlog_faculty_read"
  on public.qr_scan_logs for select
  to authenticated
  using (faculty_id = auth.uid());

-- ── 6. Update the handle_new_user trigger to accept 'hr' role ─────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    new.email,
    case
      when new.raw_user_meta_data->>'role' in ('faculty', 'hod', 'hr')
        then new.raw_user_meta_data->>'role'
      else 'faculty'
    end
  );
  return new;
end; $$;
