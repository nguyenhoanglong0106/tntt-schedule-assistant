-- Replace the per-branch fixed default time with a flexible (task type, branch)
-- default time table, and let Super Admin create new task types.

create table public.task_type_branch_times (
  task_type_id uuid not null references public.task_types(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  start_time time not null, end_time time not null,
  updated_at timestamptz not null default now(),
  primary key (task_type_id, branch_id)
);
alter table public.task_type_branch_times enable row level security;
create policy task_type_branch_times_read on public.task_type_branch_times for select to authenticated using(true);
create policy task_type_branch_times_super_manage on public.task_type_branch_times for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());

create policy task_types_super_insert on public.task_types for insert to authenticated with check(public.is_super_admin());
create policy task_types_super_update on public.task_types for update to authenticated using(public.is_super_admin()) with check(public.is_super_admin());

-- carry over the old per-branch defaults (applied to both ICE_CREAM and OFFICE_DUTY)
insert into public.task_type_branch_times (task_type_id, branch_id, start_time, end_time)
select t.id, b.id, b.default_start_time, b.default_end_time
from public.branches b
cross join public.task_types t
where b.default_start_time is not null and b.default_end_time is not null and t.code in ('ICE_CREAM','OFFICE_DUTY')
on conflict do nothing;

alter table public.branches drop column if exists default_start_time;
alter table public.branches drop column if exists default_end_time;
drop policy if exists branches_super_update on public.branches;
