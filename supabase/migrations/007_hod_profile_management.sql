-- ─────────────────────────────────────────────────────────────────────────────
-- 007_hod_profile_management.sql
-- Allows HOD to update any non-HOD profile (is_active, role, etc.)
-- The manage-profile API uses service role key so this is a belt-and-suspenders
-- fix — but it also ensures direct Supabase client calls from HOD work correctly.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop existing profile write policy
drop policy if exists "profiles_write_own" on public.profiles;

-- Users can update only their own profile
create policy "profiles_write_own"
  on public.profiles for update
  to authenticated
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- HOD can update any profile that is not another HOD
create policy "profiles_hod_manage"
  on public.profiles for update
  to authenticated
  using  (public.get_my_role() = 'hod' and role != 'hod')
  with check (public.get_my_role() = 'hod');

-- HOD can delete any profile that is not another HOD
-- (used when deleting via service role, but good to have)
create policy "profiles_hod_delete"
  on public.profiles for delete
  to authenticated
  using (public.get_my_role() = 'hod' and role != 'hod');
