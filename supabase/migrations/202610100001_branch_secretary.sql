-- Thư ký ngành: one shared account per branch so its members can see the branch's schedules (công tác, đọc sách…)
-- and get the same schedule reminders as the branch leader. Read-only everywhere.
alter type public.app_role add value if not exists 'BRANCH_SECRETARY';
-- The new value can't be used as an enum literal in this transaction, so the checks below compare role::text.

create or replace function public.is_secretary() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role::text='BRANCH_SECRETARY');
$$;

-- The branch a user may change. Every write path (schedules via can_manage_schedule, assignees, reminders,
-- attendance, members, classes, breakfast ballots, AI confirm) checks this or is_super_admin(), so a secretary
-- having no branch here is what makes the account read-only. Reads use their own policies and are unaffected.
create or replace function public.current_branch_id() returns uuid language sql stable security definer set search_path=public as $$
  select branch_id from public.profiles where id=auth.uid() and role::text<>'BRANCH_SECRETARY';
$$;

-- Monthly meeting documents are for branch leaders, not for a login shared with members
drop policy if exists meetings_read on public.meetings;
create policy meetings_read on public.meetings for select to authenticated using (not public.is_secretary());
drop policy if exists meeting_files_read on public.meeting_files;
create policy meeting_files_read on public.meeting_files for select to authenticated using (not public.is_secretary());
drop policy if exists meeting_files_storage_read on storage.objects;
create policy meeting_files_storage_read on storage.objects for select to authenticated using (bucket_id = 'meeting-files' and not public.is_secretary());

-- Each thư ký account's login, so its branch leader can pass it on to the members (Gợi ý & Hướng dẫn page).
-- Kept readable on purpose: the account is shared and read-only. Only that branch's leader and Ban điều hành see it;
-- it is written by admin-create-user with the service role.
create table if not exists public.secretary_logins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  username text not null,
  password text not null,
  created_at timestamptz not null default now()
);
alter table public.secretary_logins enable row level security;
create policy secretary_logins_read on public.secretary_logins for select to authenticated
  using (public.is_super_admin() or branch_id = public.current_branch_id());
