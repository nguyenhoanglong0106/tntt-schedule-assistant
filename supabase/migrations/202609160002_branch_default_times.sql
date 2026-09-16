alter table public.branches add column if not exists default_start_time time;
alter table public.branches add column if not exists default_end_time time;

update public.branches set default_start_time='09:30', default_end_time='10:30' where code in ('CHIEN','AU');
update public.branches set default_start_time='08:30', default_end_time='09:30' where code in ('THIEU','NGHIA');

create policy branches_super_update on public.branches for update to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
