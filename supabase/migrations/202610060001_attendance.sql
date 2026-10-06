-- Attendance per schedule, for the "Bảng siêng năng" KPI and the year-end review.
-- One row per assigned member/class, plus rows for members who substituted (is_substitute).
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  status text not null check (status in ('PRESENT', 'LATE', 'EXCUSED', 'ABSENT')),
  is_substitute boolean not null default false,
  marked_by uuid references auth.users(id) default auth.uid(),
  marked_at timestamptz not null default now(),
  constraint attendance_one_target check ((member_id is null) <> (class_id is null)),
  constraint attendance_member_unique unique (schedule_id, member_id),
  constraint attendance_class_unique unique (schedule_id, class_id)
);
create index if not exists attendance_member_idx on public.attendance(member_id);

alter table public.attendance enable row level security;
-- Everyone can see the ranking; only the schedule's branch admin (or a super admin) marks it
create policy attendance_read on public.attendance for select to authenticated using (true);
create policy attendance_write on public.attendance for all to authenticated
  using (public.is_super_admin() or exists (select 1 from public.schedules s where s.id = schedule_id and s.branch_id = public.current_branch_id()))
  with check (public.is_super_admin() or exists (select 1 from public.schedules s where s.id = schedule_id and s.branch_id = public.current_branch_id()));

-- When the "chưa điểm danh" reminder went out, so it is sent once per schedule
alter table public.schedules add column if not exists attendance_reminded_at timestamptz;
